"""MessageService — business logic for the Message resource.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query MUST include tenant_id in the WHERE clause (multi-tenant isolation).
  - Messages are paginated with cursor-based pagination (by message UUID / timestamp)
    rather than offset pagination to guarantee stable ordering when new messages
    arrive during a user's scrollback session.
  - Idempotency is enforced at the external_message_id unique constraint level:
    save_outbound_message checks for an existing record before inserting.
  - Use db.flush() not db.commit() — the caller owns the transaction.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.message import (
    MessageCreate,
    MessageCursorResponse,
    MessageListParams,
    MessageResponse,
    MessageStats,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# MessageService
# ---------------------------------------------------------------------------


class MessageService:
    """All business logic for Messages, always scoped to a tenant."""

    # ------------------------------------------------------------------
    # list_messages (cursor-based)
    # ------------------------------------------------------------------

    async def list_messages(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        conversation_id: uuid.UUID,
        params: MessageListParams,
    ) -> MessageCursorResponse:
        """Return a cursor-paginated page of messages for a conversation.

        Pagination strategy:
          - Primary sort: timestamp DESC (newest first within the query so we
            can apply a simple WHERE timestamp < cursor_timestamp).
          - The returned list is then reversed before serialisation so that the
            UI receives messages in chronological order (oldest → newest).
          - next_cursor points to the oldest message on the current page,
            which becomes the upper-bound for the next (older) page.

        Security: tenant_id is always included in the WHERE clause.  The
        conversation_id FK already implies the tenant, but we add the explicit
        tenant check to guard against cross-tenant ID probing.
        """
        # Verify that the conversation belongs to this tenant
        conv_result = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.tenant_id == tenant_id,
            )
        )
        if not conv_result.scalar_one_or_none():
            raise NotFoundError(f"Conversation {conversation_id} not found")

        query = (
            select(Message)
            .where(
                Message.tenant_id == tenant_id,
                Message.conversation_id == conversation_id,
            )
            .order_by(Message.timestamp.desc(), Message.id.desc())
        )

        # Direction filter
        if params.direction:
            query = query.where(Message.direction == params.direction)

        # Cursor: fetch messages older than the cursor message
        if params.cursor:
            try:
                cursor_id = uuid.UUID(params.cursor)
            except ValueError:
                raise BadRequestError(f"Invalid cursor value: {params.cursor!r}")

            cursor_row = await db.execute(
                select(Message.timestamp).where(
                    Message.id == cursor_id,
                    Message.tenant_id == tenant_id,
                )
            )
            cursor_ts = cursor_row.scalar_one_or_none()
            if cursor_ts is None:
                raise BadRequestError(f"Cursor message {params.cursor} not found")

            # Messages strictly older than the cursor timestamp
            query = query.where(
                (Message.timestamp < cursor_ts)
                | (
                    (Message.timestamp == cursor_ts)
                    & (Message.id < cursor_id)
                )
            )

        # Fetch limit + 1 to detect if more pages exist
        query = query.limit(params.limit + 1)
        rows = await db.execute(query)
        messages: list[Message] = list(rows.scalars().all())

        has_more = len(messages) > params.limit
        if has_more:
            messages = messages[: params.limit]

        # Determine next cursor (oldest message on this page)
        next_cursor: str | None = str(messages[-1].id) if (has_more and messages) else None

        # Reverse to chronological order for the client
        messages.reverse()

        return MessageCursorResponse(
            data=[MessageResponse.model_validate(m) for m in messages],
            next_cursor=next_cursor,
            has_more=has_more,
        )

    # ------------------------------------------------------------------
    # create_message
    # ------------------------------------------------------------------

    async def create_message(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        conversation_id: uuid.UUID,
        data: MessageCreate,
        direction: str = "OUTBOUND",
        sender_name: str | None = None,
        external_message_id: str | None = None,
    ) -> Message:
        """Create a new message record and update the parent conversation's
        last_message_at timestamp.

        Args:
            direction: INBOUND or OUTBOUND (default OUTBOUND for API-driven sends).
            sender_name: Display name of the sender; usually the agent or AI name.
            external_message_id: Platform-level message ID for deduplication.
        """
        # Verify conversation belongs to tenant
        conv_result = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.tenant_id == tenant_id,
            )
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise NotFoundError(f"Conversation {conversation_id} not found")

        now = _utcnow()
        message = Message(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            direction=direction,
            type=data.type,
            content=data.content,
            metadata_json=data.metadata,
            status="SENT",
            sender_name=sender_name,
            external_message_id=external_message_id,
            timestamp=now,
        )
        db.add(message)

        # Denormalise last activity timestamp on the conversation
        conversation.last_message_at = now

        await db.flush()
        logger.info(
            "message_created",
            message_id=str(message.id),
            conversation_id=str(conversation_id),
            tenant_id=str(tenant_id),
            direction=direction,
            type=data.type,
        )
        return message

    # ------------------------------------------------------------------
    # save_outbound_message
    # ------------------------------------------------------------------

    async def save_outbound_message(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        conversation_id: uuid.UUID,
        content: str | None,
        type: str = "TEXT",
        external_message_id: str | None = None,
        sender_name: str | None = None,
        metadata: dict[str, Any] | None = None,
        status: str = "SENT",
    ) -> Message:
        """Persist an outbound message sent by AI or N8N.

        Idempotency: if external_message_id is provided and a message with
        that ID already exists (in any tenant), the existing record is returned
        without creating a duplicate.  This handles N8N double-delivery.
        """
        # Idempotency check — scoped to tenant to prevent cross-tenant data leak
        if external_message_id:
            existing_result = await db.execute(
                select(Message).where(
                    Message.external_message_id == external_message_id,
                    Message.tenant_id == tenant_id,
                )
            )
            existing = existing_result.scalar_one_or_none()
            if existing:
                logger.info(
                    "message_idempotent_skip",
                    external_message_id=external_message_id,
                    message_id=str(existing.id),
                )
                return existing

        # Verify conversation belongs to tenant
        conv_result = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.tenant_id == tenant_id,
            )
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise NotFoundError(f"Conversation {conversation_id} not found")

        now = _utcnow()
        message = Message(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            direction="OUTBOUND",
            type=type,
            content=content,
            metadata_json=metadata,
            status=status,
            sender_name=sender_name,
            external_message_id=external_message_id,
            timestamp=now,
        )
        db.add(message)

        # Update conversation activity stamp
        conversation.last_message_at = now

        await db.flush()
        logger.info(
            "outbound_message_saved",
            message_id=str(message.id),
            conversation_id=str(conversation_id),
            tenant_id=str(tenant_id),
            type=type,
        )
        return message

    # ------------------------------------------------------------------
    # update_message_status
    # ------------------------------------------------------------------

    async def update_message_status(
        self,
        db: AsyncSession,
        external_message_id: str,
        status: str,
        error_info: str | None = None,
    ) -> Message | None:
        """Update delivery status for a message identified by external_message_id.

        Called by webhook workers when the channel reports DELIVERED / READ /
        FAILED status updates.  Returns None if the message is not found
        (e.g. the outbound save happened before the webhook arrived).
        No tenant_id required here because external_message_id is globally
        unique (unique constraint on the column).
        """
        result = await db.execute(
            select(Message).where(
                Message.external_message_id == external_message_id
            )
        )
        message = result.scalar_one_or_none()
        if not message:
            logger.warning(
                "message_status_update_not_found",
                external_message_id=external_message_id,
                status=status,
            )
            return None

        message.status = status
        if error_info is not None:
            message.error_info = error_info

        await db.flush()
        logger.info(
            "message_status_updated",
            message_id=str(message.id),
            external_message_id=external_message_id,
            status=status,
        )
        return message

    # ------------------------------------------------------------------
    # get_message_stats
    # ------------------------------------------------------------------

    async def get_message_stats(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        conversation_id: uuid.UUID,
    ) -> MessageStats:
        """Return aggregated message counts for a single conversation.

        Security: both tenant_id and conversation_id are used in every query.
        """
        # Verify conversation belongs to tenant
        conv_check = await db.execute(
            select(func.count())
            .select_from(Conversation)
            .where(
                Conversation.id == conversation_id,
                Conversation.tenant_id == tenant_id,
            )
        )
        if conv_check.scalar_one() == 0:
            raise NotFoundError(f"Conversation {conversation_id} not found")

        base_where = (
            Message.tenant_id == tenant_id,
            Message.conversation_id == conversation_id,
        )

        total_result = await db.execute(
            select(func.count()).select_from(Message).where(*base_where)
        )
        total = total_result.scalar_one()

        direction_rows = (
            await db.execute(
                select(Message.direction, func.count().label("n"))
                .where(*base_where)
                .group_by(Message.direction)
            )
        ).all()
        inbound = next((r.n for r in direction_rows if r.direction == "INBOUND"), 0)
        outbound = next((r.n for r in direction_rows if r.direction == "OUTBOUND"), 0)

        type_rows = (
            await db.execute(
                select(Message.type, func.count().label("n"))
                .where(*base_where)
                .group_by(Message.type)
            )
        ).all()
        by_type: dict[str, int] = {r.type: r.n for r in type_rows}

        status_rows = (
            await db.execute(
                select(Message.status, func.count().label("n"))
                .where(*base_where)
                .group_by(Message.status)
            )
        ).all()
        by_status: dict[str, int] = {r.status: r.n for r in status_rows}

        return MessageStats(
            total=total,
            inbound=inbound,
            outbound=outbound,
            by_type=by_type,
            by_status=by_status,
        )


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

message_service = MessageService()
