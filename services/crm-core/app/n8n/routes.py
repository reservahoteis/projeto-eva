"""N8N integration routes.

All endpoints authenticate via X-API-Key (format: {tenantSlug}:{phoneNumberId}).
See app.n8n.auth.get_n8n_tenant for the authentication dependency.

Fire-and-forget pattern
-----------------------
Every "send" endpoint returns HTTP 200 immediately after the channel send
succeeds.  Persisting the outbound message to the DB is done in a background
asyncio Task so the HTTP response latency is not affected by DB writes.

Auto-detect channel
-------------------
When a caller omits the optional `channel` field, auto_detect_channel() checks
whether the identifier belongs to a non-WhatsApp contact in the DB (MESSENGER
or INSTAGRAM).  The result is cached in process memory for 10 minutes to avoid
a DB round-trip on every N8N call.

Rate limiting
-------------
N8N endpoints allow 5 000 requests per minute (higher than the 100 req/min
cap on the regular API).  This is enforced at the nginx / gateway layer, not
inside FastAPI — no in-process rate-limiter is applied here.
"""

from __future__ import annotations

import asyncio
import re
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.base import (
    ButtonPayload,
    ListRow,
    ListSection,
    QuickReplyPayload,
)
from app.channels.router import channel_router, get_adapter
from app.channels.whatsapp import WhatsAppAdapter
from app.core.database import get_db
from app.core.exceptions import BadRequestError, NotFoundError
from app.models.conversation import Conversation
from app.models.escalation import Escalation
from app.models.message import Message
from app.models.tenant import Tenant
from app.n8n.auth import get_n8n_tenant
from app.n8n.schemas import (
    CheckAvailabilityRequest,
    CheckIaLockRequest,
    EscalateRequest,
    IaLockResponse,
    MarkFollowupRequest,
    MarkOpportunityRequest,
    MarkReadRequest,
    SendButtonsRequest,
    SendCarouselRequest,
    SendListRequest,
    SendMediaRequest,
    SendQuickRepliesRequest,
    SendResponse,
    SendTemplateRequest,
    SendTextRequest,
    SetHotelUnitRequest,
)

logger = structlog.get_logger()

router = APIRouter()

# Type aliases for dependency injection
DB = Annotated[AsyncSession, Depends(get_db)]
N8NTenant = Annotated[Tenant, Depends(get_n8n_tenant)]

# ---------------------------------------------------------------------------
# Channel auto-detect cache
# (channel of a given contact rarely changes — TTL 10 min is safe)
# ---------------------------------------------------------------------------

_channel_cache: dict[str, tuple[str, float]] = {}
_CHANNEL_CACHE_TTL = 10 * 60.0  # seconds
_CHANNEL_CACHE_MAX_SIZE = 10_000  # prevent unbounded memory growth

# Set to hold references to fire-and-forget tasks so they are not GC'd
_background_tasks: set[asyncio.Task] = set()


def _cache_key(tenant_id: uuid.UUID, identifier: str) -> str:
    return f"{tenant_id}:{identifier}"


async def auto_detect_channel(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    identifier: str,
    channel_override: str | None = None,
) -> str:
    """Return the correct channel for a recipient identifier.

    If channel_override is supplied it is used directly (no cache).
    Otherwise the DB is queried once and the result cached for 10 minutes.
    """
    if channel_override:
        return channel_override.upper()

    import time

    key = _cache_key(tenant_id, identifier)
    cached = _channel_cache.get(key)
    if cached and time.monotonic() - cached[1] < _CHANNEL_CACHE_TTL:
        return cached[0]

    # Import here to avoid circular imports at module load time
    from app.models.contact import Contact

    result = await db.execute(
        select(Contact.channel).where(
            Contact.tenant_id == tenant_id,
            Contact.external_id == identifier,
            Contact.channel.in_(["MESSENGER", "INSTAGRAM"]),
        )
    )
    row = result.first()
    detected = row[0] if row else "WHATSAPP"

    # Evict oldest entries if cache grows too large
    if len(_channel_cache) >= _CHANNEL_CACHE_MAX_SIZE:
        _channel_cache.clear()

    _channel_cache[key] = (detected, time.monotonic())

    if row:
        logger.info(
            "N8N auto-detect: non-WhatsApp channel found",
            tenant_id=str(tenant_id),
            identifier=identifier,
            channel=detected,
        )

    return detected


def _normalize_phone(raw: str) -> str:
    """Strip all non-digit characters from a phone/external-ID string."""
    return re.sub(r"\D", "", raw)


# ---------------------------------------------------------------------------
# Background DB save helpers
# ---------------------------------------------------------------------------

async def _save_outbound_message(
    tenant_id: uuid.UUID,
    phone: str,
    external_message_id: str,
    msg_type: str,
    content: str,
    metadata: dict | None = None,
    channel: str = "WHATSAPP",
) -> None:
    """Find the conversation for this contact and save the outbound message.

    This runs as a background Task with its OWN session — the request-scoped
    session is already closed by the time this coroutine executes.
    Failures are logged but never re-raised so they do not affect the
    already-returned HTTP response.
    """
    from app.core.database import async_session as _async_session

    try:
        async with _async_session() as db:
            from app.models.contact import Contact

            # Resolve contact: try phone number first, then external_id
            contact_result = await db.execute(
                select(Contact).where(
                    Contact.tenant_id == tenant_id,
                    Contact.mobile_no == phone,
                )
            )
            contact = contact_result.scalar_one_or_none()

            if not contact and channel in ("MESSENGER", "INSTAGRAM"):
                # For non-WhatsApp channels, don't digit-strip the identifier
                contact_result = await db.execute(
                    select(Contact).where(
                        Contact.tenant_id == tenant_id,
                        Contact.external_id == phone,
                    )
                )
                contact = contact_result.scalar_one_or_none()

            if not contact:
                logger.warning(
                    "N8N save_outbound: contact not found — skipping",
                    tenant_id=str(tenant_id),
                )
                return

            # Find the most recent active conversation for this contact
            conv_result = await db.execute(
                select(Conversation)
                .where(
                    Conversation.tenant_id == tenant_id,
                    Conversation.contact_id == contact.id,
                    Conversation.status.in_(
                        ["BOT_HANDLING", "OPEN", "IN_PROGRESS", "WAITING"]
                    ),
                )
                .order_by(Conversation.last_message_at.desc())
                .limit(1)
            )
            conversation = conv_result.scalar_one_or_none()

            if not conversation:
                logger.warning(
                    "N8N save_outbound: no active conversation — skipping",
                    tenant_id=str(tenant_id),
                )
                return

            message = Message(
                tenant_id=tenant_id,
                conversation_id=conversation.id,
                external_message_id=external_message_id or None,
                direction="OUTBOUND",
                type=msg_type,
                content=content,
                metadata_json=metadata,
                status="SENT",
                timestamp=datetime.now(timezone.utc),
            )
            db.add(message)

            # Update last_message_at on the conversation
            await db.execute(
                update(Conversation)
                .where(Conversation.id == conversation.id)
                .values(last_message_at=datetime.now(timezone.utc))
            )

            await db.commit()
    except Exception as exc:
        logger.error(
            "N8N save_outbound: background save failed",
            tenant_id=str(tenant_id),
            error=str(exc),
        )


def _fire_and_forget_save(
    tenant_id: uuid.UUID,
    phone: str,
    external_message_id: str,
    msg_type: str,
    content: str,
    metadata: dict | None = None,
    channel: str = "WHATSAPP",
) -> None:
    """Schedule a background DB save without blocking the HTTP response.

    Uses its own session — NOT the request-scoped session (which will be
    closed by the time the background task runs).  Task references are held
    in _background_tasks to prevent GC from cancelling them.
    """
    task = asyncio.create_task(
        _save_outbound_message(
            tenant_id=tenant_id,
            phone=phone,
            external_message_id=external_message_id,
            msg_type=msg_type,
            content=content,
            metadata=metadata,
            channel=channel,
        )
    )
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


# ---------------------------------------------------------------------------
# Helper: find contact + active conversation (used by several endpoints)
# ---------------------------------------------------------------------------

async def _find_active_conversation(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    phone: str,
) -> tuple[Any, Conversation]:
    """Return (contact, conversation) for the given phone, or raise NotFoundError."""
    from app.models.contact import Contact

    contact_result = await db.execute(
        select(Contact).where(
            Contact.tenant_id == tenant_id,
            Contact.mobile_no == phone,
        )
    )
    contact = contact_result.scalar_one_or_none()

    if not contact:
        contact_result = await db.execute(
            select(Contact).where(
                Contact.tenant_id == tenant_id,
                Contact.external_id == phone,
            )
        )
        contact = contact_result.scalar_one_or_none()

    if not contact:
        raise NotFoundError("Contact not found")

    conv_result = await db.execute(
        select(Conversation)
        .where(
            Conversation.tenant_id == tenant_id,
            Conversation.contact_id == contact.id,
            Conversation.status.in_(
                ["BOT_HANDLING", "OPEN", "IN_PROGRESS", "WAITING"]
            ),
        )
        .order_by(Conversation.last_message_at.desc())
        .limit(1)
    )
    conversation = conv_result.scalar_one_or_none()

    if not conversation:
        raise NotFoundError("No active conversation found for this contact")

    return contact, conversation


# ===========================================================================
# SEND ENDPOINTS
# ===========================================================================


@router.post(
    "/send-text",
    summary="Send text message",
    status_code=status.HTTP_200_OK,
)
async def send_text(
    body: SendTextRequest,
    tenant: N8NTenant,
    db: DB,
) -> dict:
    """Send a plain-text message.

    Returns HTTP 200 immediately after the channel call succeeds.
    The outbound message is persisted to the DB in a background task.
    """
    text = body.message or body.text or ""
    if not text:
        raise BadRequestError("Field 'message' is required")

    phone = _normalize_phone(body.phone)
    channel = await auto_detect_channel(db, tenant.id, phone, body.channel)

    result = await channel_router.send_text(channel, tenant, phone, text)

    _fire_and_forget_save(
        tenant_id=tenant.id,
        phone=phone,
        external_message_id=result.external_message_id,
        msg_type="TEXT",
        content=text,
        channel=channel,
    )

    logger.info(
        "N8N send-text: sent",
        tenant_id=str(tenant.id),
        phone=phone,
        channel=channel,
        message_id=result.external_message_id,
    )

    return {
        "success": True,
        "messageId": result.external_message_id,
    }


@router.post(
    "/send-buttons",
    summary="Send interactive buttons (max 3)",
    status_code=status.HTTP_200_OK,
)
async def send_buttons(
    body: SendButtonsRequest,
    tenant: N8NTenant,
    db: DB,
) -> dict:
    phone = _normalize_phone(body.phone)
    channel = await auto_detect_channel(db, tenant.id, phone, body.channel)

    buttons = [
        ButtonPayload(id=btn.resolved_id(), title=btn.resolved_title()[:20])
        for btn in body.buttons
    ]
    header = body.header or body.title

    result = await channel_router.send_buttons(
        channel, tenant, phone, body.message, buttons, header, body.footer
    )

    _fire_and_forget_save(
        tenant_id=tenant.id,
        phone=phone,
        external_message_id=result.external_message_id,
        msg_type="INTERACTIVE",
        content=body.message,
        metadata={
            "interactiveType": "buttons",
            "header": header,
            "footer": body.footer,
            "buttons": [{"id": b.id, "title": b.title} for b in buttons],
        },
        channel=channel,
    )

    logger.info(
        "N8N send-buttons: sent",
        tenant_id=str(tenant.id),
        phone=phone,
        channel=channel,
        button_count=len(buttons),
        message_id=result.external_message_id,
    )

    return {
        "success": True,
        "messageId": result.external_message_id,
    }


@router.post(
    "/send-list",
    summary="Send interactive list (max 10 sections)",
    status_code=status.HTTP_200_OK,
)
async def send_list(
    body: SendListRequest,
    tenant: N8NTenant,
    db: DB,
) -> dict:
    phone = _normalize_phone(body.phone)
    channel = await auto_detect_channel(db, tenant.id, phone, body.channel)

    # Normalise to Cloud API sections format
    if body.option_list:
        button_label = body.option_list.button_label or "Ver opcoes"
        sections = [
            ListSection(
                title=body.option_list.title,
                rows=[
                    ListRow(
                        id=opt.id or opt.row_id or "",
                        title=opt.title,
                        description=opt.description,
                    )
                    for opt in body.option_list.options
                ],
            )
        ]
    elif body.sections:
        button_label = body.button_text or "Ver opcoes"
        sections = [
            ListSection(
                title=s.title,
                rows=[
                    ListRow(
                        id=r.resolved_id(),
                        title=r.title,
                        description=r.description,
                    )
                    for r in s.rows
                ],
            )
            for s in body.sections
        ]
    else:
        raise BadRequestError(
            "Provide either 'optionList' (Z-API format) or 'sections' (Cloud API format)"
        )

    result = await channel_router.send_list(
        channel, tenant, phone, body.message, button_label, sections,
        body.header, body.footer,
    )

    _fire_and_forget_save(
        tenant_id=tenant.id,
        phone=phone,
        external_message_id=result.external_message_id,
        msg_type="INTERACTIVE",
        content=body.message,
        metadata={
            "interactiveType": "list",
            "buttonLabel": button_label,
            "sectionCount": len(sections),
        },
        channel=channel,
    )

    return {
        "success": True,
        "messageId": result.external_message_id,
    }


@router.post(
    "/send-media",
    summary="Send media message (image/video/audio/document)",
    status_code=status.HTTP_200_OK,
)
async def send_media(
    body: SendMediaRequest,
    tenant: N8NTenant,
    db: DB,
) -> dict:
    phone = _normalize_phone(body.phone)
    channel = await auto_detect_channel(db, tenant.id, phone, body.channel)

    # Resolve media_type and url from multiple input forms
    media_type: str
    media_url: str
    caption: str | None = body.caption

    if body.type and body.url:
        media_type = body.type
        media_url = body.url
    elif body.image:
        media_type = "image"
        media_url = body.image["url"] if isinstance(body.image, dict) else body.image
        if isinstance(body.image, dict):
            caption = body.image.get("caption", caption)
    elif body.video:
        media_type = "video"
        media_url = body.video["url"] if isinstance(body.video, dict) else body.video
        if isinstance(body.video, dict):
            caption = body.video.get("caption", caption)
    elif body.audio:
        media_type = "audio"
        media_url = body.audio["url"] if isinstance(body.audio, dict) else body.audio
    elif body.document:
        media_type = "document"
        media_url = body.document["url"] if isinstance(body.document, dict) else body.document
        if isinstance(body.document, dict):
            caption = body.document.get("caption", caption)
    elif body.media_url:
        ext = body.media_url.rsplit(".", 1)[-1].lower()
        if ext in {"jpg", "jpeg", "png", "gif", "webp"}:
            media_type = "image"
        elif ext in {"mp4", "avi", "mov"}:
            media_type = "video"
        elif ext in {"mp3", "ogg", "wav", "opus"}:
            media_type = "audio"
        else:
            media_type = "document"
        media_url = body.media_url
    else:
        raise BadRequestError(
            "Provide 'type'+'url', or one of: image, video, audio, document, mediaUrl"
        )

    result = await channel_router.send_media(
        channel, tenant, phone, media_type, media_url, caption
    )

    type_map = {
        "image": "IMAGE",
        "video": "VIDEO",
        "audio": "AUDIO",
        "document": "DOCUMENT",
    }

    _fire_and_forget_save(
        tenant_id=tenant.id,
        phone=phone,
        external_message_id=result.external_message_id,
        msg_type=type_map.get(media_type, "IMAGE"),
        content=caption or media_url,
        metadata={"mediaType": media_type, "mediaUrl": media_url, "caption": caption},
        channel=channel,
    )

    return {
        "success": True,
        "messageId": result.external_message_id,
    }


@router.post(
    "/send-template",
    summary="Send approved template message",
    status_code=status.HTTP_200_OK,
)
async def send_template(
    body: SendTemplateRequest,
    tenant: N8NTenant,
    db: DB,
) -> dict:
    template_name = body.resolved_template_name
    if not template_name:
        raise BadRequestError("Field 'template' or 'templateName' is required")

    phone = _normalize_phone(body.phone)
    channel = await auto_detect_channel(db, tenant.id, phone, body.channel)

    # Build components list from either `components` or flat `parameters`
    components: list[dict] | None = None
    if body.components:
        components = [c.model_dump(exclude_none=True) for c in body.components]
    elif body.parameters:
        components = [
            {
                "type": "body",
                "parameters": [{"type": "text", "text": p} for p in body.parameters],
            }
        ]

    result = await channel_router.send_template(
        channel, tenant, phone, template_name, body.resolved_language, components
    )

    _fire_and_forget_save(
        tenant_id=tenant.id,
        phone=phone,
        external_message_id=result.external_message_id,
        msg_type="TEMPLATE",
        content=f"[Template: {template_name}]",
        metadata={
            "templateName": template_name,
            "language": body.resolved_language,
            "parameters": body.parameters,
        },
        channel=channel,
    )

    return {
        "success": True,
        "messageId": result.external_message_id,
    }


@router.post(
    "/send-carousel",
    summary="Send carousel template or interactive carousel",
    status_code=status.HTTP_200_OK,
)
async def send_carousel(
    body: SendCarouselRequest,
    tenant: N8NTenant,
    db: DB,
) -> dict:
    phone = _normalize_phone(body.phone)
    channel = await auto_detect_channel(db, tenant.id, phone, body.channel)

    # Mode 1: template carousel (cards with imageUrl + buttonPayloads)
    if body.template and body.cards:
        cards = body.cards
        if len(cards) > 10:
            raise BadRequestError("Maximum 10 cards per carousel")

        for i, card in enumerate(cards):
            if not card.image_url:
                raise BadRequestError(f"Card {i + 1}: 'imageUrl' is required")
            if not card.button_payloads:
                raise BadRequestError(f"Card {i + 1}: 'buttonPayloads' is required")

        # Non-WhatsApp: use Generic Template
        if channel != "WHATSAPP":
            adapter = get_adapter(channel, tenant)
            if hasattr(adapter, "send_generic_template"):
                elements = [
                    {
                        "title": (card.body_params[0] if card.body_params else body.template)[:80],
                        "subtitle": " | ".join(card.body_params[1:]) if card.body_params and len(card.body_params) > 1 else None,
                        "image_url": card.image_url,
                        "buttons": [
                            {
                                "id": payload,
                                "title": (
                                    card.button_labels[i] if card.button_labels and i < len(card.button_labels)
                                    else payload.replace("_", " ")[:20]
                                ),
                                "url": (
                                    card.button_urls[i] if card.button_urls and i < len(card.button_urls)
                                    else None
                                ),
                            }
                            for i, payload in enumerate(card.button_payloads)
                        ],
                    }
                    for card in cards
                ]
                try:
                    result = await adapter.send_generic_template(  # type: ignore[attr-defined]
                        str(tenant.id), phone, elements
                    )
                    _fire_and_forget_save(
                        tenant_id=tenant.id, phone=phone,
                        external_message_id=result.external_message_id,
                        msg_type="INTERACTIVE",
                        content=f"[Carousel: {body.template}] {len(cards)} cards",
                        metadata={"templateType": "carousel-generic", "cardsCount": len(cards)},
                        channel=channel,
                    )
                    return {
                        "success": True,
                        "messageId": result.external_message_id,
                        "cardsCount": len(cards),
                        "mode": "generic-template",
                    }
                except Exception as exc:
                    logger.warning(
                        "N8N send-carousel: Generic Template failed",
                        tenant_id=str(tenant.id),
                        channel=channel,
                        error=str(exc),
                    )

        # WhatsApp: native carousel template
        wa_adapter = get_adapter("WHATSAPP", tenant)
        if not isinstance(wa_adapter, WhatsAppAdapter):
            raise BadRequestError("WhatsApp not configured for this tenant")

        result = await wa_adapter.send_carousel_template(
            phone,
            body.template,
            [
                {
                    "imageUrl": card.image_url,
                    "bodyParams": card.body_params,
                    "buttonPayloads": card.button_payloads,
                }
                for card in cards
            ],
        )

        _fire_and_forget_save(
            tenant_id=tenant.id, phone=phone,
            external_message_id=result.external_message_id,
            msg_type="TEMPLATE",
            content=f"[Carousel: {body.template}] {len(cards)} cards",
            metadata={
                "templateType": "carousel",
                "templateName": body.template,
                "cardsCount": len(cards),
            },
        )

        return {
            "success": True,
            "messageId": result.external_message_id,
            "cardsCount": len(cards),
            "mode": "template",
        }

    # Mode 2: interactive carousel (sequential messages with image+buttons)
    if not body.carousel:
        raise BadRequestError(
            "Provide 'template'+'cards' (template mode) "
            "or 'carousel' (interactive mode)"
        )

    carousel = body.carousel

    # Non-WhatsApp: Generic Template
    if channel != "WHATSAPP":
        adapter = get_adapter(channel, tenant)
        if hasattr(adapter, "send_generic_template"):
            elements = [
                {
                    "title": card.text[:80],
                    "image_url": card.image,
                    "buttons": [
                        {
                            "id": btn.resolved_id(),
                            "title": btn.resolved_title()[:20],
                            "url": btn.url,
                        }
                        for btn in card.buttons
                    ],
                }
                for card in carousel
            ]
            try:
                if body.message:
                    await channel_router.send_text(channel, tenant, phone, body.message)
                result = await adapter.send_generic_template(  # type: ignore[attr-defined]
                    str(tenant.id), phone, elements
                )
                return {
                    "success": True,
                    "messageId": result.external_message_id,
                    "cardsCount": len(carousel),
                    "mode": "generic-template",
                }
            except Exception as exc:
                logger.warning(
                    "N8N send-carousel interactive: Generic Template failed",
                    error=str(exc),
                )

    # WhatsApp: send each card as separate interactive message
    message_ids: list[str] = []

    if body.message:
        intro = await channel_router.send_text(channel, tenant, phone, body.message)
        message_ids.append(intro.external_message_id)

    for card in carousel:
        if card.image:
            img_result = await channel_router.send_media(
                channel, tenant, phone, "image", card.image
            )
            message_ids.append(img_result.external_message_id)

        buttons = [
            ButtonPayload(id=btn.resolved_id(), title=btn.resolved_title()[:20])
            for btn in card.buttons
        ]
        btn_result = await channel_router.send_buttons(
            channel, tenant, phone, card.text, buttons
        )
        message_ids.append(btn_result.external_message_id)

        _fire_and_forget_save(
            tenant_id=tenant.id, phone=phone,
            external_message_id=btn_result.external_message_id,
            msg_type="INTERACTIVE",
            content=card.text,
            metadata={"carouselCard": True, "hasImage": bool(card.image)},
            channel=channel,
        )

    return {
        "success": True,
        "messageId": message_ids[0] if message_ids else None,
        "messageIds": message_ids,
        "cardsCount": len(carousel),
        "mode": "interactive",
    }


@router.post(
    "/send-quick-replies",
    summary="Send quick reply buttons (max 13)",
    status_code=status.HTTP_200_OK,
)
async def send_quick_replies(
    body: SendQuickRepliesRequest,
    tenant: N8NTenant,
    db: DB,
) -> dict:
    phone = _normalize_phone(body.phone)
    channel = await auto_detect_channel(db, tenant.id, phone, body.channel)

    quick_replies = [
        QuickReplyPayload(title=qr.title[:20], payload=qr.payload)
        for qr in body.quick_replies
    ]

    result = await channel_router.send_quick_replies(
        channel, tenant, phone, body.message, quick_replies
    )

    _fire_and_forget_save(
        tenant_id=tenant.id,
        phone=phone,
        external_message_id=result.external_message_id,
        msg_type="INTERACTIVE",
        content=body.message,
        metadata={
            "interactiveType": "quick_replies",
            "quickReplies": [
                {"title": qr.title, "payload": qr.payload} for qr in quick_replies
            ],
        },
        channel=channel,
    )

    return {
        "success": True,
        "messageId": result.external_message_id,
    }


# ===========================================================================
# CONVERSATION MANAGEMENT ENDPOINTS
# ===========================================================================


@router.post(
    "/check-ia-lock",
    summary="Check whether AI is locked for a conversation",
    status_code=status.HTTP_200_OK,
    response_model=IaLockResponse,
)
async def check_ia_lock(
    body: CheckIaLockRequest,
    tenant: N8NTenant,
    db: DB,
) -> IaLockResponse:
    phone = _normalize_phone(body.resolved_phone)
    if not phone:
        raise BadRequestError("Field 'phone' is required")

    channel = await auto_detect_channel(db, tenant.id, phone, body.channel)

    try:
        _, conversation = await _find_active_conversation(db, tenant.id, phone)
    except NotFoundError:
        logger.info(
            "N8N check-ia-lock: no conversation found — returning unlocked",
            tenant_id=str(tenant.id),
            phone=phone,
        )
        return IaLockResponse(locked=False, conversation_id=None)

    logger.info(
        "N8N check-ia-lock",
        tenant_id=str(tenant.id),
        phone=phone,
        channel=channel,
        locked=conversation.ia_locked,
        conversation_id=str(conversation.id),
    )

    return IaLockResponse(
        locked=conversation.ia_locked,
        conversation_id=str(conversation.id),
    )


@router.post(
    "/escalate",
    summary="Escalate conversation to human attendant",
    status_code=status.HTTP_201_CREATED,
)
async def escalate(
    body: EscalateRequest,
    tenant: N8NTenant,
    db: DB,
) -> dict:
    phone = _normalize_phone(body.resolved_phone)
    if not phone:
        raise BadRequestError("Field 'phone' is required")

    contact, conversation = await _find_active_conversation(db, tenant.id, phone)

    # Lock AI and update hotel unit if provided
    update_data: dict[str, Any] = {
        "ia_locked": True,
        "status": "OPEN",
    }
    if body.hotel_unit:
        update_data["hotel_unit"] = body.hotel_unit

    await db.execute(
        update(Conversation)
        .where(Conversation.id == conversation.id)
        .values(**update_data)
    )

    # Create escalation record
    escalation = Escalation(
        tenant_id=tenant.id,
        conversation_id=conversation.id,
        reason=body.reason,
        hotel_unit=body.hotel_unit,
        status="PENDING",
        ai_context=body.ai_context,
        notes=body.reason_detail,
    )
    db.add(escalation)

    # Import message history if provided
    if body.message_history:
        for item in body.message_history:
            direction = "INBOUND" if item.role in ("user", "customer") else "OUTBOUND"
            hist_msg = Message(
                tenant_id=tenant.id,
                conversation_id=conversation.id,
                direction=direction,
                type="TEXT",
                content=item.content,
                status="DELIVERED" if direction == "INBOUND" else "SENT",
                timestamp=datetime.now(timezone.utc),
                metadata_json={"importedFromN8N": True},
            )
            db.add(hist_msg)

    await db.flush()
    await db.refresh(escalation)

    logger.info(
        "N8N escalate: created",
        tenant_id=str(tenant.id),
        phone=phone,
        escalation_id=str(escalation.id),
        conversation_id=str(conversation.id),
        reason=body.reason,
    )

    return {
        "success": True,
        "escalation": {
            "id": str(escalation.id),
            "reason": escalation.reason,
            "status": escalation.status,
        },
        "conversation": {
            "id": str(conversation.id),
            "status": "OPEN",
            "ia_locked": True,
        },
        "contact": {
            "id": str(contact.id),
            "full_name": contact.full_name,
        },
    }


@router.post(
    "/set-hotel-unit",
    summary="Set hotel unit for an active conversation",
    status_code=status.HTTP_200_OK,
)
async def set_hotel_unit(
    body: SetHotelUnitRequest,
    tenant: N8NTenant,
    db: DB,
) -> dict:
    phone = _normalize_phone(body.resolved_phone)
    if not phone:
        raise BadRequestError("Field 'phone' is required")

    _, conversation = await _find_active_conversation(db, tenant.id, phone)

    await db.execute(
        update(Conversation)
        .where(Conversation.id == conversation.id)
        .values(hotel_unit=body.hotel_unit)
    )
    await db.flush()

    logger.info(
        "N8N set-hotel-unit: updated",
        tenant_id=str(tenant.id),
        phone=phone,
        hotel_unit=body.hotel_unit,
        conversation_id=str(conversation.id),
    )

    return {
        "success": True,
        "conversationId": str(conversation.id),
        "hotelUnit": body.hotel_unit,
        "message": f"Hotel unit set to: {body.hotel_unit}",
    }


@router.post(
    "/mark-followup-sent",
    summary="Mark follow-up as sent and flag conversation as opportunity",
    status_code=status.HTTP_200_OK,
)
async def mark_followup_sent(
    body: MarkFollowupRequest,
    tenant: N8NTenant,
    db: DB,
) -> dict:
    phone = _normalize_phone(body.resolved_phone)
    if not phone:
        raise BadRequestError("Field 'phone' is required")

    _, conversation = await _find_active_conversation(db, tenant.id, phone)

    now = datetime.now(timezone.utc)
    existing_meta = conversation.metadata_json or {}

    await db.execute(
        update(Conversation)
        .where(Conversation.id == conversation.id)
        .values(
            is_opportunity=True,
            status="OPEN",
            metadata_json={
                **existing_meta,
                "followupSent": True,
                "followupSentAt": now.isoformat(),
                "opportunityReason": "followup_sent",
                "opportunityReasonDescription": (
                    "Follow-up sent — awaiting client response"
                ),
                "markedAsOpportunityAt": now.isoformat(),
            },
        )
    )
    await db.flush()

    logger.info(
        "N8N mark-followup-sent: conversation marked as opportunity",
        tenant_id=str(tenant.id),
        phone=phone,
        conversation_id=str(conversation.id),
    )

    return {
        "success": True,
        "conversationId": str(conversation.id),
        "followupSent": True,
        "followupSentAt": now.isoformat(),
        "isOpportunity": True,
        "message": "Follow-up marked as sent and opportunity created for sales team",
    }


@router.post(
    "/mark-opportunity",
    summary="Mark conversation as sales opportunity",
    status_code=status.HTTP_200_OK,
)
async def mark_opportunity(
    body: MarkOpportunityRequest,
    tenant: N8NTenant,
    db: DB,
) -> dict:
    phone = _normalize_phone(body.resolved_phone)
    if not phone:
        raise BadRequestError("Field 'phone' is required")

    _, conversation = await _find_active_conversation(db, tenant.id, phone)

    reason_descriptions: dict[str, str] = {
        "not_completed": "Client could not complete the reservation",
        "needs_help": "Client still has questions",
        "wants_human": "Client wants to speak with a human",
        "wants_reservation": "Client wants to make a reservation",
    }

    now = datetime.now(timezone.utc)
    existing_meta = conversation.metadata_json or {}

    await db.execute(
        update(Conversation)
        .where(Conversation.id == conversation.id)
        .values(
            is_opportunity=True,
            status="OPEN",
            metadata_json={
                **existing_meta,
                "opportunityReason": body.reason or "followup_negative",
                "opportunityReasonDescription": (
                    reason_descriptions.get(body.reason or "", "Negative response on follow-up")
                    if body.reason else "Negative response on follow-up"
                ),
                "followupResponse": body.followup_response or "unknown",
                "markedAsOpportunityAt": now.isoformat(),
            },
        )
    )
    await db.flush()

    logger.info(
        "N8N mark-opportunity: conversation marked",
        tenant_id=str(tenant.id),
        phone=phone,
        conversation_id=str(conversation.id),
        reason=body.reason,
    )

    return {
        "success": True,
        "conversationId": str(conversation.id),
        "isOpportunity": True,
        "status": "OPEN",
        "message": "Conversation marked as sales opportunity",
        "reason": reason_descriptions.get(body.reason or "", body.reason),
    }


@router.post(
    "/mark-read",
    summary="Mark messages as read for a contact",
    status_code=status.HTTP_200_OK,
)
async def mark_read(
    body: MarkReadRequest,
    tenant: N8NTenant,
    db: DB,
) -> dict:
    phone = _normalize_phone(body.resolved_phone)
    if not phone:
        raise BadRequestError("Field 'phone' is required")

    channel = await auto_detect_channel(db, tenant.id, phone, body.channel)

    # Find the most recent inbound message to mark-read via the channel API
    try:
        _, conversation = await _find_active_conversation(db, tenant.id, phone)

        msg_result = await db.execute(
            select(Message)
            .where(
                Message.tenant_id == tenant.id,
                Message.conversation_id == conversation.id,
                Message.direction == "INBOUND",
                Message.external_message_id.is_not(None),
            )
            .order_by(Message.timestamp.desc())
            .limit(1)
        )
        last_inbound = msg_result.scalar_one_or_none()

        if last_inbound and last_inbound.external_message_id:
            await channel_router.mark_as_read(
                channel, tenant, last_inbound.external_message_id
            )

            # Bulk-mark all unread inbound messages as READ
            await db.execute(
                update(Message)
                .where(
                    Message.tenant_id == tenant.id,
                    Message.conversation_id == conversation.id,
                    Message.direction == "INBOUND",
                    Message.status.in_(["SENT", "DELIVERED"]),
                )
                .values(status="READ")
            )
            await db.flush()

    except NotFoundError:
        # No active conversation — nothing to mark
        pass

    return {"success": True}


# ===========================================================================
# AVAILABILITY CHECK
# ===========================================================================


@router.post(
    "/check-availability",
    summary="Check room availability via HBook scraper",
    status_code=status.HTTP_200_OK,
)
async def check_availability(
    body: CheckAvailabilityRequest,
    tenant: N8NTenant,  # noqa: ARG001 — auth required even for read-only endpoint
) -> dict:
    """Check room availability for a hotel unit.

    Delegates to the HBook scraper service if available.  Returns a stub
    response if the scraper is not yet implemented in CRM Core.
    """
    children_ages = body.resolved_children_ages()

    try:
        from app.services.hbook_scraper import hbook_scraper_service  # type: ignore[import]

        result = await hbook_scraper_service.check_availability(
            unidade=body.unidade,
            checkin=body.checkin,
            checkout=body.checkout,
            adults=body.adults,
            children=body.children,
            children_ages=children_ages,
        )
        return result
    except ImportError:
        logger.info(
            "N8N check-availability: HBook scraper not available in CRM Core",
            tenant_id=str(tenant.id),
            unidade=body.unidade,
        )
        # Return a clean stub so N8N workflows do not break
        return {
            "success": False,
            "unidade": body.unidade,
            "checkin": body.checkin,
            "checkout": body.checkout,
            "adults": body.adults,
            "children": body.children,
            "rooms": [],
            "scrapedAt": datetime.now(timezone.utc).isoformat(),
            "error": "HBook scraper not available in this service — use the Express backend endpoint",
        }
    except Exception as exc:
        logger.error(
            "N8N check-availability: scraper error",
            tenant_id=str(tenant.id),
            unidade=body.unidade,
            error=str(exc),
        )
        return {
            "success": False,
            "unidade": body.unidade,
            "checkin": body.checkin,
            "checkout": body.checkout,
            "adults": body.adults,
            "rooms": [],
            "scrapedAt": datetime.now(timezone.utc).isoformat(),
            "error": str(exc),
        }
