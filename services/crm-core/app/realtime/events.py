"""Client -> Server Socket.io event handlers.

All handlers follow the same pattern:
  1. Read the socket session to obtain user context (user_id, tenant_id, role, hotel_unit).
  2. Validate input — emit "error" back to the sender on bad input.
  3. Apply access control — deny silently or with a safe error message.
  4. Perform the action (room join/leave, DB query, broadcast).
  5. Log with structlog (no PII beyond user_id).

Handler registration is done via register_event_handlers() which is called
once during server startup from socket_manager.py.

Events handled here (client -> server):
  conversation:join       — enter a conversation room with access control
  conversation:leave      — leave a conversation room
  conversation:typing     — broadcast typing indicator to other room members
  messages:mark-read      — acknowledge messages as read
  ping                    — keep-alive; responds with pong
"""

from __future__ import annotations

import structlog
from sqlalchemy import select

from app.core.database import async_session
from app.models.conversation import Conversation  # type: ignore[attr-defined]

logger = structlog.get_logger()


def register_event_handlers(sio: object) -> None:
    """Attach all client-originating event handlers to *sio*."""

    # ------------------------------------------------------------------
    # conversation:join
    # ------------------------------------------------------------------

    @sio.on("conversation:join")
    async def conversation_join(sid: str, data: dict | str) -> None:
        """Join the conversation room for live message updates.

        Access control:
          - Conversation must belong to the user's tenant.
          - ATTENDANT may only join conversations assigned to them OR in
            their hotel_unit (mirrors Express ATTENDANT check).
          - TENANT_ADMIN, SUPER_ADMIN, HEAD, SALES: unrestricted within tenant.
        """
        async with sio.session(sid) as session:
            user_id: str = session.get("user_id", "")
            tenant_id: str | None = session.get("tenant_id")
            role: str = session.get("role", "")
            hotel_unit: str | None = session.get("hotel_unit")

        conversation_id: str = (
            data if isinstance(data, str) else data.get("conversationId", "")
        )

        if not conversation_id:
            await sio.emit("error", {"message": "conversationId is required"}, to=sid)
            return

        if not tenant_id and role != "SUPER_ADMIN":
            await sio.emit("error", {"message": "Access denied"}, to=sid)
            return

        try:
            async with async_session() as db:
                stmt = select(Conversation).where(
                    Conversation.id == conversation_id,
                )
                if tenant_id:
                    stmt = stmt.where(Conversation.tenant_id == tenant_id)

                result = await db.execute(stmt)
                conversation: Conversation | None = result.scalar_one_or_none()

            if not conversation:
                await sio.emit("error", {"message": "Conversation not found"}, to=sid)
                logger.warning(
                    "socket_conversation_join_denied",
                    sid=sid,
                    user_id=user_id,
                    conversation_id=conversation_id,
                    reason="not_found_or_wrong_tenant",
                )
                return

            # ATTENDANT access control
            if role == "ATTENDANT":
                is_assigned = str(getattr(conversation, "assigned_to_id", None)) == user_id
                conv_unit = getattr(conversation, "hotel_unit", None)
                is_same_unit = hotel_unit and conv_unit == hotel_unit
                if not is_assigned and not is_same_unit:
                    await sio.emit("error", {"message": "Access denied"}, to=sid)
                    logger.warning(
                        "socket_conversation_join_denied",
                        sid=sid,
                        user_id=user_id,
                        conversation_id=conversation_id,
                        role="ATTENDANT",
                        reason="not_assigned_and_different_unit",
                    )
                    return

        except Exception as exc:
            logger.error(
                "socket_conversation_join_error",
                sid=sid,
                user_id=user_id,
                conversation_id=conversation_id,
                error=str(exc),
            )
            await sio.emit("error", {"message": "Internal error"}, to=sid)
            return

        room = f"conversation:{conversation_id}"
        await sio.enter_room(sid, room)
        await sio.emit("conversation:joined", {"conversationId": conversation_id}, to=sid)

        logger.info(
            "socket_joined_conversation",
            sid=sid,
            user_id=user_id,
            conversation_id=conversation_id,
        )

    # ------------------------------------------------------------------
    # conversation:leave
    # ------------------------------------------------------------------

    @sio.on("conversation:leave")
    async def conversation_leave(sid: str, data: dict | str) -> None:
        """Leave a conversation room.

        No access control needed on leave — a user can always exit a room
        they are already in (or one they are not in, which is a no-op).
        """
        async with sio.session(sid) as session:
            user_id: str = session.get("user_id", "")

        conversation_id: str = (
            data if isinstance(data, str) else data.get("conversationId", "")
        )

        if not conversation_id:
            await sio.emit("error", {"message": "conversationId is required"}, to=sid)
            return

        room = f"conversation:{conversation_id}"
        await sio.leave_room(sid, room)
        await sio.emit("conversation:left", {"conversationId": conversation_id}, to=sid)

        logger.debug(
            "socket_left_conversation",
            sid=sid,
            user_id=user_id,
            conversation_id=conversation_id,
        )

    # ------------------------------------------------------------------
    # conversation:typing
    # ------------------------------------------------------------------

    @sio.on("conversation:typing")
    async def conversation_typing(sid: str, data: dict) -> None:
        """Broadcast a typing indicator to others in the same conversation room.

        The emitting socket is excluded (skip_sid) so the sender does not
        receive their own typing event.
        """
        async with sio.session(sid) as session:
            user_id: str = session.get("user_id", "")
            user_name: str = session.get("name", "")

        conversation_id: str = data.get("conversationId", "")
        is_typing: bool = bool(data.get("isTyping", False))

        if not conversation_id:
            await sio.emit("error", {"message": "conversationId is required"}, to=sid)
            return

        room = f"conversation:{conversation_id}"
        await sio.emit(
            "conversation:typing",
            {
                "conversationId": conversation_id,
                "userId": user_id,
                "userName": user_name,
                "isTyping": is_typing,
            },
            room=room,
            skip_sid=sid,
        )

        logger.debug(
            "socket_typing_indicator",
            sid=sid,
            user_id=user_id,
            conversation_id=conversation_id,
            is_typing=is_typing,
        )

    # ------------------------------------------------------------------
    # messages:mark-read
    # ------------------------------------------------------------------

    @sio.on("messages:mark-read")
    async def messages_mark_read(sid: str, data: dict) -> None:
        """Acknowledge a batch of messages as read.

        The current implementation emits a confirmation back to the sender.
        Actual DB persistence is intentionally left to the REST endpoint
        so this handler stays stateless and fast.
        """
        async with sio.session(sid) as session:
            user_id: str = session.get("user_id", "")

        message_ids: list[str] = data.get("messageIds", [])

        if not message_ids:
            await sio.emit("error", {"message": "messageIds is required"}, to=sid)
            return

        await sio.emit("messages:marked-read", {"messageIds": message_ids}, to=sid)

        logger.debug(
            "socket_messages_mark_read",
            sid=sid,
            user_id=user_id,
            count=len(message_ids),
        )

    # ------------------------------------------------------------------
    # ping
    # ------------------------------------------------------------------

    @sio.event
    async def ping(sid: str) -> None:
        """Simple keep-alive. Client sends ping, server responds with pong."""
        await sio.emit("pong", {}, to=sid)
