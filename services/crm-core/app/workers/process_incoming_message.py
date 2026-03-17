"""ARQ task: process an inbound message from any channel.

Responsibilities
----------------
1. Find or create a Contact scoped to the tenant.
2. Find or create an active Conversation for that contact.
3. Check idempotency using the channel's external_message_id.
4. Persist the Message (direction=INBOUND, status=DELIVERED).
5. Update conversation.last_message_at; reopen CLOSED conversations.
6. Emit Socket.io events: ``message:new`` and ``conversation:updated``
   (or ``conversation:new`` for newly-created conversations).
7. If ia_locked is False, forward to the AI/N8N pipeline for processing.
8. Increment monthly usage counters (messages + conversations if new).

Idempotency
-----------
The task is safe to retry.  If the external_message_id already exists in
the ``messages`` table the duplicate is silently dropped (step 3).

Error handling
--------------
Unhandled exceptions are re-raised so ARQ marks the job as failed and
retries it (up to ``WorkerSettings.max_retries`` times, if configured).
Errors that are expected and non-retryable (e.g. tenant not found) are
logged and return early without raising so as not to waste retry budget.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, date

import structlog
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError

from app.core.database import async_session
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.usage_tracking import UsageTracking
from app.realtime.socket_manager import sio

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Phone normalisation — mirrors TypeScript normalizeBrazilianPhone()
# ---------------------------------------------------------------------------

_BR_COUNTRY_CODE = "55"


def _normalize_brazilian_phone(raw: str) -> str:
    """Normalise a Brazilian phone number to 13-digit E.164 format.

    WhatsApp delivers numbers without the ``+`` prefix and sometimes
    omits the 9th digit on mobile numbers.  This function ensures the
    canonical form ``55XXXXXXXXXXX`` (13 digits) so contacts are not
    duplicated due to formatting differences.

    Non-Brazilian numbers (country code != 55) are returned unchanged.
    """
    digits_only = "".join(ch for ch in raw if ch.isdigit())

    # Already 13 digits (correct)
    if len(digits_only) == 13 and digits_only.startswith(_BR_COUNTRY_CODE):
        return digits_only

    # 12 digits — missing the 9th digit on the mobile number
    if len(digits_only) == 12 and digits_only.startswith(_BR_COUNTRY_CODE):
        area = digits_only[2:4]
        number = digits_only[4:]
        return f"{_BR_COUNTRY_CODE}{area}9{number}"

    # 11 digits — no country code, has 9th digit (e.g. 11 9XXXX-XXXX)
    if len(digits_only) == 11:
        return f"{_BR_COUNTRY_CODE}{digits_only}"

    # 10 digits — no country code, no 9th digit (legacy landline format)
    if len(digits_only) == 10:
        area = digits_only[:2]
        number = digits_only[2:]
        return f"{_BR_COUNTRY_CODE}{area}9{number}"

    # International or unknown format — return as-is
    return digits_only


# ---------------------------------------------------------------------------
# Contact helpers
# ---------------------------------------------------------------------------


async def _find_or_create_contact(
    db,
    tenant_id: uuid.UUID,
    channel: str,
    contact_phone: str | None,
    contact_external_id: str | None,
    contact_name: str | None,
) -> Contact:
    """Return an existing Contact or create a new one.

    Lookup strategy:
    - WhatsApp: match on ``mobile_no`` (normalised phone).
    - Messenger / Instagram: match on ``external_id`` column (not present
      in the current model so we fall back to ``mobile_no`` if the channel
      provides a phone, otherwise external_id stored in ``email`` field as
      a temporary placeholder — the model should gain an external_id column
      in a future migration, tracked in TODO below).

    TODO: Add ``external_id`` varchar column to contacts table via Alembic
          migration so Messenger/Instagram contacts are first-class.
    """
    # Normalise lookup key per channel
    lookup_phone: str | None = None
    if channel == "WHATSAPP" and contact_phone:
        lookup_phone = _normalize_brazilian_phone(contact_phone)

    # --- Try to find existing contact ---
    stmt = select(Contact).where(Contact.tenant_id == tenant_id)

    if lookup_phone:
        stmt = stmt.where(Contact.mobile_no == lookup_phone)
    elif contact_external_id:
        # Messenger / Instagram: store external_id in email field for now
        # (unique per tenant scoped by channel — acceptable until migration)
        stmt = stmt.where(Contact.email == contact_external_id)
    else:
        raise ValueError("Either contact_phone or contact_external_id is required")

    result = await db.execute(stmt)
    contact: Contact | None = result.scalar_one_or_none()

    if contact:
        # Update display name if it changed and we now have one
        if contact_name and contact_name != contact.full_name:
            contact.full_name = contact_name
            await db.flush()
        return contact

    # --- Create new contact ---
    first_name: str = "Unknown"
    last_name: str | None = None

    if contact_name:
        parts = contact_name.strip().split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else None

    new_contact = Contact(
        tenant_id=tenant_id,
        first_name=first_name,
        last_name=last_name,
        full_name=contact_name,
        mobile_no=lookup_phone,
        # Messenger/Instagram: store external_id in email field temporarily
        email=contact_external_id if not lookup_phone else None,
    )
    db.add(new_contact)
    await db.flush()  # Populate new_contact.id without committing the transaction

    logger.info(
        "contact_created",
        tenant_id=str(tenant_id),
        contact_id=str(new_contact.id),
        channel=channel,
        has_phone=bool(lookup_phone),
    )
    return new_contact


# ---------------------------------------------------------------------------
# Conversation helpers
# ---------------------------------------------------------------------------

_ACTIVE_STATUSES = ("BOT_HANDLING", "OPEN", "IN_PROGRESS", "WAITING")


async def _find_or_create_conversation(
    db,
    tenant_id: uuid.UUID,
    contact_id: uuid.UUID,
    channel: str,
) -> tuple[Conversation, bool]:
    """Return the active conversation for this contact, or create one.

    Returns a ``(conversation, is_new)`` tuple.  ``is_new`` is True when
    a new Conversation row was inserted so the caller can emit
    ``conversation:new`` instead of ``conversation:updated``.
    """
    stmt = (
        select(Conversation)
        .where(
            Conversation.tenant_id == tenant_id,
            Conversation.contact_id == contact_id,
            Conversation.status.in_(_ACTIVE_STATUSES),
        )
        .order_by(Conversation.last_message_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    conversation: Conversation | None = result.scalar_one_or_none()

    if conversation:
        return conversation, False

    conversation = Conversation(
        tenant_id=tenant_id,
        contact_id=contact_id,
        channel=channel.upper(),
        status="OPEN",
        priority="MEDIUM",
        last_message_at=datetime.now(tz=UTC),
        source="webhook",
    )
    db.add(conversation)
    await db.flush()

    logger.info(
        "conversation_created",
        tenant_id=str(tenant_id),
        conversation_id=str(conversation.id),
        contact_id=str(contact_id),
        channel=channel,
    )
    return conversation, True


# ---------------------------------------------------------------------------
# Usage tracking upsert
# ---------------------------------------------------------------------------


async def _increment_usage(
    db,
    tenant_id: uuid.UUID,
    *,
    new_conversation: bool,
) -> None:
    """Atomically increment the monthly usage counters for the tenant.

    Uses a PostgreSQL INSERT ... ON CONFLICT DO UPDATE (upsert) so the
    operation is safe even when multiple workers run concurrently.
    """
    period = date.today().replace(day=1)

    stmt = (
        pg_insert(UsageTracking)
        .values(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            period=period,
            messages_count=1,
            conversations_count=1 if new_conversation else 0,
            active_users=0,
        )
        .on_conflict_do_update(
            constraint="uq_usage_tracking_tenant_period",
            set_={
                "messages_count": UsageTracking.messages_count + 1,
                "conversations_count": (
                    UsageTracking.conversations_count + (1 if new_conversation else 0)
                ),
            },
        )
    )
    await db.execute(stmt)


# ---------------------------------------------------------------------------
# Socket.io emission helpers
# ---------------------------------------------------------------------------


async def _emit_message_new(
    tenant_id: str,
    conversation_id: str,
    message: Message,
    contact: Contact,
    conversation: Conversation,
    is_new_conversation: bool,
) -> None:
    """Emit Socket.io events for a new inbound message.

    Rooms targeted:
    - ``tenant:{tenant_id}``         — all authenticated users of this tenant
    - ``tenant:{tenant_id}:admins``  — admins who see every conversation
    - ``tenant:{tenant_id}:unit:{hotel_unit}`` — attendants for the hotel unit
    """
    tenant_room = f"tenant:{tenant_id}"

    message_payload = {
        "id": str(message.id),
        "conversationId": conversation_id,
        "externalMessageId": message.external_message_id,
        "direction": message.direction,
        "type": message.type,
        "content": message.content,
        "metadata": message.metadata_json,
        "status": message.status,
        "timestamp": message.timestamp.isoformat() if message.timestamp else None,
        "contactId": str(contact.id),
    }

    conversation_payload = {
        "id": conversation_id,
        "status": conversation.status,
        "channel": conversation.channel,
        "hotelUnit": conversation.hotel_unit,
        "lastMessageAt": (
            conversation.last_message_at.isoformat() if conversation.last_message_at else None
        ),
        "contact": {
            "id": str(contact.id),
            "fullName": contact.full_name,
            "mobileNo": contact.mobile_no,
            "imageUrl": contact.image_url,
        },
    }

    event_name = "conversation:new" if is_new_conversation else "conversation:updated"

    await sio.emit(
        "message:new",
        {"message": message_payload, "conversation": conversation_payload},
        room=tenant_room,
    )
    await sio.emit(event_name, conversation_payload, room=tenant_room)

    if conversation.hotel_unit:
        unit_room = f"tenant:{tenant_id}:unit:{conversation.hotel_unit}"
        await sio.emit(
            "message:new",
            {"message": message_payload, "conversation": conversation_payload},
            room=unit_room,
        )
        await sio.emit(event_name, conversation_payload, room=unit_room)


# ---------------------------------------------------------------------------
# Main task function
# ---------------------------------------------------------------------------


async def process_incoming_message(
    ctx: dict,
    *,
    tenant_id: str,
    channel: str,
    message_data: dict,
    contact_phone: str | None = None,
    contact_external_id: str | None = None,
    contact_name: str | None = None,
) -> None:
    """ARQ task: persist an inbound message and trigger downstream processing.

    Parameters
    ----------
    ctx:
        ARQ context dict (contains ``job_id``, ``redis``, etc.).
    tenant_id:
        UUID string of the tenant that owns this message.
    channel:
        One of: ``WHATSAPP``, ``MESSENGER``, ``INSTAGRAM``.
    message_data:
        Dict with keys:
          - ``type`` (str): TEXT | IMAGE | VIDEO | AUDIO | DOCUMENT | LOCATION | etc.
          - ``content`` (str | None): plain text body or media ID.
          - ``external_id`` (str | None): platform message ID for deduplication.
          - ``timestamp`` (str | None): ISO-8601 or Unix timestamp string.
          - ``media`` (dict | None): sub-dict with ``mime_type``, ``media_id``.
          - ``metadata`` (dict | None): arbitrary extra payload.
    contact_phone:
        E.164 phone number (WhatsApp).  Mutually exclusive with
        ``contact_external_id``.
    contact_external_id:
        Platform user ID (Messenger / Instagram).
    contact_name:
        Display name from the channel profile.
    """
    job_id: str = ctx.get("job_id", "<unknown>")
    log = logger.bind(
        job_id=job_id,
        tenant_id=tenant_id,
        channel=channel,
        external_message_id=message_data.get("external_id"),
    )

    log.info("process_incoming_message_start")

    try:
        tenant_uuid = uuid.UUID(tenant_id)
    except (ValueError, AttributeError):
        log.error("process_incoming_message_invalid_tenant_id")
        return  # Non-retryable — bad input

    external_message_id: str | None = message_data.get("external_id")

    async with async_session() as db:
        try:
            # ------------------------------------------------------------------
            # 1. Idempotency check — bail out early if already processed
            # ------------------------------------------------------------------
            if external_message_id:
                dup_stmt = select(Message.id).where(
                    Message.external_message_id == external_message_id,
                    Message.tenant_id == tenant_uuid,
                )
                dup_result = await db.execute(dup_stmt)
                if dup_result.scalar_one_or_none() is not None:
                    log.info("process_incoming_message_duplicate_skipped")
                    return

            # ------------------------------------------------------------------
            # 2. Find or create Contact
            # ------------------------------------------------------------------
            contact = await _find_or_create_contact(
                db,
                tenant_uuid,
                channel,
                contact_phone,
                contact_external_id,
                contact_name,
            )

            # ------------------------------------------------------------------
            # 3. Find or create Conversation
            # ------------------------------------------------------------------
            conversation, is_new_conversation = await _find_or_create_conversation(
                db,
                tenant_uuid,
                contact.id,
                channel,
            )

            # ------------------------------------------------------------------
            # 4. Reopen CLOSED conversation on new inbound message
            # ------------------------------------------------------------------
            if conversation.status == "CLOSED":
                conversation.status = "OPEN"

            # ------------------------------------------------------------------
            # 5. Parse timestamp
            # ------------------------------------------------------------------
            raw_ts = message_data.get("timestamp")
            if raw_ts:
                try:
                    # Unix timestamp (string of digits, as WhatsApp sends)
                    msg_ts = datetime.fromtimestamp(int(raw_ts), tz=UTC)
                except (ValueError, TypeError):
                    try:
                        msg_ts = datetime.fromisoformat(str(raw_ts))
                    except ValueError:
                        msg_ts = datetime.now(tz=UTC)
            else:
                msg_ts = datetime.now(tz=UTC)

            # ------------------------------------------------------------------
            # 6. Persist Message
            # ------------------------------------------------------------------
            message = Message(
                tenant_id=tenant_uuid,
                conversation_id=conversation.id,
                external_message_id=external_message_id,
                direction="INBOUND",
                type=message_data.get("type", "TEXT").upper(),
                content=message_data.get("content"),
                metadata_json=message_data.get("metadata"),
                status="DELIVERED",
                timestamp=msg_ts,
                sender_name=contact_name,
            )
            db.add(message)

            # ------------------------------------------------------------------
            # 7. Update conversation.last_message_at
            # ------------------------------------------------------------------
            conversation.last_message_at = msg_ts

            try:
                await db.commit()
                await db.refresh(message)
                await db.refresh(conversation)
                await db.refresh(contact)
            except IntegrityError:
                # Race condition: another worker inserted the same external_message_id
                await db.rollback()
                log.warning("process_incoming_message_integrity_error_on_commit_dedup")
                return

            # ------------------------------------------------------------------
            # 8. Emit Socket.io events (best-effort — never crash the task)
            # ------------------------------------------------------------------
            try:
                await _emit_message_new(
                    tenant_id=tenant_id,
                    conversation_id=str(conversation.id),
                    message=message,
                    contact=contact,
                    conversation=conversation,
                    is_new_conversation=is_new_conversation,
                )
            except Exception as socket_err:
                log.warning(
                    "process_incoming_message_socket_emit_failed",
                    error=str(socket_err),
                )

            # ------------------------------------------------------------------
            # 9. Forward to AI / N8N if ia_locked is False
            # ------------------------------------------------------------------
            if not conversation.ia_locked:
                _forward_to_ai_pipeline(
                    tenant_id=tenant_id,
                    conversation_id=str(conversation.id),
                    message_id=str(message.id),
                    contact_phone=contact.mobile_no,
                    contact_name=contact.full_name,
                    channel=channel,
                    message_data=message_data,
                    log=log,
                )
            else:
                log.debug(
                    "process_incoming_message_ai_skipped_ia_locked",
                    conversation_id=str(conversation.id),
                )

            # ------------------------------------------------------------------
            # 10. Increment usage counters (best-effort — separate session)
            # ------------------------------------------------------------------
            try:
                async with async_session() as usage_db:
                    await _increment_usage(
                        usage_db,
                        tenant_uuid,
                        new_conversation=is_new_conversation,
                    )
                    await usage_db.commit()
            except Exception as usage_err:
                log.warning(
                    "process_incoming_message_usage_increment_failed",
                    error=str(usage_err),
                )

            log.info(
                "process_incoming_message_success",
                message_id=str(message.id),
                conversation_id=str(conversation.id),
                contact_id=str(contact.id),
                is_new_conversation=is_new_conversation,
            )

        except Exception as exc:
            await db.rollback()
            log.error(
                "process_incoming_message_error",
                error=str(exc),
                exc_info=True,
            )
            raise  # Re-raise for ARQ retry


def _forward_to_ai_pipeline(
    *,
    tenant_id: str,
    conversation_id: str,
    message_id: str,
    contact_phone: str | None,
    contact_name: str | None,
    channel: str,
    message_data: dict,
    log,
) -> None:
    """Fire-and-forget: hand the message off to the AI/N8N pipeline.

    This is intentionally synchronous-looking but internally schedules
    an async task via the event loop.  We use ``asyncio.create_task`` so
    that a failure in the AI pipeline does not fail this worker job.

    The actual integration point (EVA orchestrator, N8N HTTP call, etc.)
    is intentionally left as a stub here — wire it up to the concrete
    service once the channel-routing layer is in place for CRM Core.
    """
    import asyncio

    # Module-level set to hold task references and prevent GC
    if not hasattr(_forward_to_ai_pipeline, "_tasks"):
        _forward_to_ai_pipeline._tasks = set()  # type: ignore[attr-defined]

    async def _call_ai() -> None:
        try:
            # TODO: replace this stub with the actual EVA/N8N service call.
            log.info(
                "process_incoming_message_ai_forward_stub",
                tenant_id=tenant_id,
                conversation_id=conversation_id,
                message_id=message_id,
                channel=channel,
            )
        except Exception as ai_err:
            log.error(
                "process_incoming_message_ai_forward_failed",
                tenant_id=tenant_id,
                conversation_id=conversation_id,
                error=str(ai_err),
            )

    task = asyncio.create_task(_call_ai())
    _forward_to_ai_pipeline._tasks.add(task)  # type: ignore[attr-defined]
    task.add_done_callback(_forward_to_ai_pipeline._tasks.discard)  # type: ignore[attr-defined]
