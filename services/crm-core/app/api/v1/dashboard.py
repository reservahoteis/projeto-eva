"""FastAPI router for the Dashboard resource — /api/v1/dashboard.

All endpoints require a valid Bearer JWT (get_current_user) and resolve the
calling user's tenant automatically (get_tenant_id — populated by
get_current_user via request.state).

Endpoint map:
  GET  /stats   get_dashboard_stats   — aggregated counts and sums for the tenant
"""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id
from app.models.user import User
from app.schemas.dashboard import DashboardStats
from app.services.dashboard_service import dashboard_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# GET /stats  — aggregated dashboard stats
# ---------------------------------------------------------------------------


@router.get(
    "/stats",
    summary="Get dashboard stats",
    description=(
        "Returns aggregated statistics for the authenticated user's tenant: "
        "total leads, total deals, open deals, won deals, won deals total value, "
        "total contacts, total organizations, and conversion rate "
        "(won deals / total deals * 100, rounded to two decimal places)."
    ),
    response_model=DashboardStats,
    status_code=status.HTTP_200_OK,
)
async def get_dashboard_stats(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> DashboardStats:
    return await dashboard_service.get_stats(db, tenant_id)
