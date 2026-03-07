"""Instagram Messaging API webhook handler.

Endpoints:
  GET  /webhooks/instagram  — Meta subscription challenge verification
  POST /webhooks/instagram  — Inbound DM and postback events

Tenant resolution:
  Instagram sends ``entry[].id`` which is the Instagram Account ID.
  We match it against ``tenants.instagram_page_id``.

Filtering:
  - Events with ``message.is_echo == True`` are outbound messages sent by
    the IG account itself; skip.
  - Events where ``sender.id == entry.id`` (ig_account_id) indicate the
    account is messaging itself; skip.
  - ``delivery`` and ``read`` receipts are informational; skip.
  - Unrecognised event shapes are logged and discarded.

Processing:
  The HTTP response is sent immediately after basic validation.  All DB writes
  and downstream dispatch happen in BackgroundTasks.
"""

from __future__ import annotations

import uuid
from typing import Any

import hmac

import structlog
from fastapi import APIRouter, BackgroundTasks, Query, Request, Response
from fastapi.responses import PlainTextResponse

from app.core.rate_limit import WEBHOOK_RATE_LIMIT, get_client_ip, limiter
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.core.config import settings
from app.webhooks.security import validate_webhook_signature
from app.models.tenant import Tenant
from app.models.webhook_event import WebhookEvent
from app.webhooks.payload_types import (
    InstagramEntry,
    InstagramEvent,
    InstagramWebhookPayload,
)

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Tenant resolution
# ---------------------------------------------------------------------------


async def _resolve_tenant_by_ig_account_id(
    db: AsyncSession,
    ig_account_id: str,
) -> Tenant | None:
    """Find an active tenant whose instagram_page_id matches the IG account ID."""
    result = await db.execute(
        select(Tenant).where(
            Tenant.instagram_page_id == ig_account_id,
            Tenant.status == "ACTIVE",
        )
    )
    tenant = result.scalar_one_or_none()
    if tenant:
        return tenant

    # Fallback: single-tenant env var (useful in dev/staging)
    env_account_id = getattr(settings, "INSTAGRAM_ACCOUNT_ID", None)
    if env_account_id and env_account_id == ig_account_id:
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
                    source="instagram",
                    event="messaging",
                    payload=event_dict,
                    processed=False,
                    error=error,
                )
            )
            await db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "instagram_webhook.persist_event_failed",
            tenant_id=str(tenant_id),
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# GET /webhooks/instagram — challenge verification
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="Instagram webhook verification (Meta)",
    include_in_schema=False,
)
async def verify_instagram(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
) -> PlainTextResponse:
    """Confirm webhook ownership by returning hub.challenge."""
    if not hub_mode or not hub_verify_token or not hub_challenge:
        logger.warning("instagram_webhook.verify.missing_params")
        return PlainTextResponse("Missing parameters", status_code=400)

    if hub_mode != "subscribe":
        logger.warning("instagram_webhook.verify.invalid_mode", mode=hub_mode)
        return PlainTextResponse("Invalid mode", status_code=400)

    expected_token = getattr(settings, "INSTAGRAM_WEBHOOK_VERIFY_TOKEN", None)
    if not expected_token:
        logger.error("instagram_webhook.verify.token_not_configured")
        return PlainTextResponse("Webhook not configured", status_code=403)

    if not hmac.compare_digest(hub_verify_token, expected_token):
        logger.warning("instagram_webhook.verify.token_mismatch")
        return PlainTextResponse("Verification failed", status_code=403)

    logger.info("instagram_webhook.verified")
    return PlainTextResponse(hub_challenge, status_code=200)


# ---------------------------------------------------------------------------
# POST /webhooks/instagram — receive events
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Instagram webhook events (Meta)",
    include_in_schema=False,
)
@limiter.limit(WEBHOOK_RATE_LIMIT, key_func=get_client_ip)
async def handle_instagram(
    request: Request,
    background_tasks: BackgroundTasks,
) -> Response:
    """Receive Instagram messaging events.

    Validates X-Hub-Signature-256 HMAC before processing.
    Responds 200 immediately; processing is delegated to BackgroundTasks.
    """
    # Read raw body for HMAC validation
    raw_body = await request.body()

    # Validate HMAC signature (same as WhatsApp webhook)
    app_secret = getattr(settings, "META_APP_SECRET", None) or getattr(
        settings, "INSTAGRAM_APP_SECRET", None
    )
    signature = request.headers.get("X-Hub-Signature-256", "")
    if app_secret and signature:
        if not validate_webhook_signature(raw_body, signature, app_secret):
            logger.warning("instagram_webhook.invalid_signature")
            return Response(content="Invalid signature", status_code=403)
    elif app_secret and not signature:
        logger.warning("instagram_webhook.missing_signature")
        return Response(content="Missing signature", status_code=403)

    try:
        body_json: dict[str, Any] = await request.json()
    except Exception:  # noqa: BLE001
        logger.error("instagram_webhook.json_parse_failed")
        return Response(content="EVENT_RECEIVED", status_code=200)

    if body_json.get("object") != "instagram":
        logger.warning(
            "instagram_webhook.wrong_object",
            object=body_json.get("object"),
        )
        return Response(content="Not Found", status_code=404)

    # Return 200 immediately — Meta requires < 5 seconds
    response = Response(content="EVENT_RECEIVED", status_code=200)

    try:
        webhook = InstagramWebhookPayload.model_validate(body_json)
    except ValidationError as exc:
        logger.error("instagram_webhook.invalid_payload", error=str(exc))
        return response

    logger.info("instagram_webhook.received", entry_count=len(webhook.entry))

    for entry in webhook.entry:
        background_tasks.add_task(_process_entry, entry, body_json)

    return response


# ---------------------------------------------------------------------------
# Background processing
# ---------------------------------------------------------------------------


async def _process_entry(
    entry: InstagramEntry,
    raw_payload: dict[str, Any],
) -> None:
    ig_account_id = entry.id

    async with async_session() as db:
        tenant = await _resolve_tenant_by_ig_account_id(db, ig_account_id)

    if not tenant:
        logger.warning(
            "instagram_webhook.unknown_account_id",
            ig_account_id=ig_account_id,
        )
        return

    logger.info(
        "instagram_webhook.tenant_resolved",
        ig_account_id=ig_account_id,
        tenant_id=str(tenant.id),
    )

    for event in entry.messaging:
        await _process_event(tenant.id, ig_account_id, event, raw_payload)


async def _process_event(
    tenant_id: uuid.UUID,
    ig_account_id: str,
    event: InstagramEvent,
    raw_payload: dict[str, Any],
) -> None:
    sender_id = event.sender.id if event.sender else None

    if not sender_id:
        logger.warning(
            "instagram_webhook.event_no_sender_id",
            tenant_id=str(tenant_id),
        )
        return

    # Skip echo messages — sent by the IG account itself
    if event.message and event.message.is_echo:
        logger.debug(
            "instagram_webhook.echo_skipped",
            tenant_id=str(tenant_id),
            sender_id=sender_id,
            mid=event.message.mid,
        )
        return

    # Skip events where sender is the IG account itself
    if sender_id == ig_account_id:
        logger.debug(
            "instagram_webhook.own_message_skipped",
            tenant_id=str(tenant_id),
            sender_id=sender_id,
        )
        return

    # Delivery/read receipts are informational only
    if event.delivery or event.read:
        logger.debug(
            "instagram_webhook.receipt_skipped",
            tenant_id=str(tenant_id),
            sender_id=sender_id,
            is_delivery=bool(event.delivery),
            is_read=bool(event.read),
        )
        return

    # Classify event type
    if event.message:
        event_type = "message"
    elif event.postback:
        event_type = "postback"
    else:
        logger.warning(
            "instagram_webhook.unknown_event_type",
            tenant_id=str(tenant_id),
            sender_id=sender_id,
        )
        return

    logger.info(
        "instagram_webhook.event_accepted",
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
            "instagram_webhook.message_enqueued",
            tenant_id=str(tenant_id),
            sender_id=sender_id,
            mid=event.message.mid,
        )
    elif event.postback:
        # TODO: Dispatch to postback processing worker/queue
        logger.info(
            "instagram_webhook.postback_enqueued",
            tenant_id=str(tenant_id),
            sender_id=sender_id,
            postback_title=event.postback.title,
        )
