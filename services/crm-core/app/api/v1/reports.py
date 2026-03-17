"""Reports API router — /api/v1/reports.

All endpoints are restricted to SUPER_ADMIN, TENANT_ADMIN, and HEAD roles.
All queries are scoped to the calling user's tenant via get_tenant_id.

Endpoint map:
  GET /overview    — overview metrics for the period
  GET /attendants  — per-attendant performance metrics
  GET /hourly      — conversation volume by hour of day (Brazil UTC-3)

The `period` query parameter accepts: 7d | 30d | 90d | 1y (default 30d).
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_tenant_id, require_roles
from app.models.user import User
from app.services.report_service import report_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]

# Role gate applied to every endpoint in this module.
_ADMIN_ROLES = ("SUPER_ADMIN", "TENANT_ADMIN", "HEAD")


# ---------------------------------------------------------------------------
# GET /overview  — overview metrics
# ---------------------------------------------------------------------------


@router.get(
    "/overview",
    summary="Conversation overview report",
    description=(
        "Returns tenant-level conversation metrics for the requested period: "
        "total conversations, % change vs the previous period, active attendants, "
        "average response time, resolution rate, unread messages, and a status breakdown. "
        "Allowed periods: 7d | 30d | 90d | 1y."
    ),
    status_code=status.HTTP_200_OK,
)
async def get_overview(
    db: DB,
    tenant_id: TenantId,
    current_user: User = Depends(require_roles(*_ADMIN_ROLES)),
    period: str = Query("30d", description="Reporting window: 7d | 30d | 90d | 1y"),
) -> dict[str, Any]:
    return await report_service.get_overview(
        db=db,
        tenant_id=tenant_id,
        period=period,
    )


# ---------------------------------------------------------------------------
# GET /attendants  — attendant performance
# ---------------------------------------------------------------------------


@router.get(
    "/attendants",
    summary="Attendant performance report",
    description=(
        "Returns per-attendant performance metrics for all ATTENDANT and HEAD users "
        "in the tenant: conversations assigned, conversations closed, and satisfaction rate. "
        "Users with zero activity in the period are included with zero-value counters."
    ),
    status_code=status.HTTP_200_OK,
)
async def get_attendants_performance(
    db: DB,
    tenant_id: TenantId,
    current_user: User = Depends(require_roles(*_ADMIN_ROLES)),
    period: str = Query("30d", description="Reporting window: 7d | 30d | 90d | 1y"),
) -> list[dict[str, Any]]:
    return await report_service.get_attendants_performance(
        db=db,
        tenant_id=tenant_id,
        period=period,
    )


# ---------------------------------------------------------------------------
# GET /hourly  — hourly volume
# ---------------------------------------------------------------------------


@router.get(
    "/hourly",
    summary="Hourly conversation volume report",
    description=(
        "Returns conversation volume broken down by hour of day (Brazil UTC-3 offset). "
        "Includes business-hours metrics: inside count, outside count, and outside percentage. "
        "Business hours are defined as 08:00–18:00 local time."
    ),
    status_code=status.HTTP_200_OK,
)
async def get_hourly_volume(
    db: DB,
    tenant_id: TenantId,
    current_user: User = Depends(require_roles(*_ADMIN_ROLES)),
    period: str = Query("30d", description="Reporting window: 7d | 30d | 90d | 1y"),
) -> dict[str, Any]:
    return await report_service.get_hourly_volume(
        db=db,
        tenant_id=tenant_id,
        period=period,
    )
