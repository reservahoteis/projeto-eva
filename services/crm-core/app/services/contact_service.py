"""ContactService — business logic for the Contact resource.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query that touches Contact rows MUST include tenant_id in the WHERE
    clause to enforce strict multi-tenant data isolation.
  - full_name is computed at write time from salutation + first_name + last_name
    and stored as a denormalised column for fast search/display.
  - Filtering supports equality filters via the `filters` dict from
    ContactListParams.  The `search` parameter performs a case-insensitive
    ILIKE across first_name, last_name, email, and company_name.
  - Use db.flush() not db.commit() — the caller (FastAPI route via get_db
    context manager) owns the transaction lifecycle.
"""

from __future__ import annotations

import uuid
from typing import Any

import structlog
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.contact import Contact
from app.schemas.contact import (
    BulkDeleteRequest,
    ContactCreate,
    ContactListItem,
    ContactListParams,
    ContactUpdate,
    PaginatedResponse,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Column whitelist — prevents SQL injection through dynamic ORDER BY / filters
# ---------------------------------------------------------------------------

_CONTACT_COLUMNS: frozenset[str] = frozenset(
    {
        "id",
        "tenant_id",
        "salutation",
        "first_name",
        "last_name",
        "full_name",
        "gender",
        "image_url",
        "email",
        "mobile_no",
        "phone",
        "company_name",
        "designation",
        "industry_id",
        "territory_id",
        "created_at",
        "updated_at",
    }
)


def _validate_column(name: str) -> None:
    """Raise BadRequestError if `name` is not a known Contact column."""
    if name not in _CONTACT_COLUMNS:
        raise BadRequestError(f"Unknown filter / sort field: {name!r}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_contact_query(tenant_id: uuid.UUID):
    """Base SELECT with eager-loaded relationships for full Contact responses."""
    return (
        select(Contact)
        .where(Contact.tenant_id == tenant_id)
        .options(
            selectinload(Contact.industry),
            selectinload(Contact.territory),
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
        col = getattr(Contact, field)
        if value is None:
            query = query.where(col.is_(None))
        elif isinstance(value, list):
            query = query.where(col.in_(value))
        else:
            query = query.where(col == value)
    return query


def _apply_search(query, search: str | None):
    """Append ILIKE search across first_name, last_name, email, company_name."""
    if not search:
        return query
    pattern = f"%{search}%"
    query = query.where(
        or_(
            Contact.first_name.ilike(pattern),
            Contact.last_name.ilike(pattern),
            Contact.full_name.ilike(pattern),
            Contact.email.ilike(pattern),
            Contact.company_name.ilike(pattern),
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
        col = getattr(Contact, field)
        query = query.order_by(col.desc() if direction == "desc" else col.asc())
    return query


def _compute_full_name(
    salutation: str | None,
    first_name: str,
    last_name: str | None,
) -> str:
    """Compute the full_name display string from name components."""
    parts = [p for p in (salutation, first_name, last_name) if p]
    return " ".join(parts)


# ---------------------------------------------------------------------------
# ContactService
# ---------------------------------------------------------------------------


class ContactService:
    """All business logic for Contacts, scoped to a single tenant per call."""

    # ------------------------------------------------------------------
    # list_contacts
    # ------------------------------------------------------------------

    async def list_contacts(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: ContactListParams,
    ) -> PaginatedResponse[ContactListItem]:
        """Return a paginated list of Contacts for the given tenant."""
        base_query = _build_contact_query(tenant_id)
        base_query = _apply_filters(base_query, params.filters)
        base_query = _apply_search(base_query, params.search)

        # Count total matching rows (before pagination)
        count_query = (
            select(func.count())
            .select_from(Contact)
            .where(Contact.tenant_id == tenant_id)
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
        contacts = rows.scalars().all()

        return PaginatedResponse[ContactListItem](
            data=[ContactListItem.model_validate(contact) for contact in contacts],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    # ------------------------------------------------------------------
    # get_contact
    # ------------------------------------------------------------------

    async def get_contact(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        contact_id: uuid.UUID,
    ) -> Contact:
        """Fetch a single Contact by PK, scoped to tenant_id."""
        result = await db.execute(
            _build_contact_query(tenant_id).where(Contact.id == contact_id)
        )
        contact = result.scalar_one_or_none()
        if not contact:
            raise NotFoundError(f"Contact {contact_id} not found")
        return contact

    # ------------------------------------------------------------------
    # create_contact
    # ------------------------------------------------------------------

    async def create_contact(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: ContactCreate,
    ) -> Contact:
        """Create a new Contact.  Computes full_name from name components."""
        full_name = _compute_full_name(
            data.salutation, data.first_name, data.last_name
        )

        contact = Contact(
            tenant_id=tenant_id,
            full_name=full_name,
            # Identity
            salutation=data.salutation,
            first_name=data.first_name,
            last_name=data.last_name,
            gender=data.gender,
            # Channels
            email=str(data.email) if data.email else None,
            mobile_no=data.mobile_no,
            phone=data.phone,
            # Professional
            company_name=data.company_name,
            designation=data.designation,
            image_url=data.image_url,
            # Classification
            industry_id=data.industry_id,
            territory_id=data.territory_id,
        )

        db.add(contact)
        await db.flush()  # populate contact.id

        # Reload with relationships
        contact = await self.get_contact(db, tenant_id, contact.id)
        logger.info(
            "contact_created",
            contact_id=str(contact.id),
            tenant_id=str(tenant_id),
            full_name=full_name,
        )
        return contact

    # ------------------------------------------------------------------
    # update_contact
    # ------------------------------------------------------------------

    async def update_contact(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        contact_id: uuid.UUID,
        data: ContactUpdate,
    ) -> Contact:
        """Partial update of a Contact.  Recomputes full_name on name changes."""
        contact = await self.get_contact(db, tenant_id, contact_id)

        # Apply only non-None fields from the patch payload
        update_data = data.model_dump(exclude_none=True)

        # Recompute full_name if any name component changes
        name_fields = {"salutation", "first_name", "last_name"}
        if name_fields & update_data.keys():
            contact.full_name = _compute_full_name(
                salutation=update_data.get("salutation", contact.salutation),
                first_name=update_data.get("first_name", contact.first_name),
                last_name=update_data.get("last_name", contact.last_name),
            )

        for field, value in update_data.items():
            if field == "email" and value is not None:
                # EmailStr is a special type — convert to plain str for the model
                value = str(value)
            setattr(contact, field, value)

        await db.flush()

        contact = await self.get_contact(db, tenant_id, contact_id)
        logger.info(
            "contact_updated",
            contact_id=str(contact_id),
            tenant_id=str(tenant_id),
            fields=list(update_data.keys()),
        )
        return contact

    # ------------------------------------------------------------------
    # delete_contact
    # ------------------------------------------------------------------

    async def delete_contact(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        contact_id: uuid.UUID,
    ) -> None:
        """Hard-delete a Contact.  Cascades to FK-linked rows as per schema."""
        contact = await self.get_contact(db, tenant_id, contact_id)
        await db.delete(contact)
        await db.flush()
        logger.info(
            "contact_deleted",
            contact_id=str(contact_id),
            tenant_id=str(tenant_id),
        )

    # ------------------------------------------------------------------
    # bulk_delete
    # ------------------------------------------------------------------

    async def bulk_delete(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        contact_ids: list[uuid.UUID],
    ) -> int:
        """Delete multiple Contacts by PK list, scoped to tenant.

        Returns the count of actually deleted rows (may be less than
        len(contact_ids) if some IDs do not exist or belong to a different
        tenant).
        """
        if not contact_ids:
            return 0

        result = await db.execute(
            delete(Contact)
            .where(
                Contact.tenant_id == tenant_id,
                Contact.id.in_(contact_ids),
            )
            .returning(Contact.id)
        )
        deleted_ids = result.fetchall()
        deleted_count = len(deleted_ids)

        await db.flush()
        logger.info(
            "contacts_bulk_deleted",
            requested=len(contact_ids),
            deleted=deleted_count,
            tenant_id=str(tenant_id),
        )
        return deleted_count


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

contact_service = ContactService()
