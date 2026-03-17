"""TagService — business logic for the Tag resource.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query that touches Tag rows MUST include tenant_id in the WHERE
    clause to enforce strict multi-tenant data isolation.
  - Tag names are unique per tenant — create and update both check for
    duplicates and raise ConflictError when the constraint would be violated.
  - db.flush() (not commit) is used in all write methods so the surrounding
    request transaction can be rolled back by the session middleware on error.
  - The module-level singleton `tag_service = TagService()` is the canonical
    import for use in routers.
"""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.tag import Tag
from app.schemas.lead import PaginatedResponse
from app.schemas.tag import (
    TagCreate,
    TagListItem,
    TagListParams,
    TagUpdate,
)

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _escape_ilike(value: str) -> str:
    """Escape ILIKE special characters (%, _, \\) to prevent wildcard injection."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _build_tag_query(tenant_id: uuid.UUID):
    """Base SELECT scoped to tenant."""
    return select(Tag).where(Tag.tenant_id == tenant_id)


async def _check_name_conflict(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    name: str,
    exclude_id: uuid.UUID | None = None,
) -> None:
    """Raise ConflictError when another tag with the same name already exists.

    Pass exclude_id on updates to allow the tag to keep its own current name.
    """
    query = select(Tag).where(
        Tag.tenant_id == tenant_id,
        func.lower(Tag.name) == name.lower(),
    )
    if exclude_id is not None:
        query = query.where(Tag.id != exclude_id)

    result = await db.execute(query)
    existing = result.scalar_one_or_none()
    if existing:
        raise ConflictError(f"A tag named '{name}' already exists for this tenant")


# ---------------------------------------------------------------------------
# TagService
# ---------------------------------------------------------------------------


class TagService:
    """All business logic for Tags, scoped to a single tenant per call."""

    # ------------------------------------------------------------------
    # list_tags
    # ------------------------------------------------------------------

    async def list_tags(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: TagListParams,
    ) -> PaginatedResponse[TagListItem]:
        """Return tags for a tenant, with optional name search.

        Results are ordered alphabetically by name.
        """
        base_query = _build_tag_query(tenant_id)

        if params.search:
            safe_term = f"%{_escape_ilike(params.search)}%"
            base_query = base_query.where(
                Tag.name.ilike(safe_term)
            )

        # Count total matching rows before pagination
        count_query = (
            select(func.count())
            .select_from(Tag)
            .where(Tag.tenant_id == tenant_id)
        )
        if params.search:
            safe_term = f"%{_escape_ilike(params.search)}%"
            count_query = count_query.where(Tag.name.ilike(safe_term))

        total_result = await db.execute(count_query)
        total_count = total_result.scalar_one()

        # Paginated data — alphabetical order
        offset = (params.page - 1) * params.page_size
        data_query = (
            base_query.order_by(Tag.name.asc())
            .offset(offset)
            .limit(params.page_size)
        )

        rows = await db.execute(data_query)
        tags = rows.scalars().all()

        return PaginatedResponse[TagListItem](
            data=[TagListItem.model_validate(tag) for tag in tags],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    # ------------------------------------------------------------------
    # get_tag
    # ------------------------------------------------------------------

    async def get_tag(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        tag_id: uuid.UUID,
    ) -> Tag:
        """Fetch a single Tag by PK, scoped to tenant_id."""
        result = await db.execute(
            _build_tag_query(tenant_id).where(Tag.id == tag_id)
        )
        tag = result.scalar_one_or_none()
        if not tag:
            raise NotFoundError(f"Tag {tag_id} not found")
        return tag

    # ------------------------------------------------------------------
    # create_tag
    # ------------------------------------------------------------------

    async def create_tag(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: TagCreate,
    ) -> Tag:
        """Create a new Tag scoped to tenant_id.

        Raises ConflictError when a tag with the same name already exists
        for this tenant.
        """
        await _check_name_conflict(db, tenant_id, data.name)

        tag = Tag(
            tenant_id=tenant_id,
            name=data.name,
            color=data.color,
        )

        db.add(tag)
        try:
            await db.flush()  # populate tag.id
        except IntegrityError:
            await db.rollback()
            raise ConflictError(f"A tag named '{data.name}' already exists for this tenant")

        # Reload to return a clean, fully populated instance
        tag = await self.get_tag(db, tenant_id, tag.id)
        logger.info(
            "tag_created",
            tag_id=str(tag.id),
            tenant_id=str(tenant_id),
            name=data.name,
        )
        return tag

    # ------------------------------------------------------------------
    # update_tag
    # ------------------------------------------------------------------

    async def update_tag(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        tag_id: uuid.UUID,
        data: TagUpdate,
    ) -> Tag:
        """Partial update of a Tag.  Only non-None fields are applied.

        Raises ConflictError when the new name collides with an existing tag.
        """
        tag = await self.get_tag(db, tenant_id, tag_id)

        update_data = data.model_dump(exclude_none=True)

        if "name" in update_data and update_data["name"] != tag.name:
            await _check_name_conflict(db, tenant_id, update_data["name"], exclude_id=tag_id)

        for field, value in update_data.items():
            setattr(tag, field, value)

        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            raise ConflictError(f"A tag with that name already exists for this tenant")

        tag = await self.get_tag(db, tenant_id, tag_id)
        logger.info(
            "tag_updated",
            tag_id=str(tag_id),
            tenant_id=str(tenant_id),
            fields=list(update_data.keys()),
        )
        return tag

    # ------------------------------------------------------------------
    # delete_tag
    # ------------------------------------------------------------------

    async def delete_tag(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        tag_id: uuid.UUID,
    ) -> None:
        """Hard-delete a Tag scoped to tenant_id."""
        tag = await self.get_tag(db, tenant_id, tag_id)
        await db.delete(tag)
        await db.flush()
        logger.info(
            "tag_deleted",
            tag_id=str(tag_id),
            tenant_id=str(tenant_id),
        )


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

tag_service = TagService()
