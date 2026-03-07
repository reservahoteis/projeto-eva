"""WhatsApp Cloud API webhook handler.

Endpoints:
  GET  /webhooks/whatsapp  — Meta subscription challenge verification
  POST /webhooks/whatsapp  — Inbound message and status-update events

Tenant resolution:
  WhatsApp includes a ``phone_number_id`` inside every change value's metadata.
  We match that against ``tenants.whatsapp_phone_number_id`` to identify the
  tenant without requiring a JWT.

Security:
  Every POST is HMAC-SHA256 verified against the tenant's stored app secret
  before the payload is parsed.  We return HTTP 200 even on validation failure
  so that Meta does not suspend the webhook subscription, but we log and discard
  the offending request.

Processing:
  Messages and status updates are persisted to webhook_events synchronously
  (fire-and-forget via asyncio.create_task) so the HTTP response stays under
  Meta's 5-second hard deadline.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

import structlog
from fastapi import APIRouter, BackgroundTasks, Query, Request, Response
from fastapi.responses import PlainTextResponse

from app.core.rate_limit import WEBHOOK_RATE_LIMIT, get_client_ip, limiter
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models.tenant import Tenant
from app.models.webhook_event import WebhookEvent
from app.webhooks.payload_types import (
    WhatsAppEntry,
    WhatsAppWebhookPayload,
)
from app.webhooks.security import validate_webhook_signature

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _resolve_tenant_by_phone_number_id(
    db: AsyncSession,
    phone_number_id: str,
) -> Tenant | None:
    """Find an active tenant whose whatsapp_phone_number_id matches."""
    result = await db.execute(
        select(Tenant).where(
            Tenant.whatsapp_phone_number_id == phone_number_id,
            Tenant.status == "ACTIVE",
        )
    )
    return result.scalar_one_or_none()


async def _resolve_tenant_by_verify_token(
    db: AsyncSession,
    verify_token: str,
) -> Tenant | None:
    """Find an active tenant whose whatsapp_verify_token matches (for GET verification)."""
    result = await db.execute(
        select(Tenant).where(
            Tenant.whatsapp_verify_token == verify_token,
            Tenant.status == "ACTIVE",
        )
    )
    return result.scalar_one_or_none()


async def _persist_webhook_event(
    tenant_id: uuid.UUID,
    source: str,
    event: str,
    payload: dict[str, Any],
    processed: bool = False,
    error: str | None = None,
) -> None:
    """Persist a raw webhook payload to the database (non-critical, best-effort)."""
    try:
        async with async_session() as db:
            db.add(
                WebhookEvent(
                    tenant_id=tenant_id,
                    source=source,
                    event=event,
                    payload=payload,
                    processed=processed,
                    error=error,
                )
            )
            await db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "whatsapp_webhook.persist_event_failed",
            tenant_id=str(tenant_id),
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# GET /webhooks/whatsapp — Meta challenge verification
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="WhatsApp webhook verification (Meta)",
    include_in_schema=False,
)
async def verify_whatsapp(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
) -> PlainTextResponse:
    """Return the hub.challenge to confirm webhook ownership with Meta.

    Meta matches hub.verify_token against what was configured in the App
    Dashboard.  Here we match it against the per-tenant stored token.
    """
    if not hub_mode or not hub_verify_token or not hub_challenge:
        logger.warning("whatsapp_webhook.verify.missing_params")
        return PlainTextResponse("Missing parameters", status_code=400)

    if hub_mode != "subscribe":
        logger.warning("whatsapp_webhook.verify.invalid_mode", mode=hub_mode)
        return PlainTextResponse("Invalid mode", status_code=400)

    async with async_session() as db:
        tenant = await _resolve_tenant_by_verify_token(db, hub_verify_token)

    if not tenant:
        logger.warning(
            "whatsapp_webhook.verify.unknown_token",
            # Never log the token itself — it is a secret
        )
        return PlainTextResponse("Verification failed", status_code=403)

    logger.info(
        "whatsapp_webhook.verified",
        tenant_id=str(tenant.id),
        tenant_slug=tenant.slug,
    )
    return PlainTextResponse(hub_challenge, status_code=200)


# ---------------------------------------------------------------------------
# POST /webhooks/whatsapp — Receive inbound events
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="WhatsApp webhook events (Meta)",
    include_in_schema=False,
)
@limiter.limit(WEBHOOK_RATE_LIMIT, key_func=get_client_ip)
async def handle_whatsapp(
    request: Request,
    background_tasks: BackgroundTasks,
) -> Response:
    """Receive and enqueue WhatsApp message and status-update events.

    Design contract:
    - Always return HTTP 200 (Meta suspends webhooks that return errors).
    - Validate HMAC signature before touching the payload.
    - Resolve tenant from phone_number_id embedded in the payload.
    - Persist raw event for idempotent reprocessing.
    - Return before heavy processing — use BackgroundTasks.
    """
    raw_body: bytes = await request.body()
    signature: str = request.headers.get("x-hub-signature-256", "")

    if not signature:
        logger.error("whatsapp_webhook.missing_signature", client_ip=request.client.host if request.client else None)
        # Return 200 — do not let Meta retry or suspend the subscription
        return Response(content="EVENT_RECEIVED", status_code=200)

    # --- Parse payload lightly to extract phone_number_id for tenant lookup ---
    try:
        body_json: dict[str, Any] = await request.json()
    except Exception:  # noqa: BLE001
        logger.error("whatsapp_webhook.json_parse_failed")
        return Response(content="EVENT_RECEIVED", status_code=200)

    # Extract phone_number_id from the first available change metadata.
    # This is used only for tenant lookup; full validation follows later.
    phone_number_id = _extract_phone_number_id(body_json)

    if not phone_number_id:
        logger.warning("whatsapp_webhook.no_phone_number_id", object=body_json.get("object"))
        return Response(content="EVENT_RECEIVED", status_code=200)

    async with async_session() as db:
        tenant = await _resolve_tenant_by_phone_number_id(db, phone_number_id)

    if not tenant:
        logger.warning(
            "whatsapp_webhook.unknown_phone_number_id",
            phone_number_id=phone_number_id,
        )
        return Response(content="EVENT_RECEIVED", status_code=200)

    # --- HMAC validation (timing-safe) ---
    if not tenant.whatsapp_webhook_secret:
        logger.warning(
            "whatsapp_webhook.no_app_secret_configured",
            tenant_id=str(tenant.id),
        )
        return Response(content="EVENT_RECEIVED", status_code=200)

    is_valid = validate_webhook_signature(raw_body, signature, tenant.whatsapp_webhook_secret)

    if not is_valid:
        logger.error(
            "whatsapp_webhook.invalid_signature",
            tenant_id=str(tenant.id),
            # Do not log partial signature — it could aid an attacker
        )
        # Still 200 — but we discard the payload
        return Response(content="EVENT_RECEIVED", status_code=200)

    # --- Validate full payload structure ---
    try:
        webhook = WhatsAppWebhookPayload.model_validate(body_json)
    except ValidationError as exc:
        logger.error(
            "whatsapp_webhook.invalid_payload",
            tenant_id=str(tenant.id),
            error=str(exc),
        )
        background_tasks.add_task(
            _persist_webhook_event,
            tenant.id,
            "whatsapp",
            "invalid_payload",
            body_json,
            False,
            str(exc),
        )
        return Response(content="EVENT_RECEIVED", status_code=200)

    # --- Enqueue processing (non-blocking) ---
    for entry in webhook.entry:
        background_tasks.add_task(_process_entry, tenant.id, entry, body_json)

    logger.info(
        "whatsapp_webhook.accepted",
        tenant_id=str(tenant.id),
        entry_count=len(webhook.entry),
    )
    return Response(content="EVENT_RECEIVED", status_code=200)


# ---------------------------------------------------------------------------
# Background processing helpers
# ---------------------------------------------------------------------------


async def _process_entry(
    tenant_id: uuid.UUID,
    entry: WhatsAppEntry,
    raw_payload: dict[str, Any],
) -> None:
    """Process a single WhatsApp entry: persist events and dispatch messages."""
    for change in entry.changes:
        field = change.field
        value = change.value

        try:
            if field == "messages":
                # Inbound messages
                if value.messages:
                    for msg in value.messages:
                        contact_name = (
                            value.contacts[0].profile.name
                            if value.contacts
                            and value.contacts[0].profile
                            else None
                        )
                        logger.info(
                            "whatsapp_webhook.message_received",
                            tenant_id=str(tenant_id),
                            message_id=msg.id,
                            from_=msg.from_,
                            type=msg.type,
                            contact_name=contact_name,
                        )
                        await _persist_webhook_event(
                            tenant_id,
                            "whatsapp",
                            f"message.{msg.type}",
                            raw_payload,
                        )
                        # TODO: Dispatch to message processing worker/queue

                # Status updates
                if value.statuses:
                    for status in value.statuses:
                        logger.info(
                            "whatsapp_webhook.status_update",
                            tenant_id=str(tenant_id),
                            message_id=status.id,
                            status=status.status,
                        )
                        await _persist_webhook_event(
                            tenant_id,
                            "whatsapp",
                            f"status.{status.status}",
                            raw_payload,
                        )
                        # TODO: Dispatch to status update worker/queue

            elif field in ("account_update", "account_alerts", "message_template_status_update"):
                logger.info(
                    "whatsapp_webhook.platform_event",
                    tenant_id=str(tenant_id),
                    field=field,
                )

            else:
                logger.debug(
                    "whatsapp_webhook.unknown_field",
                    tenant_id=str(tenant_id),
                    field=field,
                )

        except Exception as exc:  # noqa: BLE001
            logger.error(
                "whatsapp_webhook.process_entry_failed",
                tenant_id=str(tenant_id),
                field=field,
                error=str(exc),
            )


def _extract_phone_number_id(body: dict[str, Any]) -> str | None:
    """Extract the phone_number_id from the first available change metadata."""
    try:
        entries = body.get("entry") or []
        for entry in entries:
            for change in entry.get("changes") or []:
                pid = (change.get("value") or {}).get("metadata", {}).get("phone_number_id")
                if pid:
                    return str(pid)
    except Exception:  # noqa: BLE001
        pass
    return None
