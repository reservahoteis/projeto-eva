"""Server -> Client emission helpers.

Services call these functions to broadcast Socket.io events without needing
to know about room naming conventions or the sio instance directly.

Design decisions that mirror the Express implementation
(deploy-backend/src/config/socket.ts):

  emit_new_message:
    - conversation room  (users currently viewing the chat)
    - admins room        (TENANT_ADMIN sees all conversations)
    - unit room          (ATTENDANT/HEAD of the same hotel_unit)
    - Also emits conversation:updated to keep the sidebar list fresh.

  emit_conversation_updated:
    - admins room
    - unit room (if hotel_unit provided)
    - conversation room  (for users with the chat open)

  emit_new_conversation:
    - admins room
    - unit room (if conversation has a hotel_unit)

  emit_contact_event (created/updated/deleted):
    - tenant-wide room   (all authenticated users of the tenant)

All functions are fire-and-forget coroutines; callers should await them.
If sio is not yet ready (unlikely in production but possible in tests)
the functions log a warning and return without raising.
"""

from __future__ import annotations

from typing import Any

import structlog

logger = structlog.get_logger()


def _get_sio():
    """Lazy import to avoid circular dependency at module load time."""
    from app.realtime.socket_manager import sio  # noqa: PLC0415
    return sio


# ---------------------------------------------------------------------------
# message events
# ---------------------------------------------------------------------------


async def emit_new_message(
    tenant_id: str,
    conversation_id: str,
    message_data: dict[str, Any],
    conversation: dict[str, Any] | None = None,
    hotel_unit: str | None = None,
) -> None:
    """Emit message:new to conversation room, admin room, and unit room.

    Also emits conversation:updated so sidebar lists refresh without polling.

    Args:
        tenant_id:       Tenant UUID string.
        conversation_id: Conversation UUID string.
        message_data:    Serialized message payload.
        conversation:    Full conversation object (optional but recommended).
        hotel_unit:      Hotel unit string; if None it is read from conversation.
    """
    sio = _get_sio()

    resolved_unit: str | None = hotel_unit or (
        conversation.get("hotel_unit") or conversation.get("hotelUnit")
        if conversation
        else None
    )

    payload: dict[str, Any] = {
        "message": message_data,
        "conversation": conversation,
        "conversationId": conversation_id,
    }

    # Users actively viewing the conversation
    await sio.emit("message:new", payload, room=f"conversation:{conversation_id}")

    # TENANT_ADMIN and SUPER_ADMIN see all conversations
    await sio.emit("message:new", payload, room=f"tenant:{tenant_id}:admins")

    # Unit-scoped attendants
    if resolved_unit:
        await sio.emit("message:new", payload, room=f"tenant:{tenant_id}:unit:{resolved_unit}")

    # Keep conversation list in sync
    update_payload: dict[str, Any] = {
        "conversationId": conversation_id,
        "conversation": conversation,
        "lastMessage": message_data,
        "lastMessageAt": message_data.get("timestamp") or message_data.get("createdAt"),
    }
    await sio.emit("conversation:updated", update_payload, room=f"tenant:{tenant_id}:admins")
    if resolved_unit:
        await sio.emit(
            "conversation:updated",
            update_payload,
            room=f"tenant:{tenant_id}:unit:{resolved_unit}",
        )

    logger.info(
        "socket_emit_message_new",
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        message_id=message_data.get("id"),
        hotel_unit=resolved_unit or "none",
    )


async def emit_message_status(
    tenant_id: str,
    conversation_id: str,
    message_id: str,
    status: str,
    error_info: dict[str, Any] | None = None,
) -> None:
    """Emit message:status to all users in the conversation room.

    Args:
        tenant_id:       Tenant UUID string (used for logging only).
        conversation_id: Conversation UUID string.
        message_id:      Message UUID string.
        status:          New status string (e.g. "DELIVERED", "READ", "FAILED").
        error_info:      Optional dict with keys code/message/details for FAILED.
    """
    sio = _get_sio()

    payload: dict[str, Any] = {
        "conversationId": conversation_id,
        "messageId": message_id,
        "status": status,
    }
    if status == "FAILED" and error_info:
        payload["errorInfo"] = error_info

    await sio.emit("message:status", payload, room=f"conversation:{conversation_id}")

    logger.info(
        "socket_emit_message_status",
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        message_id=message_id,
        status=status,
        has_error_info=error_info is not None,
    )


# ---------------------------------------------------------------------------
# conversation events
# ---------------------------------------------------------------------------


async def emit_new_conversation(
    tenant_id: str,
    conversation_data: dict[str, Any],
    hotel_unit: str | None = None,
) -> None:
    """Emit conversation:new to admin room and (if applicable) unit room.

    Args:
        tenant_id:         Tenant UUID string.
        conversation_data: Serialized conversation payload.
        hotel_unit:        Hotel unit string; falls back to conversation_data field.
    """
    sio = _get_sio()

    resolved_unit: str | None = hotel_unit or (
        conversation_data.get("hotel_unit") or conversation_data.get("hotelUnit")
    )

    payload: dict[str, Any] = {"conversation": conversation_data}

    await sio.emit("conversation:new", payload, room=f"tenant:{tenant_id}:admins")

    if resolved_unit:
        await sio.emit(
            "conversation:new",
            payload,
            room=f"tenant:{tenant_id}:unit:{resolved_unit}",
        )
        logger.info(
            "socket_emit_conversation_new",
            tenant_id=tenant_id,
            conversation_id=conversation_data.get("id"),
            hotel_unit=resolved_unit,
            rooms="admins+unit",
        )
    else:
        logger.info(
            "socket_emit_conversation_new",
            tenant_id=tenant_id,
            conversation_id=conversation_data.get("id"),
            rooms="admins_only",
            note="no hotel_unit — attendants will not receive this event",
        )


async def emit_conversation_updated(
    tenant_id: str,
    conversation_id: str,
    updates: dict[str, Any],
    hotel_unit: str | None = None,
) -> None:
    """Emit conversation:updated to admin room, unit room, and conversation room.

    Args:
        tenant_id:       Tenant UUID string.
        conversation_id: Conversation UUID string.
        updates:         Dict of changed fields.
        hotel_unit:      Hotel unit to notify; omit if not applicable.
    """
    sio = _get_sio()

    payload: dict[str, Any] = {
        "conversationId": conversation_id,
        "updates": updates,
    }

    await sio.emit("conversation:updated", payload, room=f"tenant:{tenant_id}:admins")

    if hotel_unit:
        await sio.emit(
            "conversation:updated",
            payload,
            room=f"tenant:{tenant_id}:unit:{hotel_unit}",
        )

    # Users viewing the conversation chat window
    await sio.emit("conversation:updated", payload, room=f"conversation:{conversation_id}")

    logger.debug(
        "socket_emit_conversation_updated",
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        hotel_unit=hotel_unit or "none",
        update_keys=list(updates.keys()),
    )


async def emit_conversation_typing(
    conversation_id: str,
    user_id: str,
    user_name: str,
    is_typing: bool,
) -> None:
    """Emit conversation:typing indicator to all members of the conversation room.

    Mirrors the server-side broadcast in the Express implementation.
    Unlike the client-event handler (which uses skip_sid), this emitter
    broadcasts to the entire room because it is called from a service layer
    where there is no socket to skip.

    Args:
        conversation_id: Conversation UUID string.
        user_id:         UUID of the user who is typing.
        user_name:       Display name of the user who is typing.
        is_typing:       True if typing started, False if stopped.
    """
    sio = _get_sio()

    await sio.emit(
        "conversation:typing",
        {
            "conversationId": conversation_id,
            "userId": user_id,
            "userName": user_name,
            "isTyping": is_typing,
        },
        room=f"conversation:{conversation_id}",
    )

    logger.debug(
        "socket_emit_conversation_typing",
        conversation_id=conversation_id,
        user_id=user_id,
        is_typing=is_typing,
    )


# ---------------------------------------------------------------------------
# notification events
# ---------------------------------------------------------------------------


async def emit_notification(
    user_id: str,
    notification_data: dict[str, Any],
) -> None:
    """Emit a notification to a specific user's personal room.

    Args:
        user_id:           Target user UUID string.
        notification_data: Notification payload (structure defined by callers).
    """
    sio = _get_sio()

    await sio.emit("notification", notification_data, room=f"user:{user_id}")

    logger.debug(
        "socket_emit_notification",
        user_id=user_id,
        notification_type=notification_data.get("type"),
    )


# ---------------------------------------------------------------------------
# contact events
# ---------------------------------------------------------------------------


async def emit_contact_event(
    tenant_id: str,
    event_type: str,
    contact_data: dict[str, Any] | None = None,
    contact_id: str | None = None,
) -> None:
    """Emit contact:created, contact:updated, or contact:deleted to all tenant users.

    Args:
        tenant_id:    Tenant UUID string.
        event_type:   One of "created", "updated", "deleted".
        contact_data: Full contact payload (for created/updated).
        contact_id:   Contact UUID string (for deleted, or as fallback).

    Raises:
        ValueError: If event_type is not one of the allowed values.
    """
    sio = _get_sio()

    allowed_events = {"created", "updated", "deleted"}
    if event_type not in allowed_events:
        raise ValueError(f"event_type must be one of {allowed_events}, got {event_type!r}")

    event_name = f"contact:{event_type}"

    if event_type == "deleted":
        payload: dict[str, Any] = {"contactId": contact_id}
    else:
        payload = {"contact": contact_data}

    # All authenticated users of the tenant see contact changes
    await sio.emit(event_name, payload, room=f"tenant:{tenant_id}")

    logger.debug(
        "socket_emit_contact_event",
        tenant_id=tenant_id,
        event_type=event_type,
        contact_id=contact_id or (contact_data.get("id") if contact_data else None),
    )
