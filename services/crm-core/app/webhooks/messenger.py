"""Facebook Messenger webhook handler.

Endpoints:
  GET  /webhooks/messenger  — Meta subscription challenge verification
  POST /webhooks/messenger  — Inbound messaging events

Tenant resolution:
  Messenger sends ``entry[].id`` which is the Facebook Page ID.
  We match it against ``tenants.messenger_page_id``.

Filtering:
  - Events with ``message.is_echo == True`` are sent by the page itself; skip.
  - Events where ``sender.id == entry.id`` (page_id) are sent by the page; skip.
  - ``delivery`` and ``read`` receipts are informational; skip.

Processing:
  The HTTP response is sent immediately after basic validation.  All DB writes
  and downstream dispatch happen in BackgroundTasks to stay under Meta's 5-second
  deadline.
"""

from __future__ import annotations

import uuid
from typing import Any

import hmac

import structlog
from fastapi import APIRouter, BackgroundTasks, Query, Request, Response
from fastapi.responses import PlainTextResponse
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.core.config import settings
from app.webhooks.security import validate_webhook_signature
from app.models.tenant import Tenant
from app.models.webhook_event import WebhookEvent
from app.webhooks.payload_types import (
    MessengerEntry,
    MessengerEvent,
    MessengerWebhookPayload,
)

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Tenant resolution
# ---------------------------------------------------------------------------


async def _resolve_tenant_by_page_id(
    db: AsyncSession,
    page_id: str,
) -> Tenant | None:
    """Find an active tenant whose messenger_page_id matches."""
    result = await db.execute(
        select(Tenant).where(
            Tenant.messenger_page_id == page_id,
            Tenant.status == "ACTIVE",
        )
    )
    tenant = result.scalar_one_or_none()
    if tenant:
        return tenant

    # Fallback: single-tenant env var (useful in dev/staging)
    env_page_id = getattr(settings, "MESSENGER_PAGE_ID", None)
    if env_page_id and env_page_id == page_id:
        fallback_result = await db.execute(
            select(Tenant)
            .where(Tenant.status == "ACTIVE")
            .order_by(Tenant.created_at.asc())
            .limit(1)
        )
        return fallback_result.scalar_one_or_none()

    return None


# ---------------------------------------------------------------------------
# Persistence helper
# ---------------------------------------------------------------------------


async def _persist_event(
    tenant_id: uuid.UUID,
    event_dict: dict[str, Any],
    error: str | None = None,
) -> None:
    try:
        async with async_session() as db:
            db.add(
                WebhookEvent(
                    tenant_id=tenant_id,
                    source="messenger",
                    event="messaging",
                    payload=event_dict,
                    processed=False,
                    error=error,
                )
            )
            await db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "messenger_webhook.persist_event_failed",
            tenant_id=str(tenant_id),
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# GET /webhooks/messenger — challenge verification
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="Messenger webhook verification (Meta)",
    include_in_schema=False,
)
async def verify_messenger(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
) -> PlainTextResponse:
    """Confirm webhook ownership by returning hub.challenge."""
    if not hub_mode or not hub_verify_token or not hub_challenge:
        logger.warning("messenger_webhook.verify.missing_params")
        return PlainTextResponse("Missing parameters", status_code=400)

    if hub_mode != "subscribe":
        logger.warning("messenger_webhook.verify.invalid_mode", mode=hub_mode)
        return PlainTextResponse("Invalid mode", status_code=400)

    expected_token = getattr(settings, "MESSENGER_WEBHOOK_VERIFY_TOKEN", None)
    if not expected_token:
        logger.error("messenger_webhook.verify.token_not_configured")
        return PlainTextResponse("Webhook not configured", status_code=403)

    if not hmac.compare_digest(hub_verify_token, expected_token):
        logger.warning("messenger_webhook.verify.token_mismatch")
        return PlainTextResponse("Verification failed", status_code=403)

    logger.info("messenger_webhook.verified")
    return PlainTextResponse(hub_challenge, status_code=200)


# ---------------------------------------------------------------------------
# POST /webhooks/messenger — receive events
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Messenger webhook events (Meta)",
    include_in_schema=False,
)
async def handle_messenger(
    request: Request,
    background_tasks: BackgroundTasks,
) -> Response:
    """Receive Messenger messaging events.

    Validates X-Hub-Signature-256 HMAC before processing.
    Responds 200 immediately; processing is delegated to BackgroundTasks.
    """
    # Read raw body for HMAC validation
    raw_body = await request.body()

    # Validate HMAC signature (same as WhatsApp webhook)
    app_secret = getattr(settings, "META_APP_SECRET", None) or getattr(
        settings, "MESSENGER_APP_SECRET", None
    )
    signature = request.headers.get("X-Hub-Signature-256", "")
    if app_secret and signature:
        if not validate_webhook_signature(raw_body, signature, app_secret):
            logger.warning("messenger_webhook.invalid_signature")
            return Response(content="Invalid signature", status_code=403)
    elif app_secret and not signature:
        logger.warning("messenger_webhook.missing_signature")
        return Response(content="Missing signature", status_code=403)

    try:
        body_json: dict[str, Any] = await request.json()
    except Exception:  # noqa: BLE001
        logger.error("messenger_webhook.json_parse_failed")
        return Response(content="EVENT_RECEIVED", status_code=200)

    if body_json.get("object") != "page":
        logger.warning("messenger_webhook.wrong_object", object=body_json.get("object"))
        return Response(content="Not Found", status_code=404)

    # Return 200 immediately — Meta requires < 5 seconds
    response = Response(content="EVENT_RECEIVED", status_code=200)

    try:
        webhook = MessengerWebhookPayload.model_validate(body_json)
    except ValidationError as exc:
        logger.error("messenger_webhook.invalid_payload", error=str(exc))
        return response

    logger.info("messenger_webhook.received", entry_count=len(webhook.entry))

    for entry in webhook.entry:
        background_tasks.add_task(_process_entry, entry, body_json)

    return response


# ---------------------------------------------------------------------------
# Background processing
# ---------------------------------------------------------------------------


async def _process_entry(
    entry: MessengerEntry,
    raw_payload: dict[str, Any],
) -> None:
    page_id = entry.id

    async with async_session() as db:
        tenant = await _resolve_tenant_by_page_id(db, page_id)

    if not tenant:
        logger.warning("messenger_webhook.unknown_page_id", page_id=page_id)
        return

    logger.info(
        "messenger_webhook.tenant_resolved",
        page_id=page_id,
        tenant_id=str(tenant.id),
    )

    for event in entry.messaging:
        await _process_event(tenant.id, page_id, event, raw_payload)


async def _process_event(
    tenant_id: uuid.UUID,
    page_id: str,
    event: MessengerEvent,
    raw_payload: dict[str, Any],
) -> None:
    sender_id = event.sender.id if event.sender else None

    if not sender_id:
        logger.warning(
            "messenger_webhook.event_no_sender_id",
            tenant_id=str(tenant_id),
        )
        return

    # Skip echo messages — sent by the page bot itself
    if event.message and event.message.is_echo:
        logger.debug(
            "messenger_webhook.echo_skipped",
            tenant_id=str(tenant_id),
            sender_id=sender_id,
            mid=event.message.mid,
        )
        return

    # Skip events where sender is the page itself
    if sender_id == page_id:
        logger.debug(
            "messenger_webhook.own_message_skipped",
            tenant_id=str(tenant_id),
            sender_id=sender_id,
        )
        return

    # Classify event type
    if event.delivery or event.read:
        # Delivery/read receipts are informational only
        logger.debug(
            "messenger_webhook.receipt_skipped",
            tenant_id=str(tenant_id),
            sender_id=sender_id,
            is_delivery=bool(event.delivery),
            is_read=bool(event.read),
        )
        return

    if event.message:
        event_type = "message"
    elif event.postback:
        event_type = "postback"
    else:
        logger.warning(
            "messenger_webhook.unknown_event_type",
            tenant_id=str(tenant_id),
            sender_id=sender_id,
        )
        return

    logger.info(
        "messenger_webhook.event_accepted",
        tenant_id=str(tenant_id),
        sender_id=sender_id,
        event_type=event_type,
        has_text=bool(event.message and event.message.text) if event.message else False,
        has_attachments=bool(event.message and event.message.attachments) if event.message else False,
        mid=event.message.mid if event.message else None,
    )

    # Persist raw event for idempotent reprocessing
    await _persist_event(tenant_id, raw_payload)

    if event.message:
        # TODO: Dispatch to message processing worker/queue
        logger.info(
            "messenger_webhook.message_enqueued",
            tenant_id=str(tenant_id),
            sender_id=sender_id,
            mid=event.message.mid,
        )
    elif event.postback:
        # TODO: Dispatch to postback processing worker/queue
        logger.info(
            "messenger_webhook.postback_enqueued",
            tenant_id=str(tenant_id),
            sender_id=sender_id,
            postback_title=event.postback.title,
        )
