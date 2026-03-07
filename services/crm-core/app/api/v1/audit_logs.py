"""Audit Logs API router — /api/v1/audit-logs.

All endpoints are restricted to SUPER_ADMIN, TENANT_ADMIN, and ADMIN roles.
All read queries are scoped to the calling user's tenant via get_tenant_id.
Audit logs are append-only — there are no update or delete endpoints.

Endpoint map:
  GET  /               list_audit_logs      — paginated list with filters
  GET  /{id}           get_audit_log        — single entry with old/new data snapshots
  POST /client-error   report_client_error  — frontend error-boundary reporter
"""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.models.user import User
from app.schemas.audit_log import (
    AuditLogListParams,
    AuditLogResponse,
    ClientErrorReport,
    PaginatedResponse,
)
from app.services.audit_log_service import audit_log_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]

_ADMIN_ROLES = ("SUPER_ADMIN", "TENANT_ADMIN", "ADMIN")


# ---------------------------------------------------------------------------
# Dependency: build AuditLogListParams from query-string args.
# ---------------------------------------------------------------------------


def _audit_log_list_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    order_by: str = Query("created_at desc"),
    action: str | None = Query(None, max_length=100, description="Filter by action (exact match)"),
    entity: str | None = Query(None, max_length=100, description="Filter by entity type (exact match)"),
    user_id: uuid.UUID | None = Query(None, description="Filter by actor user ID"),
    start_date: str | None = Query(None, description="Inclusive start (ISO-8601 datetime)"),
    end_date: str | None = Query(None, description="Inclusive end (ISO-8601 datetime)"),
) -> AuditLogListParams:
    from datetime import datetime

    parsed_start = datetime.fromisoformat(start_date) if start_date else None
    parsed_end = datetime.fromisoformat(end_date) if end_date else None

    return AuditLogListParams(
        page=page,
        page_size=page_size,
        order_by=order_by,
        action=action,
        entity=entity,
        user_id=user_id,
        start_date=parsed_start,
        end_date=parsed_end,
    )


ListParams = Annotated[AuditLogListParams, Depends(_audit_log_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list audit logs
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List audit logs",
    description=(
        "Returns a paginated, descending-order list of audit log entries for the tenant. "
        "Filter by action, entity type, actor user ID, and time window. "
        "Restricted to SUPER_ADMIN, TENANT_ADMIN, and ADMIN roles."
    ),
    response_model=PaginatedResponse[AuditLogResponse],
    status_code=status.HTTP_200_OK,
)
async def list_audit_logs(
    db: DB,
    tenant_id: TenantId,
    params: ListParams,
    current_user: User = Depends(require_roles(*_ADMIN_ROLES)),
) -> PaginatedResponse[AuditLogResponse]:
    return await audit_log_service.list_audit_logs(
        db=db,
        tenant_id=tenant_id,
        params=params,
    )


# ---------------------------------------------------------------------------
# GET /{audit_log_id}  — get audit log detail
# ---------------------------------------------------------------------------


@router.get(
    "/{audit_log_id}",
    summary="Get audit log detail",
    description=(
        "Return a single audit log entry including old_data and new_data snapshots "
        "for before/after diff inspection."
    ),
    response_model=AuditLogResponse,
    status_code=status.HTTP_200_OK,
)
async def get_audit_log(
    audit_log_id: uuid.UUID,
    db: DB,
    tenant_id: TenantId,
    current_user: User = Depends(require_roles(*_ADMIN_ROLES)),
) -> AuditLogResponse:
    return await audit_log_service.get_audit_log(
        db=db,
        tenant_id=tenant_id,
        audit_log_id=audit_log_id,
    )


# ---------------------------------------------------------------------------
# POST /client-error  — report client error from frontend
# ---------------------------------------------------------------------------


@router.post(
    "/client-error",
    summary="Report a frontend client error",
    description=(
        "Allows the frontend error boundary to persist JavaScript exceptions "
        "as audit log entries with action='CLIENT_ERROR'. "
        "The error is stored under the calling user's tenant."
    ),
    status_code=status.HTTP_204_NO_CONTENT,
)
async def report_client_error(
    payload: ClientErrorReport,
    request: Request,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> None:
    # Resolve client IP for the audit trail
    forwarded_for = request.headers.get("X-Forwarded-For")
    ip_address = forwarded_for.split(",")[0].strip() if forwarded_for else (
        request.client.host if request.client else None
    )

    await audit_log_service.log(
        db=db,
        tenant_id=tenant_id,
        action="CLIENT_ERROR",
        user_id=current_user.id,
        entity="frontend",
        metadata={
            "error": payload.error,
            "url": payload.url,
            "user_agent": payload.user_agent,
            **(payload.metadata or {}),
        },
        ip_address=ip_address,
    )
