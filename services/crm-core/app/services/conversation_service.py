"""ConversationService — business logic for the Conversation resource.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query that touches Conversation rows MUST include tenant_id in the WHERE
    clause to enforce strict multi-tenant data isolation.
  - Role-based filtering is applied at the query level, not after fetch.
  - Relationships (contact, assigned_to, tags) are eager-loaded via selectinload()
    so they are always available without extra round trips.
  - Use db.flush() not db.commit() — the caller (FastAPI route via get_db
    context manager) owns the transaction lifecycle.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.conversation_tag import ConversationTag
from app.models.tag import Tag
from app.models.user import User
from app.schemas.conversation import (
    ConversationCreate,
    ConversationListItem,
    ConversationListParams,
    ConversationStats,
    ConversationUpdate,
    PaginatedResponse,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Column whitelist — prevents SQL injection through dynamic ORDER BY / filters
# ---------------------------------------------------------------------------

_CONVERSATION_COLUMNS: frozenset[str] = frozenset(
    {
        "id",
        "tenant_id",
        "contact_id",
        "assigned_to_id",
        "status",
        "priority",
        "channel",
        "hotel_unit",
        "ia_locked",
        "is_opportunity",
        "last_message_at",
        "source",
        "closed_at",
        "external_id",
        "created_at",
        "updated_at",
    }
)

# Roles that can see all conversations within a tenant (no user-level scoping)
_TENANT_WIDE_ROLES = {"SUPER_ADMIN", "TENANT_ADMIN", "ADMIN"}


def _validate_column(name: str) -> None:
    """Raise BadRequestError if `name` is not a known Conversation column."""
    if name not in _CONVERSATION_COLUMNS:
        raise BadRequestError(f"Unknown filter / sort field: {name!r}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_conversation_query(tenant_id: uuid.UUID):
    """Base SELECT with eager-loaded relationships for full Conversation responses."""
    return (
        select(Conversation)
        .where(Conversation.tenant_id == tenant_id)
        .options(
            selectinload(Conversation.contact),
            selectinload(Conversation.assigned_to),
            selectinload(Conversation.tags),
        )
    )


def _apply_role_filter(
    query,
    user_role: str,
    user_id: uuid.UUID | None,
    user_hotel_unit: str | None,
):
    """Restrict result set to rows the requesting user is authorised to see.

    Role mapping:
      SUPER_ADMIN / TENANT_ADMIN / ADMIN — all conversations in the tenant
      HEAD                               — all conversations for their hotel_unit
      ATTENDANT                          — assigned to them OR same hotel_unit
      SALES                              — is_opportunity=True only
    """
    role = user_role.upper()
    if role in _TENANT_WIDE_ROLES:
        return query

    if role == "SALES":
        return query.where(Conversation.is_opportunity.is_(True))

    if role == "HEAD":
        if user_hotel_unit:
            return query.where(Conversation.hotel_unit == user_hotel_unit)
        return query

    if role == "ATTENDANT":
        conditions = []
        if user_id:
            conditions.append(Conversation.assigned_to_id == user_id)
        if user_hotel_unit:
            conditions.append(Conversation.hotel_unit == user_hotel_unit)
        if conditions:
            return query.where(or_(*conditions))

    # Unknown role — fail-closed: deny access to prevent privilege escalation
    raise ForbiddenError(f"Unrecognised role: {role!r}")


def _apply_filters(query, params: ConversationListParams):
    """Append WHERE clauses derived from the filter parameters."""
    # Status — supports CSV like "OPEN,IN_PROGRESS"
    if params.status:
        statuses = [s.strip().upper() for s in params.status.split(",") if s.strip()]
        if statuses:
            query = query.where(Conversation.status.in_(statuses))

    if params.priority:
        query = query.where(Conversation.priority == params.priority.upper())

    if params.channel:
        query = query.where(Conversation.channel == params.channel.upper())

    if params.assigned_to_id is not None:
        query = query.where(Conversation.assigned_to_id == params.assigned_to_id)

    if params.hotel_unit is not None:
        query = query.where(Conversation.hotel_unit == params.hotel_unit)

    if params.is_opportunity is not None:
        query = query.where(Conversation.is_opportunity.is_(params.is_opportunity))

    if params.ia_locked is not None:
        query = query.where(Conversation.ia_locked.is_(params.ia_locked))

    # Arbitrary filter dict (column-level equality)
    if params.filters:
        for field, value in params.filters.items():
            _validate_column(field)
            col = getattr(Conversation, field)
            if value is None:
                query = query.where(col.is_(None))
            elif isinstance(value, list):
                query = query.where(col.in_(value))
            else:
                query = query.where(col == value)

    return query


def _escape_ilike(value: str) -> str:
    """Escape SQL ILIKE wildcard characters to prevent pattern injection."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _apply_search(query, search: str | None):
    """ILIKE search across contact name and phone (via join)."""
    if not search:
        return query
    pattern = f"%{_escape_ilike(search)}%"
    query = query.outerjoin(Contact, Conversation.contact_id == Contact.id).where(
        or_(
            Contact.full_name.ilike(pattern),
            Contact.first_name.ilike(pattern),
            Contact.mobile_no.ilike(pattern),
            Contact.phone.ilike(pattern),
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
        col = getattr(Conversation, field)
        query = query.order_by(col.desc() if direction == "desc" else col.asc())
    return query


# ---------------------------------------------------------------------------
# ConversationService
# ---------------------------------------------------------------------------


class ConversationService:
    """All business logic for Conversations, scoped to a single tenant per call."""

    # ------------------------------------------------------------------
    # list_conversations
    # ------------------------------------------------------------------

    async def list_conversations(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_role: str,
        user_id: uuid.UUID | None,
        user_hotel_unit: str | None,
        params: ConversationListParams,
    ) -> PaginatedResponse[ConversationListItem]:
        """Return a paginated list of Conversations for the given tenant.

        Role-based scoping is applied at the query level to prevent
        attendants or sales users from seeing conversations they should not.
        """
        base_query = _build_conversation_query(tenant_id)
        base_query = _apply_role_filter(base_query, user_role, user_id, user_hotel_unit)
        base_query = _apply_filters(base_query, params)
        base_query = _apply_search(base_query, params.search)

        # Count total matching rows (before pagination)
        count_query = (
            select(func.count())
            .select_from(Conversation)
            .where(Conversation.tenant_id == tenant_id)
        )
        count_query = _apply_role_filter(count_query, user_role, user_id, user_hotel_unit)
        count_query = _apply_filters(count_query, params)
        count_query = _apply_search(count_query, params.search)

        total_result = await db.execute(count_query)
        total_count = total_result.scalar_one()

        # Paginated data
        data_query = _apply_ordering(base_query, params.order_by)
        offset = (params.page - 1) * params.page_size
        data_query = data_query.offset(offset).limit(params.page_size)

        rows = await db.execute(data_query)
        conversations = rows.scalars().all()

        return PaginatedResponse[ConversationListItem](
            data=[ConversationListItem.model_validate(c) for c in conversations],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    # ------------------------------------------------------------------
    # get_conversation
    # ------------------------------------------------------------------

    async def get_conversation(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        conversation_id: uuid.UUID,
        user_role: str | None = None,
        user_id: uuid.UUID | None = None,
        user_hotel_unit: str | None = None,
    ) -> Conversation:
        """Fetch a single Conversation by PK, scoped to tenant_id.

        When user_role is provided, ATTENDANT access is enforced: the
        conversation must be assigned to the user or in their hotel_unit.
        """
        result = await db.execute(
            _build_conversation_query(tenant_id).where(
                Conversation.id == conversation_id
            )
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise NotFoundError(f"Conversation {conversation_id} not found")

        # Attendant access check
        if user_role and user_role.upper() == "ATTENDANT" and user_id:
            assigned_ok = conversation.assigned_to_id == user_id
            unit_ok = (
                user_hotel_unit is not None
                and conversation.hotel_unit == user_hotel_unit
            )
            if not assigned_ok and not unit_ok:
                raise ForbiddenError("You do not have access to this conversation")

        return conversation

    # ------------------------------------------------------------------
    # get_or_create_conversation
    # ------------------------------------------------------------------

    async def get_or_create_conversation(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        contact_id: uuid.UUID,
        channel: str = "WHATSAPP",
    ) -> tuple[Conversation, bool]:
        """Find an active conversation for this contact or create a new one.

        Flow:
          1. Look for active conversation (BOT_HANDLING, OPEN, IN_PROGRESS, WAITING)
          2. If not found, check for recently closed (<30 min) → reopen it
          3. If not found, create a new OPEN conversation
        Returns (conversation, is_new).
        """
        active_statuses = ["BOT_HANDLING", "OPEN", "IN_PROGRESS", "WAITING"]
        active_result = await db.execute(
            select(Conversation)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.contact_id == contact_id,
                Conversation.channel == channel,
                Conversation.status.in_(active_statuses),
            )
            .order_by(Conversation.last_message_at.desc().nullslast())
            .limit(1)
        )
        conversation = active_result.scalar_one_or_none()
        if conversation:
            return conversation, False

        # Look for recently closed conversation (<30 min)
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
        recent_result = await db.execute(
            select(Conversation)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.contact_id == contact_id,
                Conversation.channel == channel,
                Conversation.status == "CLOSED",
                Conversation.closed_at >= cutoff,
            )
            .order_by(Conversation.closed_at.desc())
            .limit(1)
        )
        recent = recent_result.scalar_one_or_none()
        if recent:
            recent.status = "OPEN"
            recent.closed_at = None
            await db.flush()
            logger.info(
                "conversation_reopened",
                conversation_id=str(recent.id),
                tenant_id=str(tenant_id),
                contact_id=str(contact_id),
            )
            return recent, False

        # Create a new conversation
        conversation = Conversation(
            tenant_id=tenant_id,
            contact_id=contact_id,
            channel=channel,
            status="OPEN",
            priority="MEDIUM",
        )
        db.add(conversation)
        await db.flush()

        # Reload with relationships
        conversation = await self.get_conversation(db, tenant_id, conversation.id)
        logger.info(
            "conversation_created",
            conversation_id=str(conversation.id),
            tenant_id=str(tenant_id),
            contact_id=str(contact_id),
            channel=channel,
        )
        return conversation, True

    # ------------------------------------------------------------------
    # create_conversation
    # ------------------------------------------------------------------

    async def create_conversation(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: ConversationCreate,
    ) -> Conversation:
        """Create a new Conversation from an explicit create payload."""
        conversation = Conversation(
            tenant_id=tenant_id,
            contact_id=data.contact_id,
            channel=data.channel,
            hotel_unit=data.hotel_unit,
            source=data.source,
            metadata_json=data.metadata,
            status="OPEN",
            priority="MEDIUM",
        )
        db.add(conversation)
        await db.flush()

        conversation = await self.get_conversation(db, tenant_id, conversation.id)
        logger.info(
            "conversation_created",
            conversation_id=str(conversation.id),
            tenant_id=str(tenant_id),
        )
        return conversation

    # ------------------------------------------------------------------
    # assign_conversation
    # ------------------------------------------------------------------

    async def assign_conversation(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID | None,
    ) -> Conversation:
        """Assign (or unassign) a conversation to a user.

        Sets assigned_to_id and transitions status OPEN → IN_PROGRESS if the
        conversation is currently OPEN or BOT_HANDLING.
        Pass user_id=None to unassign.
        """
        conversation = await self.get_conversation(db, tenant_id, conversation_id)

        conversation.assigned_to_id = user_id
        if user_id and conversation.status in ("OPEN", "BOT_HANDLING"):
            conversation.status = "IN_PROGRESS"

        await db.flush()

        conversation = await self.get_conversation(db, tenant_id, conversation_id)
        logger.info(
            "conversation_assigned",
            conversation_id=str(conversation_id),
            tenant_id=str(tenant_id),
            assigned_to_id=str(user_id) if user_id else None,
        )
        return conversation

    # ------------------------------------------------------------------
    # update_conversation
    # ------------------------------------------------------------------

    async def update_conversation(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        conversation_id: uuid.UUID,
        data: ConversationUpdate,
    ) -> Conversation:
        """Partial update of a Conversation.

        Accepted fields: status, priority, hotel_unit, ia_locked,
        is_opportunity, metadata.  Setting status=CLOSED automatically
        records closed_at.
        """
        conversation = await self.get_conversation(db, tenant_id, conversation_id)

        update_data = data.model_dump(exclude_none=True)

        # Map schema key to model column for metadata
        if "metadata" in update_data:
            update_data["metadata_json"] = update_data.pop("metadata")

        for field, value in update_data.items():
            setattr(conversation, field, value)

        # Auto-stamp closed_at when status transitions to CLOSED
        if update_data.get("status") == "CLOSED" and not conversation.closed_at:
            conversation.closed_at = datetime.now(timezone.utc)

        await db.flush()

        conversation = await self.get_conversation(db, tenant_id, conversation_id)
        logger.info(
            "conversation_updated",
            conversation_id=str(conversation_id),
            tenant_id=str(tenant_id),
            fields=list(update_data.keys()),
        )
        return conversation

    # ------------------------------------------------------------------
    # close_conversation
    # ------------------------------------------------------------------

    async def close_conversation(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        conversation_id: uuid.UUID,
    ) -> Conversation:
        """Close a conversation and record the closed_at timestamp."""
        conversation = await self.get_conversation(db, tenant_id, conversation_id)
        conversation.status = "CLOSED"
        conversation.closed_at = datetime.now(timezone.utc)
        await db.flush()

        conversation = await self.get_conversation(db, tenant_id, conversation_id)
        logger.info(
            "conversation_closed",
            conversation_id=str(conversation_id),
            tenant_id=str(tenant_id),
        )
        return conversation

    # ------------------------------------------------------------------
    # get_conversation_stats
    # ------------------------------------------------------------------

    async def get_conversation_stats(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_role: str | None = None,
        user_id: uuid.UUID | None = None,
        user_hotel_unit: str | None = None,
    ) -> ConversationStats:
        """Return aggregated conversation counts for dashboard widgets.

        Role-based scoping mirrors list_conversations so that each user only
        sees counts for conversations they are authorised to access.
        """
        base = (
            select(Conversation.status, func.count().label("n"))
            .where(Conversation.tenant_id == tenant_id)
            .group_by(Conversation.status)
        )
        if user_role:
            base = _apply_role_filter(base, user_role, user_id, user_hotel_unit)

        by_status_rows = (await db.execute(base)).all()
        by_status: dict[str, int] = {row.status: row.n for row in by_status_rows}
        total = sum(by_status.values())

        priority_q = (
            select(Conversation.priority, func.count().label("n"))
            .where(Conversation.tenant_id == tenant_id)
            .group_by(Conversation.priority)
        )
        if user_role:
            priority_q = _apply_role_filter(priority_q, user_role, user_id, user_hotel_unit)
        priority_rows = (await db.execute(priority_q)).all()
        by_priority: dict[str, int] = {row.priority: row.n for row in priority_rows}

        channel_q = (
            select(Conversation.channel, func.count().label("n"))
            .where(Conversation.tenant_id == tenant_id)
            .group_by(Conversation.channel)
        )
        if user_role:
            channel_q = _apply_role_filter(channel_q, user_role, user_id, user_hotel_unit)
        channel_rows = (await db.execute(channel_q)).all()
        by_channel: dict[str, int] = {row.channel: row.n for row in channel_rows}

        unassigned_q = (
            select(func.count())
            .select_from(Conversation)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.assigned_to_id.is_(None),
                Conversation.status.notin_(["CLOSED", "ARCHIVED"]),
            )
        )
        if user_role:
            unassigned_q = _apply_role_filter(unassigned_q, user_role, user_id, user_hotel_unit)
        unassigned_result = await db.execute(unassigned_q)
        unassigned = unassigned_result.scalar_one()

        return ConversationStats(
            total=total,
            by_status=by_status,
            by_priority=by_priority,
            by_channel=by_channel,
            unassigned=unassigned,
            # Flat fields for legacy dashboard frontend
            open=by_status.get("OPEN", 0) + by_status.get("BOT_HANDLING", 0),
            pending=by_status.get("WAITING", 0),
            inProgress=by_status.get("IN_PROGRESS", 0),
            resolved=by_status.get("RESOLVED", 0),
            closed=by_status.get("CLOSED", 0) + by_status.get("ARCHIVED", 0),
        )

    # ------------------------------------------------------------------
    # toggle_ia_lock
    # ------------------------------------------------------------------

    async def toggle_ia_lock(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        conversation_id: uuid.UUID,
        locked: bool,
    ) -> Conversation:
        """Set the ia_locked flag on a conversation.

        When locked=True the AI will not process incoming messages for this
        conversation, deferring to the assigned human attendant.
        """
        conversation = await self.get_conversation(db, tenant_id, conversation_id)
        conversation.ia_locked = locked
        await db.flush()

        conversation = await self.get_conversation(db, tenant_id, conversation_id)
        logger.info(
            "conversation_ia_lock_toggled",
            conversation_id=str(conversation_id),
            tenant_id=str(tenant_id),
            ia_locked=locked,
        )
        return conversation


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

conversation_service = ConversationService()
