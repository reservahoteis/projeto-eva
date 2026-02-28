"""FastAPI router for the SLA resource — /api/v1/sla.

Endpoint map:
  GET    /                list_slas      — list all SLAs (any authenticated user)
  POST   /                create_sla     — ADMIN / SUPER_ADMIN only
  GET    /{sla_id}         get_sla        — any authenticated user
  PUT    /{sla_id}         update_sla     — ADMIN / SUPER_ADMIN only
  DELETE /{sla_id}         delete_sla     — ADMIN / SUPER_ADMIN only

SLAResponse exposes priority time values as plain minutes (not timedelta /
PostgreSQL Interval) via a helper that converts the ORM object before
building the Pydantic response.
"""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.models.sla import ServiceLevelAgreement, ServiceLevelPriority, ServiceDay
from app.models.user import User
from app.schemas.sla import (
    SLACreate,
    SLAListItem,
    SLAPriorityResponse,
    SLAResponse,
    SLAUpdate,
    ServiceDayResponse,
)
from app.services.sla_service import sla_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_roles("ADMIN", "SUPER_ADMIN"))]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]

# ---------------------------------------------------------------------------
# Internal conversion helpers
# ---------------------------------------------------------------------------


def _priority_to_response(p: ServiceLevelPriority) -> SLAPriorityResponse:
    """Convert ORM ServiceLevelPriority to its Pydantic response schema.

    response_time / resolution_time are stored as PostgreSQL Interval (exposed
    as timedelta by SQLAlchemy).  We convert to total minutes for the API.
    """

    def _to_minutes(v: object) -> int:
        if isinstance(v, timedelta):
            return int(v.total_seconds() // 60)
        if hasattr(v, "total_seconds"):
            return int(v.total_seconds() // 60)
        return 0

    return SLAPriorityResponse(
        id=p.id,
        sla_id=p.sla_id,
        priority=p.priority,
        response_time_minutes=_to_minutes(p.response_time),
        resolution_time_minutes=_to_minutes(p.resolution_time),
    )


def _service_day_to_response(d: ServiceDay) -> ServiceDayResponse:
    return ServiceDayResponse.model_validate(d)


def _sla_to_response(sla: ServiceLevelAgreement) -> SLAResponse:
    """Build a full SLAResponse from an ORM object (with loaded relationships)."""
    return SLAResponse(
        id=sla.id,
        tenant_id=sla.tenant_id,
        name=sla.name,
        applies_to=sla.applies_to,
        condition=sla.condition,
        enabled=sla.enabled,
        priorities=[_priority_to_response(p) for p in sla.priorities],
        service_days=[_service_day_to_response(d) for d in sla.service_days],
        created_at=sla.created_at,
        updated_at=sla.updated_at,
    )


# ---------------------------------------------------------------------------
# GET /  — list SLAs
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List all SLAs",
    description="Returns all Service Level Agreements configured for the tenant.",
    response_model=list[SLAListItem],
    status_code=status.HTTP_200_OK,
)
async def list_slas(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> list[SLAListItem]:
    slas = await sla_service.list_slas(db, tenant_id)
    return [SLAListItem.model_validate(s) for s in slas]


# ---------------------------------------------------------------------------
# POST /  — create SLA
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create a Service Level Agreement",
    description=(
        "Creates an SLA with priorities and business-hours service days in a "
        "single transaction. Requires ADMIN or SUPER_ADMIN role."
    ),
    response_model=SLAResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_sla(
    payload: SLACreate,
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
) -> SLAResponse:
    sla = await sla_service.create_sla(db=db, tenant_id=tenant_id, data=payload)
    return _sla_to_response(sla)


# ---------------------------------------------------------------------------
# GET /{sla_id}  — get SLA detail
# ---------------------------------------------------------------------------


@router.get(
    "/{sla_id}",
    summary="Get SLA detail",
    response_model=SLAResponse,
    status_code=status.HTTP_200_OK,
)
async def get_sla(
    sla_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> SLAResponse:
    sla = await sla_service.get_sla(db, tenant_id, sla_id)
    return _sla_to_response(sla)


# ---------------------------------------------------------------------------
# PUT /{sla_id}  — update SLA
# ---------------------------------------------------------------------------


@router.put(
    "/{sla_id}",
    summary="Update a Service Level Agreement",
    description=(
        "Partial update of an SLA. When `priorities` or `service_days` are "
        "included they FULLY REPLACE the existing child rows. "
        "Requires ADMIN or SUPER_ADMIN role."
    ),
    response_model=SLAResponse,
    status_code=status.HTTP_200_OK,
)
async def update_sla(
    sla_id: uuid.UUID,
    payload: SLAUpdate,
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
) -> SLAResponse:
    sla = await sla_service.update_sla(
        db=db, tenant_id=tenant_id, sla_id=sla_id, data=payload
    )
    return _sla_to_response(sla)


# ---------------------------------------------------------------------------
# DELETE /{sla_id}  — delete SLA
# ---------------------------------------------------------------------------


@router.delete(
    "/{sla_id}",
    summary="Delete a Service Level Agreement",
    description=(
        "Hard-deletes the SLA and cascades to its priorities and service days. "
        "Requires ADMIN or SUPER_ADMIN role."
    ),
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_sla(
    sla_id: uuid.UUID,
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
):
    await sla_service.delete_sla(db, tenant_id, sla_id)
