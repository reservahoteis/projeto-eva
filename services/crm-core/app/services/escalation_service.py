"""EscalationService — business logic for the Escalation resource.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query MUST include tenant_id in the WHERE clause (multi-tenant isolation).
  - Creating an escalation always sets ia_locked=True and status=OPEN on the
    parent Conversation so that the AI will not respond while a human handles it.
  - Status transitions are validated:
      PENDING → IN_PROGRESS (records attended_by + attended_at via Escalation.created_at)
      IN_PROGRESS → RESOLVED | CANCELLED (records resolved_at)
  - Average resolution time is computed in Python from resolved escalations to avoid
    database-specific interval arithmetic.
  - Use db.flush() not db.commit() — the caller owns the transaction.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.escalation import Escalation
from app.models.user import User
from app.schemas.escalation import (
    EscalationCreate,
    EscalationListParams,
    EscalationResponse,
    EscalationStats,
    EscalationUpdate,
    PaginatedResponse,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Column whitelist — prevents SQL injection through dynamic ORDER BY / filters
# ---------------------------------------------------------------------------

_ESCALATION_COLUMNS: frozenset[str] = frozenset(
    {
        "id",
        "tenant_id",
        "conversation_id",
        "attended_by_id",
        "reason",
        "hotel_unit",
        "status",
        "resolved_at",
        "created_at",
        "updated_at",
    }
)

# Valid status transitions
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "PENDING": {"IN_PROGRESS", "CANCELLED"},
    "IN_PROGRESS": {"RESOLVED", "CANCELLED"},
    "RESOLVED": set(),
    "CANCELLED": set(),
    "CLOSED": set(),   # legacy alias
}


def _validate_column(name: str) -> None:
    """Raise BadRequestError if `name` is not a known Escalation column."""
    if name not in _ESCALATION_COLUMNS:
        raise BadRequestError(f"Unknown filter / sort field: {name!r}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_escalation_query(tenant_id: uuid.UUID):
    """Base SELECT with eager-loaded relationships."""
    return (
        select(Escalation)
        .where(Escalation.tenant_id == tenant_id)
        .options(
            selectinload(Escalation.conversation).selectinload(Conversation.contact),
            selectinload(Escalation.attended_by),
        )
    )


def _apply_filters(query, params: EscalationListParams):
    """Append WHERE clauses from list params."""
    if params.status:
        query = query.where(Escalation.status == params.status.upper())

    if params.reason:
        # Substring match — reason is a free-text field, not an enum
        query = query.where(Escalation.reason.ilike(f"%{params.reason}%"))

    if params.hotel_unit:
        query = query.where(Escalation.hotel_unit == params.hotel_unit)

    return query


def _apply_ordering(query, order_by: str):
    """Append ORDER BY clauses from a comma-separated 'field dir' string."""
    tokens = [t.strip() for t in order_by.split(",") if t.strip()]
    for token in tokens:
        parts = token.split()
        field = parts[0]
        direction = parts[1].lower() if len(parts) == 2 else "asc"
        _validate_column(field)
        col = getattr(Escalation, field)
        query = query.order_by(col.desc() if direction == "desc" else col.asc())
    return query


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# EscalationService
# ---------------------------------------------------------------------------


class EscalationService:
    """All business logic for Escalations, scoped to a single tenant per call."""

    # ------------------------------------------------------------------
    # create_escalation
    # ------------------------------------------------------------------

    async def create_escalation(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: EscalationCreate,
    ) -> Escalation:
        """Create an escalation record and lock the parent conversation.

        Side effects on the Conversation:
          - ia_locked = True  (AI will stop responding)
          - status = OPEN     (ensures it appears in the human inbox)
        """
        # Verify the conversation belongs to this tenant
        conv_result = await db.execute(
            select(Conversation).where(
                Conversation.id == data.conversation_id,
                Conversation.tenant_id == tenant_id,
            )
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise NotFoundError(f"Conversation {data.conversation_id} not found")

        escalation = Escalation(
            tenant_id=tenant_id,
            conversation_id=data.conversation_id,
            reason=data.reason,
            hotel_unit=data.hotel_unit,
            ai_context=data.ai_context,
            status="PENDING",
        )
        db.add(escalation)

        # Lock the conversation for human handling
        conversation.ia_locked = True
        if conversation.status == "BOT_HANDLING":
            conversation.status = "OPEN"

        await db.flush()

        # Reload with full relationships
        escalation = await self._get_by_id(db, tenant_id, escalation.id)
        logger.info(
            "escalation_created",
            escalation_id=str(escalation.id),
            conversation_id=str(data.conversation_id),
            tenant_id=str(tenant_id),
            reason=data.reason,
        )
        return escalation

    # ------------------------------------------------------------------
    # list_escalations
    # ------------------------------------------------------------------

    async def list_escalations(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: EscalationListParams,
    ) -> PaginatedResponse[EscalationResponse]:
        """Return a paginated list of Escalations for the given tenant."""
        base_query = _build_escalation_query(tenant_id)
        base_query = _apply_filters(base_query, params)

        # Count
        count_query = (
            select(func.count())
            .select_from(Escalation)
            .where(Escalation.tenant_id == tenant_id)
        )
        count_query = _apply_filters(count_query, params)

        total_result = await db.execute(count_query)
        total_count = total_result.scalar_one()

        # Data
        data_query = _apply_ordering(base_query, params.order_by)
        offset = (params.page - 1) * params.page_size
        data_query = data_query.offset(offset).limit(params.page_size)

        rows = await db.execute(data_query)
        escalations = rows.scalars().all()

        return PaginatedResponse[EscalationResponse](
            data=[EscalationResponse.model_validate(e) for e in escalations],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    # ------------------------------------------------------------------
    # get_escalation
    # ------------------------------------------------------------------

    async def get_escalation(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        escalation_id: uuid.UUID,
    ) -> Escalation:
        """Fetch a single Escalation by PK, scoped to tenant_id."""
        return await self._get_by_id(db, tenant_id, escalation_id)

    # ------------------------------------------------------------------
    # update_escalation
    # ------------------------------------------------------------------

    async def update_escalation(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        escalation_id: uuid.UUID,
        data: EscalationUpdate,
    ) -> Escalation:
        """Update an escalation with validated status transitions.

        Transition rules:
          PENDING     → IN_PROGRESS  sets attended_by, records attended timestamp
          IN_PROGRESS → RESOLVED     sets resolved_at
          IN_PROGRESS → CANCELLED    sets resolved_at (as closure timestamp)
        """
        escalation = await self._get_by_id(db, tenant_id, escalation_id)

        update_data = data.model_dump(exclude_none=True)

        new_status: str | None = update_data.get("status")
        if new_status:
            current = escalation.status
            allowed = _VALID_TRANSITIONS.get(current, set())
            if new_status not in allowed:
                raise BadRequestError(
                    f"Cannot transition escalation from {current!r} to {new_status!r}. "
                    f"Allowed transitions: {sorted(allowed) or 'none'}"
                )

            now = _utcnow()

            if new_status == "IN_PROGRESS":
                # Record who picked it up
                if "attended_by_id" in update_data:
                    escalation.attended_by_id = update_data.pop("attended_by_id")

            elif new_status in ("RESOLVED", "CANCELLED"):
                escalation.resolved_at = now

            escalation.status = new_status
            update_data.pop("status")

        # Apply remaining fields
        for field, value in update_data.items():
            setattr(escalation, field, value)

        await db.flush()

        escalation = await self._get_by_id(db, tenant_id, escalation_id)
        logger.info(
            "escalation_updated",
            escalation_id=str(escalation_id),
            tenant_id=str(tenant_id),
            new_status=new_status,
        )
        return escalation

    # ------------------------------------------------------------------
    # get_escalation_stats
    # ------------------------------------------------------------------

    async def get_escalation_stats(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> EscalationStats:
        """Return aggregated escalation counts and average resolution time."""
        status_rows = (
            await db.execute(
                select(Escalation.status, func.count().label("n"))
                .where(Escalation.tenant_id == tenant_id)
                .group_by(Escalation.status)
            )
        ).all()
        by_status: dict[str, int] = {r.status: r.n for r in status_rows}
        total = sum(by_status.values())

        reason_rows = (
            await db.execute(
                select(Escalation.reason, func.count().label("n"))
                .where(Escalation.tenant_id == tenant_id)
                .group_by(Escalation.reason)
            )
        ).all()
        by_reason: dict[str, int] = {r.reason: r.n for r in reason_rows}

        # Average resolution time — computed in Python to avoid dialect-specific
        # interval arithmetic (works on both PostgreSQL and SQLite for tests)
        resolved_rows = (
            await db.execute(
                select(Escalation.created_at, Escalation.resolved_at)
                .where(
                    Escalation.tenant_id == tenant_id,
                    Escalation.resolved_at.is_not(None),
                )
            )
        ).all()

        avg_minutes: float | None = None
        if resolved_rows:
            total_seconds = sum(
                (r.resolved_at - r.created_at).total_seconds()
                for r in resolved_rows
                if r.resolved_at and r.created_at
            )
            avg_minutes = round(total_seconds / len(resolved_rows) / 60, 2)

        return EscalationStats(
            total=total,
            pending=by_status.get("PENDING", 0),
            in_progress=by_status.get("IN_PROGRESS", 0),
            resolved=by_status.get("RESOLVED", 0),
            by_status=by_status,
            by_reason=by_reason,
            avg_resolution_time_minutes=avg_minutes,
        )

    # ------------------------------------------------------------------
    # is_ia_locked
    # ------------------------------------------------------------------

    async def is_ia_locked(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        conversation_id: uuid.UUID,
    ) -> bool:
        """Return the ia_locked flag for a specific conversation.

        Security: tenant_id is always included in the query.
        """
        result = await db.execute(
            select(Conversation.ia_locked).where(
                Conversation.id == conversation_id,
                Conversation.tenant_id == tenant_id,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise NotFoundError(f"Conversation {conversation_id} not found")
        return bool(row)

    # ------------------------------------------------------------------
    # is_ia_locked_by_phone
    # ------------------------------------------------------------------

    async def is_ia_locked_by_phone(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        phone_number: str,
        channel: str | None = None,
    ) -> bool:
        """Return whether the active conversation for a phone number is IA-locked.

        Lookup chain:
          1. Find the Contact by phone/mobile_no within the tenant.
          2. Find the most recent active conversation for that contact.
          3. Return the ia_locked flag.

        Returns False (not locked) if no contact or active conversation is found,
        as the safe fallback is to allow the AI to respond.
        """
        # Find contact by phone number
        contact_result = await db.execute(
            select(Contact.id).where(
                Contact.tenant_id == tenant_id,
                (Contact.mobile_no == phone_number) | (Contact.phone == phone_number),
            )
        )
        contact_id = contact_result.scalar_one_or_none()
        if contact_id is None:
            return False

        # Find the most recent active conversation
        active_statuses = ["BOT_HANDLING", "OPEN", "IN_PROGRESS", "WAITING"]
        conv_query = (
            select(Conversation.ia_locked)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.contact_id == contact_id,
                Conversation.status.in_(active_statuses),
            )
            .order_by(Conversation.last_message_at.desc().nullslast())
            .limit(1)
        )
        if channel:
            conv_query = conv_query.where(Conversation.channel == channel.upper())

        conv_result = await db.execute(conv_query)
        ia_locked = conv_result.scalar_one_or_none()

        # No active conversation means AI is free to respond
        if ia_locked is None:
            return False

        return bool(ia_locked)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _get_by_id(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        escalation_id: uuid.UUID,
    ) -> Escalation:
        """Internal fetch with tenant isolation and relationship loading."""
        result = await db.execute(
            _build_escalation_query(tenant_id).where(
                Escalation.id == escalation_id
            )
        )
        escalation = result.scalar_one_or_none()
        if not escalation:
            raise NotFoundError(f"Escalation {escalation_id} not found")
        return escalation


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

escalation_service = EscalationService()
