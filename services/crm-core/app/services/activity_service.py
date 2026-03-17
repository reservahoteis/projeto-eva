"""ActivityService — unified activity timeline for any CRM entity.

Aggregates activity items from six source tables:
  1. notes              -> type "note"
  2. tasks              -> type "task"
  3. call_logs          -> type "call"
  4. comments           -> type "comment"
  5. communications     -> type "email"
  6. status_change_logs -> type "status_change"

All tables except status_change_logs use reference_doctype + reference_docname
to identify the parent entity.  StatusChangeLog uses entity_type + entity_id
(same semantic but different column names — kept consistent with its schema).

Each source contributes a list of ActivityItem objects.  The service merges
all lists in Python, sorts by created_at DESC, then applies cursor-based
pagination.  This is efficient for the typical timeline size (< 10k events
per entity); for extremely high-volume entities a UNION SQL approach should be
considered in a future optimisation.

Design decisions:
  - Async methods with AsyncSession injection.
  - tenant_id included in every query that touches TenantBase tables.
  - StatusChangeLog is NOT a TenantBase — it is filtered by entity_type +
    entity_id only (the parent entity already enforced tenant isolation).
  - selectinload not needed here because we access only scalar columns and a
    single created_by relationship; we load that explicitly via joined query.
  - db.flush() and no commit — unit-of-work owned by get_db().
"""

from __future__ import annotations

import uuid
from datetime import datetime

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.call_log import CallLog
from app.models.communication import Comment, Communication
from app.models.note import Note
from app.models.status_change_log import StatusChangeLog
from app.models.task import Task
from app.schemas.activity import ActivityItem, ActivityListResponse, UserEmbed

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Private helpers — one per source table
# ---------------------------------------------------------------------------


def _user_embed_from_obj(user_obj) -> UserEmbed | None:
    """Build a UserEmbed from a SQLAlchemy User relationship object, or None."""
    if user_obj is None:
        return None
    return UserEmbed(
        id=user_obj.id,
        name=user_obj.name,
        email=user_obj.email,
        avatar_url=getattr(user_obj, "avatar_url", None),
    )


async def _collect_notes(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    doctype: str,
    docname: uuid.UUID,
) -> list[ActivityItem]:
    result = await db.execute(
        select(Note)
        .where(
            Note.tenant_id == tenant_id,
            Note.reference_doctype == doctype,
            Note.reference_docname == docname,
        )
        .options(selectinload(Note.created_by))
        .order_by(Note.created_at.desc())
    )
    notes = result.scalars().all()

    items: list[ActivityItem] = []
    for note in notes:
        items.append(
            ActivityItem(
                id=note.id,
                type="note",
                title=note.title,
                content=note.content,
                created_by=_user_embed_from_obj(note.created_by),
                created_at=note.created_at,
                metadata=None,
            )
        )
    return items


async def _collect_tasks(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    doctype: str,
    docname: uuid.UUID,
) -> list[ActivityItem]:
    result = await db.execute(
        select(Task)
        .where(
            Task.tenant_id == tenant_id,
            Task.reference_doctype == doctype,
            Task.reference_docname == docname,
        )
        .options(selectinload(Task.created_by))
        .order_by(Task.created_at.desc())
    )
    tasks = result.scalars().all()

    items: list[ActivityItem] = []
    for task in tasks:
        items.append(
            ActivityItem(
                id=task.id,
                type="task",
                title=task.title,
                content=task.description,
                created_by=_user_embed_from_obj(task.created_by),
                created_at=task.created_at,
                metadata={
                    "priority": task.priority,
                    "status": task.status,
                    "due_date": task.due_date.isoformat() if task.due_date else None,
                },
            )
        )
    return items


async def _collect_call_logs(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    doctype: str,
    docname: uuid.UUID,
) -> list[ActivityItem]:
    result = await db.execute(
        select(CallLog)
        .where(
            CallLog.tenant_id == tenant_id,
            CallLog.reference_doctype == doctype,
            CallLog.reference_docname == docname,
        )
        .order_by(CallLog.created_at.desc())
    )
    call_logs = result.scalars().all()

    items: list[ActivityItem] = []
    for cl in call_logs:
        # Build a descriptive title from call direction and status
        call_direction = cl.type or "Call"
        call_status = cl.status or "Unknown"
        title = f"{call_direction}: {cl.caller} -> {cl.receiver} ({call_status})"

        items.append(
            ActivityItem(
                id=cl.id,
                type="call",
                title=title,
                content=cl.note,
                created_by=None,  # CallLog has no created_by FK
                created_at=cl.created_at,
                metadata={
                    "caller": cl.caller,
                    "receiver": cl.receiver,
                    "duration": cl.duration,
                    "status": cl.status,
                    "call_type": cl.type,
                    "telephony_medium": cl.telephony_medium,
                    "recording_url": cl.recording_url,
                },
            )
        )
    return items


async def _collect_comments(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    doctype: str,
    docname: uuid.UUID,
) -> list[ActivityItem]:
    result = await db.execute(
        select(Comment)
        .where(
            Comment.tenant_id == tenant_id,
            Comment.reference_doctype == doctype,
            Comment.reference_docname == docname,
        )
        .options(selectinload(Comment.created_by))
        .order_by(Comment.created_at.desc())
    )
    comments = result.scalars().all()

    items: list[ActivityItem] = []
    for comment in comments:
        # Truncate content for the title; keep full text in content
        preview = (comment.content[:80] + "...") if len(comment.content) > 80 else comment.content
        items.append(
            ActivityItem(
                id=comment.id,
                type="comment",
                title=preview,
                content=comment.content,
                created_by=_user_embed_from_obj(comment.created_by),
                created_at=comment.created_at,
                metadata=None,
            )
        )
    return items


async def _collect_communications(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    doctype: str,
    docname: uuid.UUID,
) -> list[ActivityItem]:
    result = await db.execute(
        select(Communication)
        .where(
            Communication.tenant_id == tenant_id,
            Communication.reference_doctype == doctype,
            Communication.reference_docname == docname,
        )
        .order_by(Communication.created_at.desc())
    )
    communications = result.scalars().all()

    items: list[ActivityItem] = []
    for comm in communications:
        title = comm.subject or f"{comm.comm_type} communication"
        items.append(
            ActivityItem(
                id=comm.id,
                type="email",
                title=title,
                content=comm.content,
                created_by=None,  # Communication has no created_by FK
                created_at=comm.created_at,
                metadata={
                    "comm_type": comm.comm_type,
                    "sender": comm.sender,
                    "recipients": comm.recipients,
                    "sent_at": comm.sent_at.isoformat() if comm.sent_at else None,
                },
            )
        )
    return items


async def _collect_status_changes(
    db: AsyncSession,
    doctype: str,
    docname: uuid.UUID,
) -> list[ActivityItem]:
    """StatusChangeLog uses entity_type + entity_id (not reference_doctype/docname)."""
    result = await db.execute(
        select(StatusChangeLog)
        .where(
            StatusChangeLog.entity_type == doctype,
            StatusChangeLog.entity_id == docname,
        )
        .options(selectinload(StatusChangeLog.changed_by))
        .order_by(StatusChangeLog.changed_at.desc())
    )
    logs = result.scalars().all()

    items: list[ActivityItem] = []
    for log in logs:
        from_label = log.from_status or "(initial)"
        title = f"Status changed: {from_label} -> {log.to_status}"

        # Duration may be a Python timedelta — serialise to seconds
        duration_seconds: float | None = None
        if log.duration is not None:
            try:
                duration_seconds = log.duration.total_seconds()
            except AttributeError:
                # In case duration is stored as interval string by PostgreSQL
                duration_seconds = None

        items.append(
            ActivityItem(
                id=log.id,
                type="status_change",
                title=title,
                content=None,
                created_by=_user_embed_from_obj(log.changed_by),
                created_at=log.changed_at,
                metadata={
                    "from_status": log.from_status,
                    "to_status": log.to_status,
                    "duration_seconds": duration_seconds,
                },
            )
        )
    return items


# ---------------------------------------------------------------------------
# ActivityService
# ---------------------------------------------------------------------------


class ActivityService:
    """Unified activity timeline service."""

    async def get_activities(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        doctype: str,
        docname: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> ActivityListResponse:
        """Return a merged, sorted, paginated activity timeline for any CRM entity.

        Queries all six source tables concurrently (sequential awaits inside a
        single transaction — no explicit parallelism needed for typical sizes).
        Merges results into a single list, sorts by created_at DESC, then slices
        for the requested page.

        Args:
            db:        AsyncSession from the DI container.
            tenant_id: Calling user's tenant — used to scope all queries.
            doctype:   CRM entity type, e.g. "Lead" or "Deal".
            docname:   PK of the CRM entity.
            page:      1-based page number.
            page_size: Items per page (max enforced at router level).

        Returns:
            ActivityListResponse with merged, paginated items.
        """

        # Fetch from all sources
        notes = await _collect_notes(db, tenant_id, doctype, docname)
        tasks = await _collect_tasks(db, tenant_id, doctype, docname)
        call_logs = await _collect_call_logs(db, tenant_id, doctype, docname)
        comments = await _collect_comments(db, tenant_id, doctype, docname)
        communications = await _collect_communications(db, tenant_id, doctype, docname)
        status_changes = await _collect_status_changes(db, doctype, docname)

        # Merge all sources
        all_items: list[ActivityItem] = (
            notes
            + tasks
            + call_logs
            + comments
            + communications
            + status_changes
        )

        # Sort by created_at DESC (most recent first)
        all_items.sort(key=lambda item: item.created_at, reverse=True)

        total_count = len(all_items)

        # Paginate in Python — acceptable for typical entity activity volumes
        offset = (page - 1) * page_size
        page_items = all_items[offset : offset + page_size]

        logger.info(
            "activities_fetched",
            doctype=doctype,
            docname=str(docname),
            tenant_id=str(tenant_id),
            total_count=total_count,
            page=page,
            page_size=page_size,
        )

        return ActivityListResponse(
            data=page_items,
            total_count=total_count,
            page=page,
            page_size=page_size,
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

activity_service = ActivityService()
