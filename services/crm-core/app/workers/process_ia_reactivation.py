"""ARQ task: reactivate the AI after a human-takeover or follow-up timeout.

This task is typically enqueued as a deferred job (using ARQ's
``_defer_until`` parameter) to run N seconds/minutes after a follow-up
message was sent or after an attendant assumed control.

Responsibilities
----------------
1. Load the Conversation scoped to the tenant.
2. If not found, log a warning and return (idempotent).
3. Skip if the conversation is CLOSED or ARCHIVED (no AI needed).
4. Skip if ``ia_locked`` is already False (already reactivated).
5. Only reactivate if ``ia_locked_by`` matches ``"system:followup"`` — if
   an attendant manually locked the AI, this task must not override that
   decision.  (This mirrors the behaviour of the Express worker.)
6. Set ``ia_locked = False``, clear ``ia_locked_at`` and ``ia_locked_by``.
7. Emit a Socket.io ``conversation:updated`` event so the frontend can
   show the AI-active indicator without a page refresh.

Idempotency
-----------
The task is fully idempotent.  Calling it multiple times when
``ia_locked`` is already False (or when the conversation is closed)
produces no side effects — just a debug log entry.

ia_locked_by values
-------------------
- ``"system:followup"``  — set by the follow-up scheduler; safe to auto-reactivate.
- ``"manual:{user_id}"`` — set by an attendant; this task MUST NOT override.
- ``None``               — AI was never locked; nothing to do.
"""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import select

from app.core.database import async_session
from app.models.conversation import Conversation
from app.realtime.socket_manager import sio

logger = structlog.get_logger()

# ia_locked_by value written by the follow-up scheduler — only source that
# this task is allowed to clear automatically.
_SYSTEM_FOLLOWUP_SOURCE = "system:followup"

# Conversation statuses where AI reactivation is meaningless
_TERMINAL_STATUSES = {"CLOSED", "ARCHIVED"}


# ---------------------------------------------------------------------------
# Socket.io helper
# ---------------------------------------------------------------------------


async def _emit_conversation_updated(
    tenant_id: str,
    conversation_id: str,
    updates: dict,
) -> None:
    """Emit ``conversation:updated`` to the tenant room."""
    payload = {
        "conversationId": conversation_id,
        "updates": updates,
    }
    await sio.emit("conversation:updated", payload, room=f"tenant:{tenant_id}")
    await sio.emit("conversation:updated", payload, room=f"conversation:{conversation_id}")


# ---------------------------------------------------------------------------
# Main task function
# ---------------------------------------------------------------------------


async def process_ia_reactivation(
    ctx: dict,
    *,
    tenant_id: str,
    conversation_id: str,
) -> None:
    """ARQ task: reactivate the AI for a conversation after a timeout.

    Parameters
    ----------
    ctx:
        ARQ context dict.
    tenant_id:
        UUID string of the owning tenant.
    conversation_id:
        UUID string of the target Conversation.
    """
    job_id: str = ctx.get("job_id", "<unknown>")
    log = logger.bind(
        job_id=job_id,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )

    log.info("process_ia_reactivation_start")

    try:
        tenant_uuid = uuid.UUID(tenant_id)
        conversation_uuid = uuid.UUID(conversation_id)
    except (ValueError, AttributeError) as exc:
        log.error("process_ia_reactivation_invalid_uuids", error=str(exc))
        return  # Non-retryable

    async with async_session() as db:
        try:
            # ------------------------------------------------------------------
            # 1. Load the Conversation, scoped to the tenant
            # ------------------------------------------------------------------
            stmt = select(Conversation).where(
                Conversation.id == conversation_uuid,
                Conversation.tenant_id == tenant_uuid,
            )
            result = await db.execute(stmt)
            conversation: Conversation | None = result.scalar_one_or_none()

            if conversation is None:
                log.warning("process_ia_reactivation_conversation_not_found")
                return

            # ------------------------------------------------------------------
            # 2. Skip if in a terminal status
            # ------------------------------------------------------------------
            if conversation.status in _TERMINAL_STATUSES:
                log.info(
                    "process_ia_reactivation_skipped_terminal_status",
                    status=conversation.status,
                )
                return

            # ------------------------------------------------------------------
            # 3. Skip if already unlocked
            # ------------------------------------------------------------------
            if not conversation.ia_locked:
                log.debug("process_ia_reactivation_already_unlocked")
                return

            # ------------------------------------------------------------------
            # 4. Guard: only reactivate when locked by the follow-up system
            # ------------------------------------------------------------------
            ia_locked_by: str | None = getattr(conversation, "ia_locked_by", None)

            if ia_locked_by != _SYSTEM_FOLLOWUP_SOURCE:
                log.info(
                    "process_ia_reactivation_skipped_manual_lock",
                    ia_locked_by=ia_locked_by,
                )
                return

            # ------------------------------------------------------------------
            # 5. Reactivate: clear the lock fields
            # ------------------------------------------------------------------
            conversation.ia_locked = False

            # ia_locked_at and ia_locked_by are optional columns added in the
            # Express backend's schema.  Check for their presence on the model
            # before clearing to remain compatible with schema versions that
            # pre-date those columns.
            if hasattr(conversation, "ia_locked_at"):
                conversation.ia_locked_at = None  # type: ignore[assignment]
            if hasattr(conversation, "ia_locked_by"):
                conversation.ia_locked_by = None  # type: ignore[assignment]

            await db.commit()

            log.info("process_ia_reactivation_success")

            # ------------------------------------------------------------------
            # 6. Emit Socket.io event (best-effort)
            # ------------------------------------------------------------------
            try:
                await _emit_conversation_updated(
                    tenant_id=tenant_id,
                    conversation_id=conversation_id,
                    updates={"iaLocked": False},
                )
            except Exception as socket_err:
                log.warning(
                    "process_ia_reactivation_socket_emit_failed",
                    error=str(socket_err),
                )

        except Exception as exc:
            await db.rollback()
            log.error(
                "process_ia_reactivation_error",
                error=str(exc),
                exc_info=True,
            )
            raise  # Re-raise for ARQ retry
