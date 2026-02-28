"""OrganizationService — business logic for the Organization resource.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query that touches Organization rows MUST include tenant_id in the
    WHERE clause to enforce strict multi-tenant data isolation.
  - organization_name is UNIQUE per tenant (enforced by a partial index in the
    schema).  The service checks for conflicts explicitly before INSERT/UPDATE
    to provide a clear ConflictError rather than a raw DB integrity error.
  - Filtering supports equality filters via the `filters` dict from
    OrganizationListParams.  The `search` parameter performs a case-insensitive
    ILIKE across organization_name and website.
  - Use db.flush() not db.commit() — the caller owns the transaction lifecycle.
"""

from __future__ import annotations

import uuid
from typing import Any

import structlog
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models.organization import Organization
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationListItem,
    OrganizationListParams,
    OrganizationUpdate,
    PaginatedResponse,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Column whitelist — prevents SQL injection through dynamic ORDER BY / filters
# ---------------------------------------------------------------------------

_ORG_COLUMNS: frozenset[str] = frozenset(
    {
        "id",
        "tenant_id",
        "organization_name",
        "logo_url",
        "website",
        "no_of_employees",
        "annual_revenue",
        "industry_id",
        "territory_id",
        "address",
        "created_at",
        "updated_at",
    }
)


def _validate_column(name: str) -> None:
    """Raise BadRequestError if `name` is not a known Organization column."""
    if name not in _ORG_COLUMNS:
        raise BadRequestError(f"Unknown filter / sort field: {name!r}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_org_query(tenant_id: uuid.UUID):
    """Base SELECT with eager-loaded relationships for full Organization responses."""
    return (
        select(Organization)
        .where(Organization.tenant_id == tenant_id)
        .options(
            selectinload(Organization.industry),
            selectinload(Organization.territory),
        )
    )


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
        col = getattr(Organization, field)
        if value is None:
            query = query.where(col.is_(None))
        elif isinstance(value, list):
            query = query.where(col.in_(value))
        else:
            query = query.where(col == value)
    return query


def _apply_search(query, search: str | None):
    """Append ILIKE search across organization_name and website."""
    if not search:
        return query
    pattern = f"%{search}%"
    query = query.where(
        or_(
            Organization.organization_name.ilike(pattern),
            Organization.website.ilike(pattern),
        )
    )
    return query


def _apply_ordering(query, order_by: str):
    """Append ORDER BY clauses from a comma-separated 'field dir' string."""
    tokens = [t.strip() for t in order_by.split(",") if t.strip()]
    for token in tokens:
        parts = token.split()
        field = parts[0]
        direction = parts[1].lower() if len(parts) == 2 else "asc"
        _validate_column(field)
        col = getattr(Organization, field)
        query = query.order_by(col.desc() if direction == "desc" else col.asc())
    return query


async def _check_name_conflict(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    organization_name: str,
    exclude_id: uuid.UUID | None = None,
) -> None:
    """Raise ConflictError if the organization name already exists for this tenant.

    Pass `exclude_id` when updating so the current record's own name is not
    considered a conflict.
    """
    stmt = select(Organization.id).where(
        Organization.tenant_id == tenant_id,
        Organization.organization_name == organization_name,
    )
    if exclude_id is not None:
        stmt = stmt.where(Organization.id != exclude_id)

    result = await db.execute(stmt)
    existing_id = result.scalar_one_or_none()
    if existing_id is not None:
        raise ConflictError(
            f"Organization with name {organization_name!r} already exists for this tenant"
        )


# ---------------------------------------------------------------------------
# OrganizationService
# ---------------------------------------------------------------------------


class OrganizationService:
    """All business logic for Organizations, scoped to a single tenant per call."""

    # ------------------------------------------------------------------
    # list_organizations
    # ------------------------------------------------------------------

    async def list_organizations(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: OrganizationListParams,
    ) -> PaginatedResponse[OrganizationListItem]:
        """Return a paginated list of Organizations for the given tenant."""
        base_query = _build_org_query(tenant_id)
        base_query = _apply_filters(base_query, params.filters)
        base_query = _apply_search(base_query, params.search)

        # Count total matching rows (before pagination)
        count_query = (
            select(func.count())
            .select_from(Organization)
            .where(Organization.tenant_id == tenant_id)
        )
        count_query = _apply_filters(count_query, params.filters)
        count_query = _apply_search(count_query, params.search)

        total_result = await db.execute(count_query)
        total_count = total_result.scalar_one()

        # Paginated data
        data_query = _apply_ordering(base_query, params.order_by)
        offset = (params.page - 1) * params.page_size
        data_query = data_query.offset(offset).limit(params.page_size)

        rows = await db.execute(data_query)
        orgs = rows.scalars().all()

        return PaginatedResponse[OrganizationListItem](
            data=[OrganizationListItem.model_validate(org) for org in orgs],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    # ------------------------------------------------------------------
    # get_organization
    # ------------------------------------------------------------------

    async def get_organization(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> Organization:
        """Fetch a single Organization by PK, scoped to tenant_id."""
        result = await db.execute(
            _build_org_query(tenant_id).where(Organization.id == organization_id)
        )
        org = result.scalar_one_or_none()
        if not org:
            raise NotFoundError(f"Organization {organization_id} not found")
        return org

    # ------------------------------------------------------------------
    # create_organization
    # ------------------------------------------------------------------

    async def create_organization(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: OrganizationCreate,
    ) -> Organization:
        """Create a new Organization.

        Checks for a name conflict within the tenant before inserting to provide
        a clear ConflictError rather than a raw DB integrity error.
        """
        await _check_name_conflict(db, tenant_id, data.organization_name)

        org = Organization(
            tenant_id=tenant_id,
            organization_name=data.organization_name,
            logo_url=data.logo_url,
            website=data.website,
            no_of_employees=data.no_of_employees,
            annual_revenue=data.annual_revenue,
            industry_id=data.industry_id,
            territory_id=data.territory_id,
            address=data.address,
        )

        db.add(org)
        await db.flush()  # populate org.id

        # Reload with relationships
        org = await self.get_organization(db, tenant_id, org.id)
        logger.info(
            "organization_created",
            organization_id=str(org.id),
            tenant_id=str(tenant_id),
            organization_name=data.organization_name,
        )
        return org

    # ------------------------------------------------------------------
    # update_organization
    # ------------------------------------------------------------------

    async def update_organization(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        organization_id: uuid.UUID,
        data: OrganizationUpdate,
    ) -> Organization:
        """Partial update of an Organization.

        Checks for a name conflict on rename (excludes current record).
        """
        org = await self.get_organization(db, tenant_id, organization_id)

        # Apply only non-None fields from the patch payload
        update_data = data.model_dump(exclude_none=True)

        # If renaming, check uniqueness per tenant
        new_name = update_data.get("organization_name")
        if new_name and new_name != org.organization_name:
            await _check_name_conflict(
                db, tenant_id, new_name, exclude_id=organization_id
            )

        for field, value in update_data.items():
            setattr(org, field, value)

        await db.flush()

        org = await self.get_organization(db, tenant_id, organization_id)
        logger.info(
            "organization_updated",
            organization_id=str(organization_id),
            tenant_id=str(tenant_id),
            fields=list(update_data.keys()),
        )
        return org

    # ------------------------------------------------------------------
    # delete_organization
    # ------------------------------------------------------------------

    async def delete_organization(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> None:
        """Hard-delete an Organization.  Cascades to FK-linked rows as per schema."""
        org = await self.get_organization(db, tenant_id, organization_id)
        await db.delete(org)
        await db.flush()
        logger.info(
            "organization_deleted",
            organization_id=str(organization_id),
            tenant_id=str(tenant_id),
        )

    # ------------------------------------------------------------------
    # bulk_delete
    # ------------------------------------------------------------------

    async def bulk_delete(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        organization_ids: list[uuid.UUID],
    ) -> int:
        """Delete multiple Organizations by PK list, scoped to tenant.

        Returns the count of actually deleted rows (may be less than
        len(organization_ids) if some IDs do not exist or belong to a
        different tenant).
        """
        if not organization_ids:
            return 0

        result = await db.execute(
            delete(Organization)
            .where(
                Organization.tenant_id == tenant_id,
                Organization.id.in_(organization_ids),
            )
            .returning(Organization.id)
        )
        deleted_ids = result.fetchall()
        deleted_count = len(deleted_ids)

        await db.flush()
        logger.info(
            "organizations_bulk_deleted",
            requested=len(organization_ids),
            deleted=deleted_count,
            tenant_id=str(tenant_id),
        )
        return deleted_count


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

organization_service = OrganizationService()
