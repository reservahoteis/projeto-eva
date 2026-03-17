"""Webhook Events API router — /api/v1/webhook-events.

All endpoints are restricted to SUPER_ADMIN, TENANT_ADMIN, and ADMIN roles.
All read queries are scoped to the calling user's tenant via get_tenant_id.
Webhook event records are written internally by the webhook worker —
there are no create endpoints exposed here.

Endpoint map:
  GET  /          list_webhook_events  — paginated list with source/processed filters
  GET  /{id}      get_webhook_event    — single event with full raw payload
  POST /{id}/replay  replay_webhook_event — reset to unprocessed for worker re-delivery
"""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_tenant_id, require_roles
from app.models.user import User
from app.schemas.webhook_event import (
    PaginatedResponse,
    WebhookEventListParams,
    WebhookEventResponse,
)
from app.services.webhook_event_service import webhook_event_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]

_ADMIN_ROLES = ("SUPER_ADMIN", "TENANT_ADMIN", "ADMIN")


# ---------------------------------------------------------------------------
# Dependency: build WebhookEventListParams from query-string args.
# ---------------------------------------------------------------------------


def _event_list_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    order_by: str = Query("created_at desc"),
    source: str | None = Query(None, max_length=100, description="Filter by source channel (exact match)"),
    processed: bool | None = Query(None, description="Filter by processing state"),
) -> WebhookEventListParams:
    return WebhookEventListParams(
        page=page,
        page_size=page_size,
        order_by=order_by,
        source=source,
        processed=processed,
    )


ListParams = Annotated[WebhookEventListParams, Depends(_event_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list webhook events
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List webhook events",
    description=(
        "Returns a paginated list of inbound webhook event records for the tenant. "
        "Filter by source channel (e.g. WHATSAPP) and/or processing state. "
        "The payload column is included — use page_size to limit response size."
    ),
    response_model=PaginatedResponse[WebhookEventResponse],
    status_code=status.HTTP_200_OK,
)
async def list_webhook_events(
    db: DB,
    tenant_id: TenantId,
    params: ListParams,
    current_user: User = Depends(require_roles(*_ADMIN_ROLES)),
) -> PaginatedResponse[WebhookEventResponse]:
    return await webhook_event_service.list_events(
        db=db,
        tenant_id=tenant_id,
        params=params,
    )


# ---------------------------------------------------------------------------
# GET /{event_id}  — get webhook event with payload
# ---------------------------------------------------------------------------


@router.get(
    "/{event_id}",
    summary="Get webhook event detail",
    description=(
        "Return a single webhook event record including the full raw payload "
        "as received from the channel provider. Useful for debugging failed deliveries."
    ),
    response_model=WebhookEventResponse,
    status_code=status.HTTP_200_OK,
)
async def get_webhook_event(
    event_id: uuid.UUID,
    db: DB,
    tenant_id: TenantId,
    current_user: User = Depends(require_roles(*_ADMIN_ROLES)),
) -> WebhookEventResponse:
    return await webhook_event_service.get_event(
        db=db,
        tenant_id=tenant_id,
        event_id=event_id,
    )


# ---------------------------------------------------------------------------
# POST /{event_id}/replay  — replay webhook event
# ---------------------------------------------------------------------------


@router.post(
    "/{event_id}/replay",
    summary="Replay a webhook event",
    description=(
        "Reset a webhook event to unprocessed state so the background worker "
        "will re-deliver it on the next polling cycle. "
        "Clears: processed=false, processed_at=null, error=null."
    ),
    response_model=WebhookEventResponse,
    status_code=status.HTTP_200_OK,
)
async def replay_webhook_event(
    event_id: uuid.UUID,
    db: DB,
    tenant_id: TenantId,
    current_user: User = Depends(require_roles(*_ADMIN_ROLES)),
) -> WebhookEventResponse:
    return await webhook_event_service.replay_event(
        db=db,
        tenant_id=tenant_id,
        event_id=event_id,
    )
