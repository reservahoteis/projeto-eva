"""NoteService — business logic for the Note resource.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query that touches Note rows MUST include tenant_id in the WHERE
    clause to enforce strict multi-tenant data isolation.
  - Notes do not have a kanban view — they are always returned as a paginated
    list, most commonly filtered by reference_doctype + reference_docname.
  - db.flush() (not commit) is used in all write methods so the surrounding
    request transaction can be rolled back by the session middleware on error.
  - The module-level singleton `note_service = NoteService()` is the canonical
    import for use in routers.
"""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.models.note import Note
from app.schemas.lead import PaginatedResponse
from app.schemas.note import (
    NoteCreate,
    NoteListItem,
    NoteListParams,
    NoteUpdate,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_note_query(tenant_id: uuid.UUID):
    """Base SELECT with eager-loaded relationships for full Note responses."""
    return (
        select(Note)
        .where(Note.tenant_id == tenant_id)
        .options(
            selectinload(Note.created_by),
        )
    )


def _apply_reference_filters(
    query,
    reference_doctype: str | None,
    reference_docname: uuid.UUID | None,
):
    """Append reference_doctype / reference_docname equality filters when provided."""
    if reference_doctype is not None:
        query = query.where(Note.reference_doctype == reference_doctype)
    if reference_docname is not None:
        query = query.where(Note.reference_docname == reference_docname)
    return query


# ---------------------------------------------------------------------------
# NoteService
# ---------------------------------------------------------------------------


class NoteService:
    """All business logic for Notes, scoped to a single tenant per call."""

    # ------------------------------------------------------------------
    # list_notes
    # ------------------------------------------------------------------

    async def list_notes(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: NoteListParams,
    ) -> PaginatedResponse[NoteListItem]:
        """Return notes for a tenant, optionally scoped to a reference document.

        The most common call pattern is:
          list_notes(..., params=NoteListParams(
              reference_doctype="Lead",
              reference_docname=<lead_id>,
          ))

        which returns all notes attached to a specific Lead, newest first.
        Omitting both filter fields returns all notes for the tenant (paginated).
        """
        base_query = _build_note_query(tenant_id)
        base_query = _apply_reference_filters(
            base_query, params.reference_doctype, params.reference_docname
        )

        # Count total matching rows before pagination
        count_query = (
            select(func.count())
            .select_from(Note)
            .where(Note.tenant_id == tenant_id)
        )
        count_query = _apply_reference_filters(
            count_query, params.reference_doctype, params.reference_docname
        )
        total_result = await db.execute(count_query)
        total_count = total_result.scalar_one()

        # Paginated data — newest first
        offset = (params.page - 1) * params.page_size
        data_query = (
            base_query.order_by(Note.created_at.desc())
            .offset(offset)
            .limit(params.page_size)
        )

        rows = await db.execute(data_query)
        notes = rows.scalars().all()

        return PaginatedResponse[NoteListItem](
            data=[NoteListItem.model_validate(note) for note in notes],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    # ------------------------------------------------------------------
    # get_note
    # ------------------------------------------------------------------

    async def get_note(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        note_id: uuid.UUID,
    ) -> Note:
        """Fetch a single Note by PK, scoped to tenant_id."""
        result = await db.execute(
            _build_note_query(tenant_id).where(Note.id == note_id)
        )
        note = result.scalar_one_or_none()
        if not note:
            raise NotFoundError(f"Note {note_id} not found")
        return note

    # ------------------------------------------------------------------
    # create_note
    # ------------------------------------------------------------------

    async def create_note(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: NoteCreate,
        user_id: uuid.UUID,
    ) -> Note:
        """Create a new Note scoped to tenant_id.

        created_by_id is always set from the authenticated user — the client
        cannot override authorship.
        """
        note = Note(
            tenant_id=tenant_id,
            created_by_id=user_id,
            title=data.title,
            content=data.content,
            reference_doctype=data.reference_doctype,
            reference_docname=data.reference_docname,
        )

        db.add(note)
        await db.flush()  # populate note.id

        # Reload with relationships
        note = await self.get_note(db, tenant_id, note.id)
        logger.info(
            "note_created",
            note_id=str(note.id),
            tenant_id=str(tenant_id),
            title=data.title,
            reference_doctype=data.reference_doctype,
            reference_docname=str(data.reference_docname) if data.reference_docname else None,
        )
        return note

    # ------------------------------------------------------------------
    # update_note
    # ------------------------------------------------------------------

    async def update_note(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        note_id: uuid.UUID,
        data: NoteUpdate,
        user_id: uuid.UUID | None = None,
    ) -> Note:
        """Partial update of a Note.  Only non-None fields are applied.

        Only title and content are mutable after creation — reference link
        changes are intentionally not supported here.
        """
        note = await self.get_note(db, tenant_id, note_id)

        update_data = data.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(note, field, value)

        await db.flush()

        note = await self.get_note(db, tenant_id, note_id)
        logger.info(
            "note_updated",
            note_id=str(note_id),
            tenant_id=str(tenant_id),
            fields=list(update_data.keys()),
        )
        return note

    # ------------------------------------------------------------------
    # delete_note
    # ------------------------------------------------------------------

    async def delete_note(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        note_id: uuid.UUID,
    ) -> None:
        """Hard-delete a Note scoped to tenant_id."""
        note = await self.get_note(db, tenant_id, note_id)
        await db.delete(note)
        await db.flush()
        logger.info(
            "note_deleted",
            note_id=str(note_id),
            tenant_id=str(tenant_id),
        )

    # ------------------------------------------------------------------
    # bulk_delete
    # ------------------------------------------------------------------

    async def bulk_delete(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        note_ids: list[uuid.UUID],
    ) -> int:
        """Delete multiple Notes by PK list, scoped to tenant.

        Returns the count of actually deleted rows (may be less than
        len(note_ids) if some IDs do not exist or belong to a different
        tenant — those are silently skipped).
        """
        if not note_ids:
            return 0

        result = await db.execute(
            delete(Note)
            .where(
                Note.tenant_id == tenant_id,
                Note.id.in_(note_ids),
            )
            .returning(Note.id)
        )
        deleted_ids = result.fetchall()
        deleted_count = len(deleted_ids)

        await db.flush()
        logger.info(
            "notes_bulk_deleted",
            requested=len(note_ids),
            deleted=deleted_count,
            tenant_id=str(tenant_id),
        )
        return deleted_count


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

note_service = NoteService()
