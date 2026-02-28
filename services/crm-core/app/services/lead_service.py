"""LeadService — business logic for the Lead resource.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query that touches Lead rows MUST include tenant_id in the WHERE clause
    to enforce strict multi-tenant data isolation.
  - Naming series follows the pattern CRM-LEAD-{YYYY}-{zero-padded-sequence}.
    The sequence is the count of existing leads for that tenant + year at insert
    time, which is fast and does not require a separate sequence table.  It is
    NOT guaranteed to be gapless (deletes create gaps), which is acceptable.
  - Status transitions are tracked in StatusChangeLog — duration is calculated
    from the previous log entry's changed_at to now().
  - convert_to_deal creates a Deal row with a snapshot of the Lead's contact
    data and sets Lead.converted = True in the same transaction.
  - assign_lead creates (or reactivates) an Assignment row with doctype="Lead".
  - Filtering supports equality filters via the `filters` dict from LeadListParams.
    For production, extend _build_where_clause to support operators like gt/lt/in.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy import String, cast, delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.assignment import Assignment
from app.models.deal import Deal
from app.models.lead import Lead
from app.models.lookups import DealStatus, LeadStatus
from app.models.status_change_log import StatusChangeLog
from app.schemas.lead import (
    LeadCreate,
    LeadListItem,
    LeadListParams,
    LeadUpdate,
    PaginatedResponse,
    KanbanColumn,
    KanbanResponse,
    GroupByBucket,
    GroupByResponse,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Column whitelist — prevents SQL injection through dynamic ORDER BY / filters
# ---------------------------------------------------------------------------

_LEAD_COLUMNS: frozenset[str] = frozenset(
    {
        "id",
        "tenant_id",
        "naming_series",
        "created_by_id",
        "salutation",
        "first_name",
        "middle_name",
        "last_name",
        "lead_name",
        "gender",
        "email",
        "mobile_no",
        "phone",
        "website",
        "job_title",
        "organization_name",
        "image_url",
        "organization_id",
        "status_id",
        "source_id",
        "industry_id",
        "territory_id",
        "lead_owner_id",
        "no_of_employees",
        "annual_revenue",
        "currency",
        "converted",
        "sla_id",
        "sla_status",
        "sla_creation",
        "response_by",
        "first_response_time",
        "first_responded_on",
        "communication_status",
        "facebook_lead_id",
        "facebook_form_id",
        "lost_reason_id",
        "lost_notes",
        "total",
        "net_total",
        "created_at",
        "updated_at",
    }
)


def _validate_column(name: str) -> None:
    """Raise BadRequestError if `name` is not a known Lead column."""
    if name not in _LEAD_COLUMNS:
        raise BadRequestError(f"Unknown filter / sort field: {name!r}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_lead_query(tenant_id: uuid.UUID):
    """Base SELECT with eager-loaded relationships for full Lead responses."""
    return (
        select(Lead)
        .where(Lead.tenant_id == tenant_id)
        .options(
            selectinload(Lead.status),
            selectinload(Lead.source),
            selectinload(Lead.lead_owner),
            selectinload(Lead.organization),
            selectinload(Lead.industry),
            selectinload(Lead.territory),
        )
    )


_SAFE_FILTER_TYPES = (str, int, float, bool, type(None))


def _validate_filter_value(value: Any) -> None:
    """Ensure filter values are safe primitives — rejects dicts, objects, etc."""
    if isinstance(value, list):
        for item in value:
            if not isinstance(item, _SAFE_FILTER_TYPES):
                raise BadRequestError(f"Filter list items must be primitives, got {type(item).__name__}")
    elif not isinstance(value, _SAFE_FILTER_TYPES):
        raise BadRequestError(f"Filter values must be primitives, got {type(value).__name__}")


def _apply_filters(query, filters: dict[str, Any] | None):
    """Append equality WHERE clauses derived from the filters dict.

    Supported value types:
      - scalar (str, int, float, bool, UUID) -> col = value
      - None -> col IS NULL
      - list -> col IN (values)
    """
    if not filters:
        return query
    for field, value in filters.items():
        _validate_column(field)
        _validate_filter_value(value)
        col = getattr(Lead, field)
        if value is None:
            query = query.where(col.is_(None))
        elif isinstance(value, list):
            query = query.where(col.in_(value))
        else:
            query = query.where(col == value)
    return query


def _apply_ordering(query, order_by: str):
    """Append ORDER BY clauses from a comma-separated 'field dir' string."""
    tokens = [t.strip() for t in order_by.split(",") if t.strip()]
    for token in tokens:
        parts = token.split()
        field = parts[0]
        direction = parts[1].lower() if len(parts) == 2 else "asc"
        _validate_column(field)
        col = getattr(Lead, field)
        query = query.order_by(col.desc() if direction == "desc" else col.asc())
    return query


def _compute_lead_name(
    salutation: str | None,
    first_name: str,
    middle_name: str | None,
    last_name: str | None,
) -> str:
    parts = [p for p in (salutation, first_name, middle_name, last_name) if p]
    return " ".join(parts)


async def _generate_naming_series(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """Generate CRM-LEAD-{YYYY}-{NNN} for the current year.

    Uses a COUNT of existing leads for this tenant+year as the sequence seed.
    Fast and lock-free; small gaps are acceptable.
    """
    year = datetime.now(UTC).year
    result = await db.execute(
        select(func.count())
        .select_from(Lead)
        .where(
            Lead.tenant_id == tenant_id,
            func.extract("year", Lead.created_at) == year,
        )
    )
    count = result.scalar_one()
    return f"CRM-LEAD-{year}-{count + 1:05d}"


async def _fetch_last_status_log(
    db: AsyncSession, lead_id: uuid.UUID
) -> StatusChangeLog | None:
    """Return the most recent StatusChangeLog entry for a lead."""
    result = await db.execute(
        select(StatusChangeLog)
        .where(
            StatusChangeLog.entity_type == "Lead",
            StatusChangeLog.entity_id == lead_id,
        )
        .order_by(StatusChangeLog.changed_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _get_status_label(db: AsyncSession, status_id: uuid.UUID) -> str:
    """Return the label of a LeadStatus row."""
    result = await db.execute(
        select(LeadStatus.label).where(LeadStatus.id == status_id)
    )
    label = result.scalar_one_or_none()
    return label or str(status_id)


async def _record_status_change(
    db: AsyncSession,
    lead: Lead,
    old_status_id: uuid.UUID | None,
    new_status_id: uuid.UUID,
    changed_by_id: uuid.UUID | None,
) -> None:
    """Insert a StatusChangeLog row tracking the transition."""
    from_label: str | None = None
    duration = None

    if old_status_id and old_status_id != new_status_id:
        from_label = await _get_status_label(db, old_status_id)
        last_log = await _fetch_last_status_log(db, lead.id)
        if last_log:
            duration = datetime.now(UTC) - last_log.changed_at

    to_label = await _get_status_label(db, new_status_id)

    log = StatusChangeLog(
        entity_type="Lead",
        entity_id=lead.id,
        from_status=from_label,
        to_status=to_label,
        changed_by_id=changed_by_id,
        changed_at=datetime.now(UTC),
        duration=duration,
    )
    db.add(log)


# ---------------------------------------------------------------------------
# LeadService
# ---------------------------------------------------------------------------


class LeadService:
    """All business logic for Leads, scoped to a single tenant per call."""

    # ------------------------------------------------------------------
    # list_leads
    # ------------------------------------------------------------------

    async def list_leads(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: LeadListParams,
    ) -> PaginatedResponse[LeadListItem] | KanbanResponse[LeadListItem] | GroupByResponse[LeadListItem]:
        """Return leads in list, kanban, or group_by format."""

        if params.view_type == "kanban":
            return await self._list_kanban(db, tenant_id, params)
        if params.view_type == "group_by":
            return await self._list_group_by(db, tenant_id, params)
        return await self._list_paginated(db, tenant_id, params)

    async def _list_paginated(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: LeadListParams,
    ) -> PaginatedResponse[LeadListItem]:
        base_query = _build_lead_query(tenant_id)
        base_query = _apply_filters(base_query, params.filters)

        # Count total matching rows (before pagination)
        count_query = (
            select(func.count())
            .select_from(Lead)
            .where(Lead.tenant_id == tenant_id)
        )
        count_query = _apply_filters(count_query, params.filters)
        total_result = await db.execute(count_query)
        total_count = total_result.scalar_one()

        # Paginated data
        data_query = _apply_ordering(base_query, params.order_by)
        offset = (params.page - 1) * params.page_size
        data_query = data_query.offset(offset).limit(params.page_size)

        rows = await db.execute(data_query)
        leads = rows.scalars().all()

        return PaginatedResponse[LeadListItem](
            data=[LeadListItem.model_validate(lead) for lead in leads],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    async def _list_kanban(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: LeadListParams,
    ) -> KanbanResponse[LeadListItem]:
        """Group leads by column_field into kanban columns.

        Strategy:
          1. Fetch all matching leads (up to a safe cap per column: 200) ordered
             by column position + created_at.
          2. Group in Python — avoids complex SQL PARTITION BY on the ORM layer
             while keeping N+1 queries away.

        For very large boards (>10k leads) this should be replaced by a per-column
        paginated API call — that is a future optimisation gate-kept by
        view_type=kanban + column_id query param.
        """
        if not params.column_field:
            raise BadRequestError(
                "column_field is required when view_type is 'kanban'"
            )

        base_query = _build_lead_query(tenant_id)
        base_query = _apply_filters(base_query, params.filters)
        base_query = _apply_ordering(base_query, params.order_by)

        # Safety cap: max 200 leads per fetch in kanban mode
        base_query = base_query.limit(200 * 50)  # 50 columns * 200 cards

        rows = await db.execute(base_query)
        leads = rows.scalars().all()

        # Group by column_field value
        columns_map: dict[Any, list[Lead]] = {}
        for lead in leads:
            key = getattr(lead, params.column_field)
            columns_map.setdefault(key, []).append(lead)

        # Build KanbanColumn list — enrich with metadata from status if applicable
        kanban_columns: list[KanbanColumn[LeadListItem]] = []
        for col_key, col_leads in columns_map.items():
            color = None
            position = None
            column_id: uuid.UUID | None = None
            column_value: str | None = None

            if params.column_field == "status_id" and col_leads:
                status = col_leads[0].status
                color = status.color
                position = status.position
                column_id = status.id
                column_value = status.label
            elif col_key is not None:
                column_id = col_key if isinstance(col_key, uuid.UUID) else None
                column_value = str(col_key)

            kanban_columns.append(
                KanbanColumn[LeadListItem](
                    column_value=column_value,
                    column_id=column_id,
                    color=color,
                    position=position,
                    count=len(col_leads),
                    data=[LeadListItem.model_validate(lead) for lead in col_leads],
                )
            )

        # Sort columns by position (kanban board order)
        kanban_columns.sort(key=lambda c: (c.position is None, c.position or 0))

        return KanbanResponse[LeadListItem](
            columns=kanban_columns,
            total_count=len(leads),
        )

    async def _list_group_by(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: LeadListParams,
    ) -> GroupByResponse[LeadListItem]:
        """Aggregate leads into buckets by group_by_field."""
        if not params.group_by_field:
            raise BadRequestError(
                "group_by_field is required when view_type is 'group_by'"
            )

        base_query = _build_lead_query(tenant_id)
        base_query = _apply_filters(base_query, params.filters)
        base_query = _apply_ordering(base_query, params.order_by)

        rows = await db.execute(base_query)
        leads = rows.scalars().all()

        buckets_map: dict[Any, list[Lead]] = {}
        for lead in leads:
            key = getattr(lead, params.group_by_field)
            buckets_map.setdefault(key, []).append(lead)

        buckets: list[GroupByBucket[LeadListItem]] = []
        for grp_key, grp_leads in buckets_map.items():
            group_id = grp_key if isinstance(grp_key, uuid.UUID) else None
            buckets.append(
                GroupByBucket[LeadListItem](
                    group_value=str(grp_key) if grp_key is not None else None,
                    group_id=group_id,
                    count=len(grp_leads),
                    data=[LeadListItem.model_validate(lead) for lead in grp_leads],
                )
            )

        return GroupByResponse[LeadListItem](
            buckets=buckets,
            total_count=len(leads),
        )

    # ------------------------------------------------------------------
    # get_lead
    # ------------------------------------------------------------------

    async def get_lead(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        lead_id: uuid.UUID,
    ) -> Lead:
        """Fetch a single Lead by PK, scoped to tenant_id."""
        result = await db.execute(
            _build_lead_query(tenant_id).where(Lead.id == lead_id)
        )
        lead = result.scalar_one_or_none()
        if not lead:
            raise NotFoundError(f"Lead {lead_id} not found")
        return lead

    # ------------------------------------------------------------------
    # create_lead
    # ------------------------------------------------------------------

    async def create_lead(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: LeadCreate,
        user_id: uuid.UUID,
    ) -> Lead:
        """Create a new Lead and record its initial status in StatusChangeLog."""
        naming_series = await _generate_naming_series(db, tenant_id)
        lead_name = _compute_lead_name(
            data.salutation, data.first_name, data.middle_name, data.last_name
        )

        lead = Lead(
            tenant_id=tenant_id,
            created_by_id=user_id,
            naming_series=naming_series,
            lead_name=lead_name,
            # Identity
            salutation=data.salutation,
            first_name=data.first_name,
            middle_name=data.middle_name,
            last_name=data.last_name,
            gender=data.gender,
            # Contact
            email=str(data.email) if data.email else None,
            mobile_no=data.mobile_no,
            phone=data.phone,
            website=data.website,
            # Professional
            job_title=data.job_title,
            organization_name=data.organization_name,
            image_url=data.image_url,
            # Classification
            status_id=data.status_id,
            source_id=data.source_id,
            industry_id=data.industry_id,
            territory_id=data.territory_id,
            organization_id=data.organization_id,
            # Ownership
            lead_owner_id=data.lead_owner_id,
            # Sizing
            no_of_employees=data.no_of_employees,
            annual_revenue=data.annual_revenue,
            currency=data.currency,
            # Disqualification
            lost_reason_id=data.lost_reason_id,
            lost_notes=data.lost_notes,
            # Meta
            facebook_lead_id=data.facebook_lead_id,
            facebook_form_id=data.facebook_form_id,
        )

        db.add(lead)
        await db.flush()  # populate lead.id before recording status log

        # Record initial status
        await _record_status_change(
            db=db,
            lead=lead,
            old_status_id=None,
            new_status_id=data.status_id,
            changed_by_id=user_id,
        )

        await db.flush()

        # Reload with relationships
        lead = await self.get_lead(db, tenant_id, lead.id)
        logger.info(
            "lead_created",
            lead_id=str(lead.id),
            tenant_id=str(tenant_id),
            naming_series=naming_series,
        )
        return lead

    # ------------------------------------------------------------------
    # update_lead
    # ------------------------------------------------------------------

    async def update_lead(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        lead_id: uuid.UUID,
        data: LeadUpdate,
        user_id: uuid.UUID | None = None,
    ) -> Lead:
        """Partial update of a Lead.  Tracks status changes in StatusChangeLog."""
        lead = await self.get_lead(db, tenant_id, lead_id)
        old_status_id: uuid.UUID | None = lead.status_id

        # Apply only non-None fields from the patch payload
        update_data = data.model_dump(exclude_none=True)

        # Recompute lead_name if any name component changes
        name_fields = {"salutation", "first_name", "middle_name", "last_name"}
        if name_fields & update_data.keys():
            lead.lead_name = _compute_lead_name(
                salutation=update_data.get("salutation", lead.salutation),
                first_name=update_data.get("first_name", lead.first_name),
                middle_name=update_data.get("middle_name", lead.middle_name),
                last_name=update_data.get("last_name", lead.last_name),
            )

        for field, value in update_data.items():
            setattr(lead, field, value)

        # Track status transition
        new_status_id = update_data.get("status_id")
        if new_status_id and new_status_id != old_status_id:
            await _record_status_change(
                db=db,
                lead=lead,
                old_status_id=old_status_id,
                new_status_id=new_status_id,
                changed_by_id=user_id,
            )

        await db.flush()

        lead = await self.get_lead(db, tenant_id, lead_id)
        logger.info(
            "lead_updated",
            lead_id=str(lead_id),
            tenant_id=str(tenant_id),
            fields=list(update_data.keys()),
        )
        return lead

    # ------------------------------------------------------------------
    # delete_lead
    # ------------------------------------------------------------------

    async def delete_lead(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        lead_id: uuid.UUID,
    ) -> None:
        """Hard-delete a Lead.  Cascades to FK-linked rows as per schema."""
        lead = await self.get_lead(db, tenant_id, lead_id)
        await db.delete(lead)
        await db.flush()
        logger.info(
            "lead_deleted",
            lead_id=str(lead_id),
            tenant_id=str(tenant_id),
        )

    # ------------------------------------------------------------------
    # convert_to_deal
    # ------------------------------------------------------------------

    async def convert_to_deal(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        lead_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Deal:
        """Convert a Lead to a Deal.

        Steps:
          1. Fetch the Lead — must belong to tenant and not already converted.
          2. Fetch the first DealStatus for this tenant (default pipeline start).
          3. Create a Deal row with a snapshot of the Lead's contact data.
          4. Set Lead.converted = True.
          5. Flush — return the new Deal.
        """
        lead = await self.get_lead(db, tenant_id, lead_id)

        if lead.converted:
            raise BadRequestError(f"Lead {lead_id} is already converted")

        # Resolve the default deal status (lowest position for this tenant)
        status_result = await db.execute(
            select(DealStatus)
            .where(DealStatus.tenant_id == tenant_id)
            .order_by(DealStatus.position.asc())
            .limit(1)
        )
        deal_status = status_result.scalar_one_or_none()
        if not deal_status:
            raise BadRequestError(
                "No DealStatus configured for this tenant — "
                "create at least one deal pipeline stage before converting leads"
            )

        deal = Deal(
            tenant_id=tenant_id,
            created_by_id=user_id,
            lead_id=lead.id,
            status_id=deal_status.id,
            deal_owner_id=lead.lead_owner_id,
            organization_id=lead.organization_id,
            # Contact snapshot
            salutation=lead.salutation,
            first_name=lead.first_name,
            last_name=lead.last_name,
            lead_name=lead.lead_name,
            email=lead.email,
            mobile_no=lead.mobile_no,
            phone=lead.phone,
            job_title=lead.job_title,
            gender=lead.gender,
            # Organisation snapshot
            organization_name=lead.organization_name,
            no_of_employees=lead.no_of_employees,
            annual_revenue=lead.annual_revenue,
            website=lead.website,
            currency=lead.currency,
            # Classification carry-over
            source_id=lead.source_id,
            territory_id=lead.territory_id,
            industry_id=lead.industry_id,
        )

        # Mark lead as converted
        lead.converted = True

        db.add(deal)
        await db.flush()

        logger.info(
            "lead_converted_to_deal",
            lead_id=str(lead_id),
            deal_id=str(deal.id),
            tenant_id=str(tenant_id),
        )
        return deal

    # ------------------------------------------------------------------
    # assign_lead
    # ------------------------------------------------------------------

    async def assign_lead(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        lead_id: uuid.UUID,
        assignee_id: uuid.UUID,
        assigner_id: uuid.UUID,
    ) -> Assignment:
        """Assign a Lead to a user.

        If an open Assignment for the same lead+user already exists, return it
        unchanged (idempotent).  Otherwise create a new one.
        """
        # Verify lead exists and belongs to tenant
        await self.get_lead(db, tenant_id, lead_id)

        # Check for existing open assignment
        existing_result = await db.execute(
            select(Assignment).where(
                Assignment.tenant_id == tenant_id,
                Assignment.doctype == "Lead",
                Assignment.docname == lead_id,
                Assignment.assigned_to_id == assignee_id,
                Assignment.status == "Open",
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            return existing

        assignment = Assignment(
            tenant_id=tenant_id,
            doctype="Lead",
            docname=lead_id,
            assigned_to_id=assignee_id,
            assigned_by_id=assigner_id,
            status="Open",
        )
        db.add(assignment)
        await db.flush()

        logger.info(
            "lead_assigned",
            lead_id=str(lead_id),
            assignee_id=str(assignee_id),
            tenant_id=str(tenant_id),
        )
        return assignment

    # ------------------------------------------------------------------
    # remove_assignment
    # ------------------------------------------------------------------

    async def remove_assignment(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        lead_id: uuid.UUID,
        assignee_id: uuid.UUID,
    ) -> None:
        """Cancel open assignments of `assignee_id` on `lead_id`."""
        # Verify lead exists and belongs to tenant
        await self.get_lead(db, tenant_id, lead_id)

        await db.execute(
            update(Assignment)
            .where(
                Assignment.tenant_id == tenant_id,
                Assignment.doctype == "Lead",
                Assignment.docname == lead_id,
                Assignment.assigned_to_id == assignee_id,
                Assignment.status == "Open",
            )
            .values(status="Cancelled")
        )
        await db.flush()
        logger.info(
            "lead_assignment_removed",
            lead_id=str(lead_id),
            assignee_id=str(assignee_id),
            tenant_id=str(tenant_id),
        )

    # ------------------------------------------------------------------
    # bulk_delete
    # ------------------------------------------------------------------

    async def bulk_delete(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        lead_ids: list[uuid.UUID],
    ) -> int:
        """Delete multiple Leads by PK list, scoped to tenant.

        Returns the count of actually deleted rows (may be less than len(lead_ids)
        if some IDs do not exist or belong to a different tenant).
        """
        if not lead_ids:
            return 0

        result = await db.execute(
            delete(Lead)
            .where(
                Lead.tenant_id == tenant_id,
                Lead.id.in_(lead_ids),
            )
            .returning(Lead.id)
        )
        deleted_ids = result.fetchall()
        deleted_count = len(deleted_ids)

        await db.flush()
        logger.info(
            "leads_bulk_deleted",
            requested=len(lead_ids),
            deleted=deleted_count,
            tenant_id=str(tenant_id),
        )
        return deleted_count


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# If you need per-request state, instantiate in a FastAPI Depends factory.
# ---------------------------------------------------------------------------

lead_service = LeadService()
