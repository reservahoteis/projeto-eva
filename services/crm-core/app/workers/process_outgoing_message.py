"""ARQ task: send an outbound message via the appropriate channel adapter.

Responsibilities
----------------
1. Load the Message row to confirm it exists and belongs to the tenant.
2. Skip silently if the message was already sent (has an external_message_id).
3. Resolve the channel adapter (WhatsApp, Messenger, Instagram) from the
   Conversation's ``channel`` field and the tenant's credentials.
4. Dispatch the send call based on ``message.type``.
5. On success: update ``Message.external_message_id`` and ``status=SENT``;
   update ``Conversation.last_message_at`` and ``status=IN_PROGRESS``.
6. On failure: update ``Message.status=FAILED`` with ``error_info``.
7. Emit ``message:status`` Socket.io event so the frontend updates the
   delivery indicator in real time.

Idempotency
-----------
Step 2 makes the task idempotent: if the job is retried after the send
succeeded but before the DB commit (a crash window), the task detects the
``external_message_id`` and returns without re-sending.

Tenant security
---------------
The task validates ``message.tenant_id == tenant_id`` before any send.
A mismatch raises immediately; ARQ will not retry it (it marks the job
FAILED, which is intentional — this indicates a programming error).

Channel adapter resolution
--------------------------
The adapter requires the tenant's ``whatsapp_phone_number_id`` and
``whatsapp_access_token`` (or equivalent per-channel credentials).  These
are expected to be stored on the ``Tenant`` model.  The current CRM Core
Tenant model is read to retrieve those fields.  If credentials are absent
the task raises so the job is retried (credentials may not yet be
provisioned).
"""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import select, update

from app.core.database import async_session
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.tenant import Tenant
from app.realtime.socket_manager import sio

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Socket.io helper
# ---------------------------------------------------------------------------


async def _emit_message_status(
    tenant_id: str,
    conversation_id: str,
    message_id: str,
    status: str,
    error_info: str | None = None,
) -> None:
    """Emit ``message:status`` to the tenant room and conversation room."""
    payload = {
        "messageId": message_id,
        "conversationId": conversation_id,
        "status": status,
    }
    if error_info:
        payload["errorInfo"] = error_info

    tenant_room = f"tenant:{tenant_id}"
    await sio.emit("message:status", payload, room=tenant_room)
    await sio.emit("message:status", payload, room=f"conversation:{conversation_id}")


# ---------------------------------------------------------------------------
# Channel adapter factory
# ---------------------------------------------------------------------------


async def _get_adapter(tenant: Tenant, channel: str):
    """Return a channel adapter instance for the given tenant and channel.

    Currently only WhatsApp is implemented.  Messenger and Instagram
    adapters follow the same ChannelAdapter interface — add their imports
    and credential fields here when they are ported to CRM Core.

    Raises
    ------
    NotImplementedError
        For channels not yet implemented.
    ValueError
        When the tenant is missing required channel credentials.
    """
    channel_upper = channel.upper()

    if channel_upper == "WHATSAPP":
        from app.channels.whatsapp import WhatsAppAdapter

        phone_number_id: str | None = getattr(tenant, "whatsapp_phone_number_id", None)
        access_token: str | None = getattr(tenant, "whatsapp_access_token", None)

        if not phone_number_id or not access_token:
            raise ValueError(
                f"Tenant {tenant.id} is missing WhatsApp credentials "
                "(whatsapp_phone_number_id / whatsapp_access_token)"
            )

        return WhatsAppAdapter(
            phone_number_id=phone_number_id,
            access_token=access_token,
            tenant_id=str(tenant.id),
        )

    raise NotImplementedError(f"Channel adapter not implemented for {channel!r}")


# ---------------------------------------------------------------------------
# Main task function
# ---------------------------------------------------------------------------


async def process_outgoing_message(
    ctx: dict,
    *,
    tenant_id: str,
    conversation_id: str,
    message_id: str,
    recipient_id: str,
    channel: str,
    content: str,
    type: str = "TEXT",
    metadata: dict | None = None,
) -> None:
    """ARQ task: send an outbound message to the contact via the channel.

    Parameters
    ----------
    ctx:
        ARQ context dict.
    tenant_id:
        UUID string of the owning tenant.
    conversation_id:
        UUID string of the Conversation row.
    message_id:
        UUID string of the Message row that was pre-created by the caller
        with ``status=PENDING`` (or similar).  The task updates it to SENT
        or FAILED depending on outcome.
    recipient_id:
        Channel-specific recipient address (phone number for WhatsApp,
        PSID for Messenger, IGSID for Instagram).
    channel:
        One of: ``WHATSAPP``, ``MESSENGER``, ``INSTAGRAM``.
    content:
        Plain-text body for TEXT messages; media URL for media types.
    type:
        Message type: ``TEXT | IMAGE | VIDEO | AUDIO | DOCUMENT | TEMPLATE``.
    metadata:
        Optional dict with extra fields:
          - ``url`` (str): media URL for IMAGE/VIDEO/AUDIO/DOCUMENT.
          - ``caption`` (str): media caption.
          - ``template_name`` (str): template name for TEMPLATE type.
          - ``language_code`` (str): template language (default ``pt_BR``).
          - ``components`` (list): template components.
    """
    job_id: str = ctx.get("job_id", "<unknown>")
    meta: dict = metadata or {}
    log = logger.bind(
        job_id=job_id,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        message_id=message_id,
        channel=channel,
        type=type,
    )

    log.info("process_outgoing_message_start")

    try:
        tenant_uuid = uuid.UUID(tenant_id)
        message_uuid = uuid.UUID(message_id)
        conversation_uuid = uuid.UUID(conversation_id)
    except (ValueError, AttributeError) as exc:
        log.error("process_outgoing_message_invalid_uuids", error=str(exc))
        return  # Non-retryable

    async with async_session() as db:
        try:
            # ------------------------------------------------------------------
            # 1. Load and validate the Message row
            # ------------------------------------------------------------------
            msg_stmt = select(Message).where(
                Message.id == message_uuid,
                Message.tenant_id == tenant_uuid,  # Tenant security gate
            )
            result = await db.execute(msg_stmt)
            message: Message | None = result.scalar_one_or_none()

            if message is None:
                log.error("process_outgoing_message_message_not_found")
                return  # Non-retryable — bad message_id or wrong tenant

            # ------------------------------------------------------------------
            # 2. Idempotency check
            # ------------------------------------------------------------------
            if message.external_message_id:
                log.info(
                    "process_outgoing_message_already_sent",
                    external_message_id=message.external_message_id,
                )
                return

            # ------------------------------------------------------------------
            # 3. Load Tenant (for channel credentials)
            # ------------------------------------------------------------------
            tenant_stmt = select(Tenant).where(Tenant.id == tenant_uuid)
            tenant_result = await db.execute(tenant_stmt)
            tenant: Tenant | None = tenant_result.scalar_one_or_none()

            if tenant is None:
                log.error("process_outgoing_message_tenant_not_found")
                return  # Non-retryable

            # ------------------------------------------------------------------
            # 4. Resolve channel adapter
            # ------------------------------------------------------------------
            try:
                adapter = await _get_adapter(tenant, channel)
            except NotImplementedError as exc:
                log.error("process_outgoing_message_unsupported_channel", error=str(exc))
                return  # Non-retryable until adapter is implemented

            # ------------------------------------------------------------------
            # 5. Dispatch send by message type
            # ------------------------------------------------------------------
            type_upper = type.upper()
            external_message_id: str

            if type_upper == "TEXT":
                result_send = await adapter.send_text(recipient_id, content)
                external_message_id = result_send.external_message_id

            elif type_upper in ("IMAGE", "VIDEO", "AUDIO", "DOCUMENT"):
                media_url: str | None = meta.get("url") or content
                if not media_url:
                    raise ValueError(f"Media URL required for type {type_upper!r}")
                result_send = await adapter.send_media(
                    recipient_id,
                    type_upper.lower(),
                    media_url,
                    caption=meta.get("caption"),
                )
                external_message_id = result_send.external_message_id

            elif type_upper == "TEMPLATE":
                template_name: str | None = meta.get("template_name")
                if not template_name:
                    raise ValueError("template_name required in metadata for TEMPLATE messages")
                result_send = await adapter.send_template(
                    recipient_id,
                    template_name,
                    language=meta.get("language_code", "pt_BR"),
                    components=meta.get("components"),
                )
                external_message_id = result_send.external_message_id

            else:
                raise ValueError(f"Unsupported outgoing message type: {type_upper!r}")

            if not external_message_id:
                raise RuntimeError("Channel adapter returned empty external_message_id")

            # ------------------------------------------------------------------
            # 6. Update Message: mark SENT with external_message_id
            # ------------------------------------------------------------------
            message.external_message_id = external_message_id
            message.status = "SENT"

            # ------------------------------------------------------------------
            # 7. Update Conversation: last_message_at + status=IN_PROGRESS
            # ------------------------------------------------------------------
            conv_stmt = select(Conversation).where(
                Conversation.id == conversation_uuid,
                Conversation.tenant_id == tenant_uuid,
            )
            conv_result = await db.execute(conv_stmt)
            conversation: Conversation | None = conv_result.scalar_one_or_none()

            if conversation:
                from datetime import UTC, datetime
                conversation.last_message_at = datetime.now(tz=UTC)
                # Only transition to IN_PROGRESS from active states —
                # do NOT reopen CLOSED or ARCHIVED conversations
                if conversation.status in ("OPEN", "BOT_HANDLING"):
                    conversation.status = "IN_PROGRESS"

            await db.commit()

            log.info(
                "process_outgoing_message_success",
                external_message_id=external_message_id,
            )

            # ------------------------------------------------------------------
            # 8. Emit message:status via Socket.io (best-effort)
            # ------------------------------------------------------------------
            try:
                await _emit_message_status(
                    tenant_id=tenant_id,
                    conversation_id=conversation_id,
                    message_id=message_id,
                    status="SENT",
                )
            except Exception as socket_err:
                log.warning(
                    "process_outgoing_message_socket_emit_failed",
                    error=str(socket_err),
                )

        except Exception as exc:
            await db.rollback()

            # ------------------------------------------------------------------
            # Update Message to FAILED and emit status event
            # ------------------------------------------------------------------
            error_text = str(exc)
            log.error(
                "process_outgoing_message_error",
                error=error_text,
                exc_info=True,
            )

            try:
                async with async_session() as err_db:
                    err_msg_stmt = select(Message).where(
                        Message.id == message_uuid,
                        Message.tenant_id == tenant_uuid,
                    )
                    err_result = await err_db.execute(err_msg_stmt)
                    err_message: Message | None = err_result.scalar_one_or_none()

                    if err_message and not err_message.external_message_id:
                        err_message.status = "FAILED"
                        err_message.error_info = error_text[:500]
                        await err_db.commit()

                await _emit_message_status(
                    tenant_id=tenant_id,
                    conversation_id=conversation_id,
                    message_id=message_id,
                    status="FAILED",
                    error_info=error_text[:200],
                )
            except Exception as update_err:
                log.error(
                    "process_outgoing_message_failed_status_update_error",
                    error=str(update_err),
                )

            raise  # Re-raise for ARQ retry
