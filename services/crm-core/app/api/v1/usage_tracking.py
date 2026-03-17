"""Usage Tracking API router — /api/v1/usage-tracking.

All endpoints are restricted to SUPER_ADMIN, TENANT_ADMIN, and ADMIN roles.
All read queries are scoped to the calling user's tenant via get_tenant_id.

Endpoint map:
  GET /         list_usage      — paginated billing history (ordered by period desc)
  GET /current  get_current     — live counters for the current billing period
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
from app.schemas.usage_tracking import (
    CurrentUsageResponse,
    PaginatedResponse,
    UsageTrackingListParams,
    UsageTrackingResponse,
)
from app.services.usage_tracking_service import usage_tracking_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]

_ADMIN_ROLES = ("SUPER_ADMIN", "TENANT_ADMIN", "ADMIN")


# ---------------------------------------------------------------------------
# Dependency: build UsageTrackingListParams from query-string args.
# ---------------------------------------------------------------------------


def _usage_list_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=60),
    start_date: str | None = Query(None, description="Inclusive start period (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="Inclusive end period (YYYY-MM-DD)"),
) -> UsageTrackingListParams:
    from datetime import date

    parsed_start = date.fromisoformat(start_date) if start_date else None
    parsed_end = date.fromisoformat(end_date) if end_date else None

    return UsageTrackingListParams(
        page=page,
        page_size=page_size,
        start_date=parsed_start,
        end_date=parsed_end,
    )


ListParams = Annotated[UsageTrackingListParams, Depends(_usage_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list usage history
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List usage history",
    description=(
        "Returns paginated monthly billing counter history for the tenant, "
        "ordered by period descending (most-recent period first). "
        "Optionally narrow the window with start_date and end_date (YYYY-MM-DD)."
    ),
    response_model=PaginatedResponse[UsageTrackingResponse],
    status_code=status.HTTP_200_OK,
)
async def list_usage(
    db: DB,
    tenant_id: TenantId,
    params: ListParams,
    current_user: User = Depends(require_roles(*_ADMIN_ROLES)),
) -> PaginatedResponse[UsageTrackingResponse]:
    return await usage_tracking_service.list_usage(
        db=db,
        tenant_id=tenant_id,
        params=params,
    )


# ---------------------------------------------------------------------------
# GET /current  — current month metrics
# ---------------------------------------------------------------------------


@router.get(
    "/current",
    summary="Current billing period usage",
    description=(
        "Return live usage counters for the current billing period: "
        "messages_count, conversations_count, and active_users. "
        "Returns zero counters if the tenant has no activity this month."
    ),
    response_model=CurrentUsageResponse,
    status_code=status.HTTP_200_OK,
)
async def get_current_usage(
    db: DB,
    tenant_id: TenantId,
    current_user: User = Depends(require_roles(*_ADMIN_ROLES)),
) -> CurrentUsageResponse:
    return await usage_tracking_service.get_current_month(
        db=db,
        tenant_id=tenant_id,
    )
