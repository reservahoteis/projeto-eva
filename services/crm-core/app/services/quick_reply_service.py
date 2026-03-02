"""QuickReplyService — business logic for the QuickReply resource.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query that touches QuickReply rows MUST include tenant_id in the
    WHERE clause to enforce strict multi-tenant data isolation.
  - Shortcuts must be unique per tenant — create/update both enforce this
    constraint via an explicit pre-check that raises ConflictError before the
    DB unique constraint fires, giving the caller a clean 409 with a human-
    readable message instead of an opaque IntegrityError.
  - Results are ordered by category asc (NULLs last), order asc, title asc so
    the picker UI can render categories without client-side sorting.
  - db.flush() (not commit) is used in all write methods so the surrounding
    request transaction can be rolled back by the session middleware on error.
  - The module-level singleton `quick_reply_service = QuickReplyService()` is
    the canonical import for use in routers.
"""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError
from app.models.quick_reply import QuickReply
from app.schemas.lead import PaginatedResponse
from app.schemas.quick_reply import (
    QuickReplyCreate,
    QuickReplyListItem,
    QuickReplyListParams,
    QuickReplyUpdate,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _base_query(tenant_id: uuid.UUID):
    """SELECT with eager-loaded relationships, always scoped to tenant_id."""
    return (
        select(QuickReply)
        .where(QuickReply.tenant_id == tenant_id)
        .options(selectinload(QuickReply.created_by))
    )


def _apply_list_filters(query, params: QuickReplyListParams):
    """Append optional list filters to a base query in-place (functional style)."""
    if params.search:
        term = f"%{params.search}%"
        query = query.where(
            or_(
                QuickReply.title.ilike(term),
                QuickReply.shortcut.ilike(term),
                QuickReply.content.ilike(term),
            )
        )
    if params.category is not None:
        query = query.where(QuickReply.category == params.category)
    if params.is_active is not None:
        query = query.where(QuickReply.is_active == params.is_active)
    return query


# ---------------------------------------------------------------------------
# QuickReplyService
# ---------------------------------------------------------------------------


class QuickReplyService:
    """All business logic for QuickReplies, scoped to a single tenant per call."""

    # ------------------------------------------------------------------
    # list_quick_replies
    # ------------------------------------------------------------------

    async def list_quick_replies(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: QuickReplyListParams,
    ) -> PaginatedResponse[QuickReplyListItem]:
        """Return quick replies for a tenant with optional search/filter support.

        Default ordering: category asc (NULLs last), order asc, title asc.
        This lets the frontend group items by category without extra work.
        """
        base_query = _base_query(tenant_id)
        base_query = _apply_list_filters(base_query, params)

        # Count total matching rows before pagination
        count_query = (
            select(func.count())
            .select_from(QuickReply)
            .where(QuickReply.tenant_id == tenant_id)
        )
        count_query = _apply_list_filters(count_query, params)
        total_result = await db.execute(count_query)
        total_count = total_result.scalar_one()

        # Paginated data — category asc (NULLs last), order asc, title asc
        offset = (params.page - 1) * params.page_size
        data_query = (
            base_query
            .order_by(
                QuickReply.category.asc().nulls_last(),
                QuickReply.order.asc(),
                QuickReply.title.asc(),
            )
            .offset(offset)
            .limit(params.page_size)
        )

        rows = await db.execute(data_query)
        items = rows.scalars().all()

        return PaginatedResponse[QuickReplyListItem](
            data=[QuickReplyListItem.model_validate(item) for item in items],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    # ------------------------------------------------------------------
    # get_quick_reply
    # ------------------------------------------------------------------

    async def get_quick_reply(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        qr_id: uuid.UUID,
    ) -> QuickReply:
        """Fetch a single QuickReply by PK, strictly scoped to tenant_id."""
        result = await db.execute(
            _base_query(tenant_id).where(QuickReply.id == qr_id)
        )
        qr = result.scalar_one_or_none()
        if not qr:
            raise NotFoundError(f"QuickReply {qr_id} not found")
        return qr

    # ------------------------------------------------------------------
    # _check_shortcut_unique
    # ------------------------------------------------------------------

    async def _check_shortcut_unique(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        shortcut: str,
        exclude_id: uuid.UUID | None = None,
    ) -> None:
        """Raise ConflictError if the shortcut is already taken by another record.

        exclude_id allows the update path to skip the current record when
        checking uniqueness (so a PATCH that doesn't change the shortcut still passes).
        """
        query = select(QuickReply.id).where(
            QuickReply.tenant_id == tenant_id,
            QuickReply.shortcut == shortcut,
        )
        if exclude_id is not None:
            query = query.where(QuickReply.id != exclude_id)

        result = await db.execute(query)
        if result.scalar_one_or_none():
            raise ConflictError(
                f"Shortcut '{shortcut}' is already in use by another quick reply in this tenant"
            )

    # ------------------------------------------------------------------
    # create_quick_reply
    # ------------------------------------------------------------------

    async def create_quick_reply(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: QuickReplyCreate,
        user_id: uuid.UUID,
    ) -> QuickReply:
        """Create a new QuickReply scoped to tenant_id.

        Raises ConflictError if the shortcut is already taken.
        created_by_id is always set from the authenticated user.
        """
        await self._check_shortcut_unique(db, tenant_id, data.shortcut)

        qr = QuickReply(
            tenant_id=tenant_id,
            created_by_id=user_id,
            title=data.title,
            shortcut=data.shortcut,
            content=data.content,
            category=data.category,
            order=data.order,
        )

        db.add(qr)
        await db.flush()  # populate qr.id

        # Reload with relationships eager-loaded
        qr = await self.get_quick_reply(db, tenant_id, qr.id)
        logger.info(
            "quick_reply_created",
            qr_id=str(qr.id),
            tenant_id=str(tenant_id),
            shortcut=data.shortcut,
            title=data.title,
        )
        return qr

    # ------------------------------------------------------------------
    # update_quick_reply
    # ------------------------------------------------------------------

    async def update_quick_reply(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        qr_id: uuid.UUID,
        data: QuickReplyUpdate,
    ) -> QuickReply:
        """Partial update of a QuickReply.  Only non-None fields are applied.

        If the shortcut is being changed, uniqueness within the tenant is
        verified before persisting.
        """
        qr = await self.get_quick_reply(db, tenant_id, qr_id)

        update_data = data.model_dump(exclude_none=True)

        # Validate shortcut uniqueness only when it is actually changing
        if "shortcut" in update_data and update_data["shortcut"] != qr.shortcut:
            await self._check_shortcut_unique(
                db, tenant_id, update_data["shortcut"], exclude_id=qr_id
            )

        for field, value in update_data.items():
            setattr(qr, field, value)

        await db.flush()

        qr = await self.get_quick_reply(db, tenant_id, qr_id)
        logger.info(
            "quick_reply_updated",
            qr_id=str(qr_id),
            tenant_id=str(tenant_id),
            fields=list(update_data.keys()),
        )
        return qr

    # ------------------------------------------------------------------
    # delete_quick_reply
    # ------------------------------------------------------------------

    async def delete_quick_reply(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        qr_id: uuid.UUID,
    ) -> None:
        """Hard-delete a QuickReply scoped to tenant_id."""
        qr = await self.get_quick_reply(db, tenant_id, qr_id)
        await db.delete(qr)
        await db.flush()
        logger.info(
            "quick_reply_deleted",
            qr_id=str(qr_id),
            tenant_id=str(tenant_id),
        )


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

quick_reply_service = QuickReplyService()
