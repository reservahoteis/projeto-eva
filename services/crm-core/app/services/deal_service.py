"""Deal business-logic service.

All public methods are async and accept an ``AsyncSession`` as their first
database argument.  Every query is scoped to ``tenant_id`` — no global reads.

Naming series format: ``CRM-DEAL-{year}-{seq:04d}``
  e.g.  CRM-DEAL-2026-0001
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Any

import structlog
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.assignment import Assignment
from app.models.deal import Deal
from app.models.lookups import DealStatus
from app.schemas.deal import (
    AssignRequest,
    BulkDeleteRequest,
    DealCreate,
    DealListItem,
    DealUpdate,
    MarkLostRequest,
    PaginatedDeals,
)
from app.schemas.lead import (
    GroupByBucket,
    GroupByResponse,
    KanbanColumn,
    KanbanResponse,
)

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------


async def _get_or_404(db: AsyncSession, tenant_id: uuid.UUID, deal_id: uuid.UUID) -> Deal:
    """Fetch a Deal by (tenant_id, deal_id) or raise NotFoundError."""
    result = await db.execute(
        select(Deal).where(
            Deal.tenant_id == tenant_id,
            Deal.id == deal_id,
        )
    )
    deal = result.scalar_one_or_none()
    if deal is None:
        raise NotFoundError(f"Deal {deal_id} not found")
    return deal


async def _next_naming_series(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """Generate the next sequential naming series for this tenant in the current year.

    Pattern: CRM-DEAL-{year}-{seq:04d}

    Uses a COUNT of existing deals within the current calendar year plus 1 to
    derive the sequence number.  This is intentionally simple — a proper
    implementation would use a database sequence or advisory lock for
    high-concurrency scenarios.
    """
    year = datetime.now(UTC).year
    prefix = f"CRM-DEAL-{year}-"

    count_result = await db.execute(
        select(func.count()).where(
            Deal.tenant_id == tenant_id,
            Deal.naming_series.like(f"{prefix}%"),
        )
    )
    seq: int = (count_result.scalar_one() or 0) + 1
    return f"{prefix}{seq:04d}"


# ---------------------------------------------------------------------------
# Query builder
# ---------------------------------------------------------------------------


def _build_deal_query(tenant_id: uuid.UUID):
    """Base SELECT with eager-loaded relationships for Deal list responses."""
    return (
        select(Deal)
        .where(Deal.tenant_id == tenant_id)
        .options(
            selectinload(Deal.status),
            selectinload(Deal.deal_owner),
            selectinload(Deal.organization),
        )
    )


# ---------------------------------------------------------------------------
# List query parameters (simple DTO — extend with filter fields as needed)
# ---------------------------------------------------------------------------


class DealListParams:
    """Query parameter bag for list_deals.

    The router constructs this from FastAPI Query() dependencies and passes it
    to the service so the service layer stays framework-agnostic.
    """

    def __init__(
        self,
        page: int = 1,
        page_size: int = 20,
        view_type: str = "list",
        column_field: str | None = None,
        group_by_field: str | None = None,
        order_by: str = "created_at desc",
        filters: dict | None = None,
        status_id: uuid.UUID | None = None,
        deal_owner_id: uuid.UUID | None = None,
        organization_id: uuid.UUID | None = None,
        search: str | None = None,
    ) -> None:
        self.page = max(1, page)
        self.page_size = min(max(1, page_size), 100)
        self.view_type = view_type
        self.column_field = column_field
        self.group_by_field = group_by_field
        self.order_by = order_by
        self.filters = filters
        self.status_id = status_id
        self.deal_owner_id = deal_owner_id
        self.organization_id = organization_id
        self.search = search


# ---------------------------------------------------------------------------
# DealService
# ---------------------------------------------------------------------------


class DealService:
    """Encapsulates all deal CRUD and workflow operations."""

    # ------------------------------------------------------------------
    # list_deals
    # ------------------------------------------------------------------

    @staticmethod
    async def list_deals(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: DealListParams,
    ) -> PaginatedDeals | KanbanResponse[DealListItem] | GroupByResponse[DealListItem]:
        """Dispatch to list, kanban, or group_by based on params.view_type."""
        if params.view_type == "kanban":
            return await DealService._list_kanban(db, tenant_id, params)
        if params.view_type == "group_by":
            return await DealService._list_group_by(db, tenant_id, params)
        return await DealService._list_paginated(db, tenant_id, params)

    @staticmethod
    async def _list_paginated(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: DealListParams,
    ) -> PaginatedDeals:
        """Return a paginated list of DealListItem for the given tenant.

        Filters are additive (all applied with AND).
        """
        base_query = _build_deal_query(tenant_id)

        if params.status_id:
            base_query = base_query.where(Deal.status_id == params.status_id)
        if params.deal_owner_id:
            base_query = base_query.where(Deal.deal_owner_id == params.deal_owner_id)
        if params.organization_id:
            base_query = base_query.where(Deal.organization_id == params.organization_id)
        if params.search:
            term = f"%{params.search}%"
            base_query = base_query.where(
                Deal.lead_name.ilike(term)
                | Deal.organization_name.ilike(term)
                | Deal.email.ilike(term)
            )

        # Total count (separate query to avoid subquery complexity)
        count_result = await db.execute(
            select(func.count()).select_from(Deal).where(Deal.tenant_id == tenant_id)
        )
        total: int = count_result.scalar_one()

        # Paginated rows
        offset = (params.page - 1) * params.page_size
        rows_result = await db.execute(
            base_query.order_by(Deal.created_at.desc()).offset(offset).limit(params.page_size)
        )
        deals = rows_result.scalars().all()

        total_pages = max(1, -(-total // params.page_size))  # ceiling division

        items = [DealListItem.model_validate(d) for d in deals]

        logger.debug(
            "deal.list",
            tenant_id=str(tenant_id),
            total=total,
            page=params.page,
            page_size=params.page_size,
        )

        return PaginatedDeals(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            total_pages=total_pages,
        )

    @staticmethod
    async def _list_kanban(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: DealListParams,
    ) -> KanbanResponse[DealListItem]:
        """Group deals by column_field into kanban columns.

        Fetches all matching deals (up to a safety cap), then groups in Python
        to avoid complex SQL PARTITION BY on the ORM layer while keeping
        N+1 queries away.
        """
        if not params.column_field:
            raise BadRequestError(
                "column_field is required when view_type is 'kanban'"
            )

        base_query = _build_deal_query(tenant_id).order_by(Deal.created_at.desc())

        # Safety cap: max 200 deals per column, 50 columns
        base_query = base_query.limit(200 * 50)

        rows = await db.execute(base_query)
        deals = rows.scalars().all()

        # Group by column_field value
        columns_map: dict[Any, list[Deal]] = {}
        for deal in deals:
            key = getattr(deal, params.column_field)
            columns_map.setdefault(key, []).append(deal)

        # Build KanbanColumn list — enrich with metadata from status if applicable
        kanban_columns: list[KanbanColumn[DealListItem]] = []
        for col_key, col_deals in columns_map.items():
            color = None
            position = None
            column_id: uuid.UUID | None = None
            column_value: str | None = None

            if params.column_field == "status_id" and col_deals:
                status = col_deals[0].status
                color = status.color
                position = status.position
                column_id = status.id
                column_value = status.label
            elif col_key is not None:
                column_id = col_key if isinstance(col_key, uuid.UUID) else None
                column_value = str(col_key)

            kanban_columns.append(
                KanbanColumn[DealListItem](
                    column_value=column_value,
                    column_id=column_id,
                    color=color,
                    position=position,
                    count=len(col_deals),
                    data=[DealListItem.model_validate(d) for d in col_deals],
                )
            )

        # Sort columns by position (kanban board order)
        kanban_columns.sort(key=lambda c: (c.position is None, c.position or 0))

        logger.debug(
            "deal.list_kanban",
            tenant_id=str(tenant_id),
            column_field=params.column_field,
            total=len(deals),
            columns=len(kanban_columns),
        )

        return KanbanResponse[DealListItem](
            columns=kanban_columns,
            total_count=len(deals),
        )

    @staticmethod
    async def _list_group_by(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: DealListParams,
    ) -> GroupByResponse[DealListItem]:
        """Aggregate deals into buckets by group_by_field."""
        if not params.group_by_field:
            raise BadRequestError(
                "group_by_field is required when view_type is 'group_by'"
            )

        base_query = _build_deal_query(tenant_id).order_by(Deal.created_at.desc())

        rows = await db.execute(base_query)
        deals = rows.scalars().all()

        buckets_map: dict[Any, list[Deal]] = {}
        for deal in deals:
            key = getattr(deal, params.group_by_field)
            buckets_map.setdefault(key, []).append(deal)

        buckets: list[GroupByBucket[DealListItem]] = []
        for grp_key, grp_deals in buckets_map.items():
            group_id = grp_key if isinstance(grp_key, uuid.UUID) else None
            buckets.append(
                GroupByBucket[DealListItem](
                    group_value=str(grp_key) if grp_key is not None else None,
                    group_id=group_id,
                    count=len(grp_deals),
                    data=[DealListItem.model_validate(d) for d in grp_deals],
                )
            )

        logger.debug(
            "deal.list_group_by",
            tenant_id=str(tenant_id),
            group_by_field=params.group_by_field,
            total=len(deals),
            buckets=len(buckets),
        )

        return GroupByResponse[DealListItem](
            buckets=buckets,
            total_count=len(deals),
        )

    # ------------------------------------------------------------------
    # get_deal
    # ------------------------------------------------------------------

    @staticmethod
    async def get_deal(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        deal_id: uuid.UUID,
    ) -> Deal:
        """Fetch a single Deal, raising 404 when not found."""
        return await _get_or_404(db, tenant_id, deal_id)

    # ------------------------------------------------------------------
    # create_deal
    # ------------------------------------------------------------------

    @staticmethod
    async def create_deal(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: DealCreate,
        user_id: uuid.UUID,
    ) -> Deal:
        """Persist a new Deal and return the created ORM instance.

        Validates that status_id belongs to the tenant before inserting.
        Generates naming_series automatically.
        """
        # Guard: status must exist and belong to this tenant
        status_result = await db.execute(
            select(DealStatus).where(
                DealStatus.id == data.status_id,
                DealStatus.tenant_id == tenant_id,
            )
        )
        if status_result.scalar_one_or_none() is None:
            raise BadRequestError(f"DealStatus {data.status_id} not found for this tenant")

        naming_series = await _next_naming_series(db, tenant_id)

        deal = Deal(
            tenant_id=tenant_id,
            naming_series=naming_series,
            created_by_id=user_id,
            # Associations
            status_id=data.status_id,
            organization_id=data.organization_id,
            lead_id=data.lead_id,
            deal_owner_id=data.deal_owner_id,
            contact_id=data.contact_id,
            # Pipeline metrics
            probability=data.probability,
            deal_value=data.deal_value,
            currency=data.currency,
            expected_closure_date=data.expected_closure_date,
            # Sales process
            next_step=data.next_step,
            # Classification
            source_id=data.source_id,
            territory_id=data.territory_id,
            # Contact snapshot
            salutation=data.salutation,
            first_name=data.first_name,
            last_name=data.last_name,
            lead_name=data.lead_name,
            email=data.email,
            mobile_no=data.mobile_no,
            phone=data.phone,
            job_title=data.job_title,
            # Organisation snapshot
            organization_name=data.organization_name,
        )

        db.add(deal)
        await db.flush()  # flush to get the generated PK before commit
        await db.refresh(deal)

        logger.info(
            "deal.created",
            tenant_id=str(tenant_id),
            deal_id=str(deal.id),
            naming_series=naming_series,
            created_by=str(user_id),
        )

        return deal

    # ------------------------------------------------------------------
    # update_deal
    # ------------------------------------------------------------------

    @staticmethod
    async def update_deal(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        deal_id: uuid.UUID,
        data: DealUpdate,
    ) -> Deal:
        """Apply partial updates to an existing Deal.

        Only fields present in the request payload (model_fields_set) are
        written — avoids overwriting fields the caller did not provide.

        When status_id changes, the previous status_id is logged for audit
        purposes (a full StatusChangeLog integration would go here).
        """
        deal = await _get_or_404(db, tenant_id, deal_id)

        previous_status_id: uuid.UUID | None = None

        for field_name in data.model_fields_set:
            new_value = getattr(data, field_name)

            if field_name == "status_id" and new_value is not None:
                # Validate the new status belongs to the tenant
                status_result = await db.execute(
                    select(DealStatus).where(
                        DealStatus.id == new_value,
                        DealStatus.tenant_id == tenant_id,
                    )
                )
                if status_result.scalar_one_or_none() is None:
                    raise BadRequestError(f"DealStatus {new_value} not found for this tenant")

                if deal.status_id != new_value:
                    previous_status_id = deal.status_id

            if field_name == "currency" and new_value is not None:
                new_value = new_value.upper()

            setattr(deal, field_name, new_value)

        await db.flush()
        await db.refresh(deal)

        log_ctx: dict[str, Any] = {
            "tenant_id": str(tenant_id),
            "deal_id": str(deal_id),
            "fields_updated": list(data.model_fields_set),
        }
        if previous_status_id:
            log_ctx["status_changed_from"] = str(previous_status_id)
            log_ctx["status_changed_to"] = str(deal.status_id)

        logger.info("deal.updated", **log_ctx)

        return deal

    # ------------------------------------------------------------------
    # delete_deal
    # ------------------------------------------------------------------

    @staticmethod
    async def delete_deal(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        deal_id: uuid.UUID,
    ) -> None:
        """Delete a single deal. Raises 404 when not found."""
        deal = await _get_or_404(db, tenant_id, deal_id)
        await db.delete(deal)
        await db.flush()

        logger.info("deal.deleted", tenant_id=str(tenant_id), deal_id=str(deal_id))

    # ------------------------------------------------------------------
    # bulk_delete
    # ------------------------------------------------------------------

    @staticmethod
    async def bulk_delete(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: BulkDeleteRequest,
    ) -> int:
        """Delete multiple deals in one statement.

        Returns the count of rows actually deleted (may be less than requested
        if some IDs were not found or belonged to a different tenant).
        """
        result = await db.execute(
            delete(Deal).where(
                Deal.tenant_id == tenant_id,
                Deal.id.in_(data.ids),
            )
        )
        deleted_count: int = result.rowcount

        logger.info(
            "deal.bulk_deleted",
            tenant_id=str(tenant_id),
            requested=len(data.ids),
            deleted=deleted_count,
        )

        return deleted_count

    # ------------------------------------------------------------------
    # mark_won
    # ------------------------------------------------------------------

    @staticmethod
    async def mark_won(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        deal_id: uuid.UUID,
    ) -> Deal:
        """Set the deal to the tenant's Won status and record closed_date=today.

        Won status is identified by status_type='Won' within this tenant.
        Raises BadRequestError if no Won status is configured.
        """
        deal = await _get_or_404(db, tenant_id, deal_id)

        won_result = await db.execute(
            select(DealStatus).where(
                DealStatus.tenant_id == tenant_id,
                DealStatus.status_type == "Won",
            )
        )
        won_status = won_result.scalar_one_or_none()
        if won_status is None:
            raise BadRequestError(
                "No DealStatus with status_type='Won' found for this tenant. "
                "Please configure one in the pipeline settings."
            )

        previous_status_id = deal.status_id
        deal.status_id = won_status.id
        deal.closed_date = date.today()

        await db.flush()
        await db.refresh(deal)

        logger.info(
            "deal.marked_won",
            tenant_id=str(tenant_id),
            deal_id=str(deal_id),
            previous_status_id=str(previous_status_id),
            won_status_id=str(won_status.id),
            closed_date=str(deal.closed_date),
        )

        return deal

    # ------------------------------------------------------------------
    # mark_lost
    # ------------------------------------------------------------------

    @staticmethod
    async def mark_lost(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        deal_id: uuid.UUID,
        data: MarkLostRequest,
    ) -> Deal:
        """Set the deal to the tenant's Lost status, recording reason + notes.

        Lost status is identified by status_type='Lost' within this tenant.
        Raises BadRequestError if no Lost status is configured.
        """
        deal = await _get_or_404(db, tenant_id, deal_id)

        lost_result = await db.execute(
            select(DealStatus).where(
                DealStatus.tenant_id == tenant_id,
                DealStatus.status_type == "Lost",
            )
        )
        lost_status = lost_result.scalar_one_or_none()
        if lost_status is None:
            raise BadRequestError(
                "No DealStatus with status_type='Lost' found for this tenant. "
                "Please configure one in the pipeline settings."
            )

        previous_status_id = deal.status_id
        deal.status_id = lost_status.id
        deal.closed_date = date.today()
        deal.lost_reason_id = data.reason_id
        deal.lost_notes = data.notes

        await db.flush()
        await db.refresh(deal)

        logger.info(
            "deal.marked_lost",
            tenant_id=str(tenant_id),
            deal_id=str(deal_id),
            previous_status_id=str(previous_status_id),
            lost_status_id=str(lost_status.id),
            reason_id=str(data.reason_id),
        )

        return deal

    # ------------------------------------------------------------------
    # assign_deal
    # ------------------------------------------------------------------

    @staticmethod
    async def assign_deal(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        deal_id: uuid.UUID,
        data: AssignRequest,
        assigner_id: uuid.UUID,
    ) -> Assignment:
        """Create an Assignment record linking a user to this deal.

        Also updates deal.deal_owner_id to the new assignee for fast
        denormalised reads on list views.
        """
        deal = await _get_or_404(db, tenant_id, deal_id)

        deal.deal_owner_id = data.assignee_id

        assignment = Assignment(
            tenant_id=tenant_id,
            doctype="Deal",
            docname=deal.id,
            assigned_to_id=data.assignee_id,
            assigned_by_id=assigner_id,
            status="Open",
        )
        db.add(assignment)

        await db.flush()
        await db.refresh(assignment)

        logger.info(
            "deal.assigned",
            tenant_id=str(tenant_id),
            deal_id=str(deal_id),
            assignee_id=str(data.assignee_id),
            assigner_id=str(assigner_id),
            assignment_id=str(assignment.id),
        )

        return assignment
