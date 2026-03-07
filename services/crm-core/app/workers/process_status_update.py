"""ARQ task: process a delivery-status update from the channel.

Meta Cloud API sends webhook events for each delivery milestone:
``sent`` → ``delivered`` → ``read``, and ``failed`` on error.

Responsibilities
----------------
1. Look up the Message by its ``external_message_id``.
2. If not found, log a warning and return (do not retry — the message may
   belong to a different service instance or was never stored).
3. Map the channel status string to the internal enum value.
4. Validate the status transition (warn but do not block out-of-order updates
   — Meta can deliver them out of sequence).
5. Update ``Message.status`` and append status metadata to ``metadata_json``.
6. If status is ``FAILED``, persist the error detail in ``error_info``.
7. If status is ``READ``, advance ``Conversation.status`` to ``WAITING``
   when the conversation is currently ``IN_PROGRESS``.
8. Emit ``message:status`` Socket.io event.

Idempotency
-----------
If the message is already in the new status the task returns early
without re-writing.  This handles duplicate webhook deliveries from Meta.
"""

from __future__ import annotations

import structlog
from sqlalchemy import select

from app.core.database import async_session
from app.models.conversation import Conversation
from app.models.message import Message
from app.realtime.socket_manager import sio

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Status mapping
# ---------------------------------------------------------------------------

_STATUS_MAP: dict[str, str] = {
    "sent": "SENT",
    "delivered": "DELIVERED",
    "read": "READ",
    "failed": "FAILED",
    "deleted": "FAILED",  # Treat deleted as failed
}

# Valid forward transitions:  from_status → set of reachable next statuses
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "SENT": {"DELIVERED", "READ", "FAILED"},
    "DELIVERED": {"READ", "FAILED"},
    "READ": {"FAILED"},
    "FAILED": set(),   # Terminal
    "PENDING": {"SENT", "DELIVERED", "READ", "FAILED"},
}


def _map_status(raw_status: str) -> str:
    """Map a channel status string to the internal enum value."""
    mapped = _STATUS_MAP.get(raw_status.lower())
    if not mapped:
        logger.warning(
            "process_status_update_unknown_status",
            raw_status=raw_status,
        )
        return "SENT"  # Safe default
    return mapped


def _is_valid_transition(current: str, next_status: str) -> bool:
    """Return True if the transition is allowed."""
    allowed = _VALID_TRANSITIONS.get(current, set())
    return next_status in allowed


# ---------------------------------------------------------------------------
# Socket.io helper
# ---------------------------------------------------------------------------


async def _emit_message_status(
    tenant_id: str,
    conversation_id: str,
    message_id: str,
    status: str,
    error_detail: dict | None = None,
) -> None:
    payload = {
        "messageId": message_id,
        "conversationId": conversation_id,
        "status": status,
    }
    if error_detail:
        payload["errorInfo"] = error_detail

    await sio.emit("message:status", payload, room=f"tenant:{tenant_id}")
    await sio.emit("message:status", payload, room=f"conversation:{conversation_id}")


# ---------------------------------------------------------------------------
# Main task function
# ---------------------------------------------------------------------------


async def process_status_update(
    ctx: dict,
    *,
    external_message_id: str,
    status: str,
    error_info: str | None = None,
    raw_payload: dict | None = None,
) -> None:
    """ARQ task: update message delivery status from a channel webhook.

    Parameters
    ----------
    ctx:
        ARQ context dict.
    external_message_id:
        The platform message ID (e.g. WhatsApp ``wamid.*``).
    status:
        Raw channel status string: ``sent``, ``delivered``, ``read``,
        ``failed``, or ``deleted``.
    error_info:
        Optional error description when ``status == "failed"``.
    raw_payload:
        Full raw status webhook payload for audit/metadata storage.
    """
    job_id: str = ctx.get("job_id", "<unknown>")
    raw: dict = raw_payload or {}
    log = logger.bind(
        job_id=job_id,
        external_message_id=external_message_id,
        raw_status=status,
    )

    log.debug("process_status_update_start")

    mapped_status = _map_status(status)

    async with async_session() as db:
        try:
            # ------------------------------------------------------------------
            # 1. Find the Message by external_message_id
            # ------------------------------------------------------------------
            stmt = select(Message).where(
                Message.external_message_id == external_message_id,
            )
            result = await db.execute(stmt)
            message: Message | None = result.scalar_one_or_none()

            if message is None:
                log.warning("process_status_update_message_not_found")
                return  # Non-retryable — message may belong to another service

            log = log.bind(
                tenant_id=str(message.tenant_id),
                message_id=str(message.id),
                conversation_id=str(message.conversation_id),
            )

            # ------------------------------------------------------------------
            # 2. Idempotency check
            # ------------------------------------------------------------------
            if message.status == mapped_status:
                log.debug("process_status_update_unchanged_skipped")
                return

            # ------------------------------------------------------------------
            # 3. Validate transition (warn but continue — Meta is not ordered)
            # ------------------------------------------------------------------
            if not _is_valid_transition(message.status, mapped_status):
                log.warning(
                    "process_status_update_invalid_transition",
                    from_status=message.status,
                    to_status=mapped_status,
                )
                # Continue — Meta can deliver out-of-order (e.g. READ before DELIVERED)

            # ------------------------------------------------------------------
            # 4. Build status metadata to append to metadata_json
            # ------------------------------------------------------------------
            existing_meta: dict = message.metadata_json or {}
            status_entry: dict = {
                "status": status,
                "mapped": mapped_status,
                "timestamp": raw.get("timestamp"),
                "recipientId": raw.get("recipient_id"),
            }

            # Parse errors from raw payload (Meta format) or direct error_info
            errors: list[dict] = []
            raw_errors = raw.get("errors", [])
            for err in raw_errors:
                errors.append(
                    {
                        "code": str(err.get("code", "")),
                        "title": err.get("title"),
                        "message": err.get("message"),
                        "details": err.get("error_data", {}).get("details"),
                    }
                )
            if errors:
                status_entry["errors"] = errors

            # Billing info (Meta conversation window)
            if raw.get("conversation"):
                status_entry["conversation"] = {
                    "id": raw["conversation"].get("id"),
                    "origin_type": raw["conversation"].get("origin", {}).get("type"),
                    "expiration_timestamp": raw["conversation"].get("expiration_timestamp"),
                }
            if raw.get("pricing"):
                status_entry["pricing"] = raw["pricing"]

            # Append to existing status_updates list
            status_updates: list = existing_meta.get("statusUpdates", [])
            status_updates.append(status_entry)
            new_meta: dict = {**existing_meta, "statusUpdates": status_updates}

            # ------------------------------------------------------------------
            # 5. Populate error_info for FAILED status
            # ------------------------------------------------------------------
            new_error_info: str | None = message.error_info
            error_detail_for_socket: dict | None = None

            if mapped_status == "FAILED":
                if errors:
                    first = errors[0]
                    err_msg = first.get("message") or first.get("title") or "Delivery failed"
                    new_error_info = f"[{first.get('code', '')}] {err_msg}"
                    if len(new_error_info) > 500:
                        new_error_info = new_error_info[:500]
                    error_detail_for_socket = {
                        "code": first.get("code", ""),
                        "message": err_msg,
                        "details": first.get("details"),
                    }
                elif error_info:
                    new_error_info = error_info[:500]
                    error_detail_for_socket = {"message": error_info[:200]}

                # Store delivery error in metadata for frontend tooltip
                new_meta["delivery"] = {
                    **existing_meta.get("delivery", {}),
                    "error": error_detail_for_socket,
                }

                log.error(
                    "process_status_update_message_failed",
                    errors=errors,
                    error_info=error_info,
                )

            # ------------------------------------------------------------------
            # 6. Persist Message status update
            # ------------------------------------------------------------------
            message.status = mapped_status
            message.metadata_json = new_meta
            if new_error_info:
                message.error_info = new_error_info

            # ------------------------------------------------------------------
            # 7. Advance Conversation to WAITING when READ in IN_PROGRESS
            # ------------------------------------------------------------------
            if mapped_status == "READ":
                conv_stmt = select(Conversation).where(
                    Conversation.id == message.conversation_id,
                    Conversation.tenant_id == message.tenant_id,
                )
                conv_result = await db.execute(conv_stmt)
                conv: Conversation | None = conv_result.scalar_one_or_none()

                if conv and conv.status == "IN_PROGRESS":
                    conv.status = "WAITING"
                    log.debug(
                        "process_status_update_conversation_waiting",
                        conversation_id=str(conv.id),
                    )

            await db.commit()

            log.info(
                "process_status_update_success",
                new_status=mapped_status,
            )

            # ------------------------------------------------------------------
            # 8. Emit Socket.io event (best-effort)
            # ------------------------------------------------------------------
            try:
                await _emit_message_status(
                    tenant_id=str(message.tenant_id),
                    conversation_id=str(message.conversation_id),
                    message_id=str(message.id),
                    status=mapped_status,
                    error_detail=error_detail_for_socket,
                )
            except Exception as socket_err:
                log.warning(
                    "process_status_update_socket_emit_failed",
                    error=str(socket_err),
                )

        except Exception as exc:
            await db.rollback()
            log.error(
                "process_status_update_error",
                error=str(exc),
                exc_info=True,
            )
            raise  # Re-raise for ARQ retry
