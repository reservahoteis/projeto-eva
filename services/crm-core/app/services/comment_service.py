"""CommentService — business logic for the Comment resource.

Comments are polymorphic — they attach to any CRM entity via
reference_doctype + reference_docname.

Authorization rules enforced here (not at the router level):
  - Only the original author (created_by_id == user_id) may update or delete
    their own comment.  ADMIN / MANAGER role override is not implemented here
    but can be added via an optional bypass flag.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query includes tenant_id in the WHERE clause.
  - Comments are loaded with their created_by relationship via selectinload.
  - db.flush() (not commit) — session lifecycle owned by get_db().
"""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.communication import Comment
from app.schemas.comment import CommentCreate, CommentResponse, CommentUpdate
from app.schemas.lead import PaginatedResponse

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# CommentService
# ---------------------------------------------------------------------------


class CommentService:
    """All business logic for Comments, scoped to a single tenant per call."""

    # ------------------------------------------------------------------
    # _base_query
    # ------------------------------------------------------------------

    @staticmethod
    def _base_query(tenant_id: uuid.UUID):
        """Base SELECT with created_by relationship loaded."""
        return (
            select(Comment)
            .where(Comment.tenant_id == tenant_id)
            .options(selectinload(Comment.created_by))
        )

    # ------------------------------------------------------------------
    # list_comments
    # ------------------------------------------------------------------

    async def list_comments(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        reference_doctype: str,
        reference_docname: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedResponse[CommentResponse]:
        """Return paginated comments for a specific CRM document."""

        conditions = [
            Comment.tenant_id == tenant_id,
            Comment.reference_doctype == reference_doctype,
            Comment.reference_docname == reference_docname,
        ]

        # Count
        count_result = await db.execute(
            select(func.count()).select_from(Comment).where(*conditions)
        )
        total_count = count_result.scalar_one()

        # Paginated data — oldest first for comment threads
        offset = (page - 1) * page_size
        data_result = await db.execute(
            select(Comment)
            .where(*conditions)
            .options(selectinload(Comment.created_by))
            .order_by(Comment.created_at.asc())
            .offset(offset)
            .limit(page_size)
        )
        comments = data_result.scalars().all()

        return PaginatedResponse[CommentResponse](
            data=[CommentResponse.model_validate(c) for c in comments],
            total_count=total_count,
            page=page,
            page_size=page_size,
        )

    # ------------------------------------------------------------------
    # get_comment
    # ------------------------------------------------------------------

    async def get_comment(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        comment_id: uuid.UUID,
    ) -> Comment:
        """Fetch a single Comment by PK, scoped to tenant_id."""
        result = await db.execute(
            self._base_query(tenant_id).where(Comment.id == comment_id)
        )
        comment = result.scalar_one_or_none()
        if not comment:
            raise NotFoundError(f"Comment {comment_id} not found")
        return comment

    # ------------------------------------------------------------------
    # create_comment
    # ------------------------------------------------------------------

    async def create_comment(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: CommentCreate,
        user_id: uuid.UUID,
    ) -> Comment:
        """Create a new Comment attached to a CRM document."""
        comment = Comment(
            tenant_id=tenant_id,
            content=data.content,
            reference_doctype=data.reference_doctype,
            reference_docname=data.reference_docname,
            created_by_id=user_id,
        )

        db.add(comment)
        await db.flush()

        # Reload with relationship to populate created_by embed
        comment = await self.get_comment(db, tenant_id, comment.id)

        logger.info(
            "comment_created",
            comment_id=str(comment.id),
            tenant_id=str(tenant_id),
            reference_doctype=data.reference_doctype,
            reference_docname=str(data.reference_docname),
        )
        return comment

    # ------------------------------------------------------------------
    # update_comment
    # ------------------------------------------------------------------

    async def update_comment(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        comment_id: uuid.UUID,
        data: CommentUpdate,
        user_id: uuid.UUID,
    ) -> Comment:
        """Update a Comment's content.  Only the original author may update."""
        comment = await self.get_comment(db, tenant_id, comment_id)

        if comment.created_by_id != user_id:
            raise ForbiddenError("Only the original author can edit this comment")

        comment.content = data.content
        await db.flush()

        # Reload to get fresh updated_at and relationship
        comment = await self.get_comment(db, tenant_id, comment_id)

        logger.info(
            "comment_updated",
            comment_id=str(comment_id),
            tenant_id=str(tenant_id),
        )
        return comment

    # ------------------------------------------------------------------
    # delete_comment
    # ------------------------------------------------------------------

    async def delete_comment(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        comment_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        """Delete a Comment.  Only the original author may delete."""
        comment = await self.get_comment(db, tenant_id, comment_id)

        if comment.created_by_id != user_id:
            raise ForbiddenError("Only the original author can delete this comment")

        await db.delete(comment)
        await db.flush()

        logger.info(
            "comment_deleted",
            comment_id=str(comment_id),
            tenant_id=str(tenant_id),
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

comment_service = CommentService()
