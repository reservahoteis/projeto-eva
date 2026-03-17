"""Call Logs API router — /api/v1/call-logs.

Endpoint map:
  GET    /                  — list call logs (paginated, filterable)
  POST   /                  — create call log entry
  GET    /{call_log_id}     — get full detail
  PUT    /{call_log_id}     — partial update (e.g. add recording URL, duration)
  DELETE /{call_log_id}     — hard delete

Call logs are polymorphic — they reference Lead, Deal, or Contact records
via reference_doctype + reference_docname query params.

All endpoints require a valid Bearer JWT (get_current_user) and resolve the
calling user's tenant automatically via get_tenant_id.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id
from app.models.user import User
from app.schemas.call_log import (
    CallLogCreate,
    CallLogListItem,
    CallLogListParams,
    CallLogResponse,
    CallLogUpdate,
    PaginatedResponse,
)
from app.services.call_log_service import call_log_service

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Dependency: build CallLogListParams from individual query-string args
# ---------------------------------------------------------------------------


def _call_log_list_params(
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(20, ge=1, le=200, description="Results per page (max 200)"),
    type: str | None = Query(None, description="Incoming | Outgoing | Missed"),
    status: str | None = Query(
        None,
        description=(
            "Ringing | In Progress | Completed | Failed | "
            "Busy | No Answer | Queued | Canceled | Unknown"
        ),
    ),
    reference_doctype: str | None = Query(
        None, description="Filter by entity type: Lead | Deal | Contact"
    ),
    reference_docname: uuid.UUID | None = Query(
        None, description="Filter by entity PK"
    ),
) -> CallLogListParams:
    return CallLogListParams(
        page=page,
        page_size=page_size,
        type=type,  # type: ignore[arg-type]
        status=status,  # type: ignore[arg-type]
        reference_doctype=reference_doctype,  # type: ignore[arg-type]
        reference_docname=reference_docname,
    )


ListParams = Annotated[CallLogListParams, Depends(_call_log_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list call logs
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List call logs",
    description=(
        "Returns a paginated list of call logs. "
        "Filter by call type, status, or reference document."
    ),
    response_model=PaginatedResponse[CallLogListItem],
    status_code=status.HTTP_200_OK,
)
async def list_call_logs(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    params: ListParams,
) -> PaginatedResponse[CallLogListItem]:
    return await call_log_service.list_call_logs(db, tenant_id, params)


# ---------------------------------------------------------------------------
# POST /  — create call log
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create call log",
    description="Record a new inbound, outbound, or missed call against any CRM entity.",
    response_model=CallLogResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_call_log(
    payload: CallLogCreate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> CallLogResponse:
    call_log = await call_log_service.create_call_log(
        db=db,
        tenant_id=tenant_id,
        data=payload,
    )
    return CallLogResponse.model_validate(call_log)


# ---------------------------------------------------------------------------
# GET /{call_log_id}  — get call log detail
# ---------------------------------------------------------------------------


@router.get(
    "/{call_log_id}",
    summary="Get call log detail",
    response_model=CallLogResponse,
    status_code=status.HTTP_200_OK,
)
async def get_call_log(
    call_log_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> CallLogResponse:
    call_log = await call_log_service.get_call_log(db, tenant_id, call_log_id)
    return CallLogResponse.model_validate(call_log)


# ---------------------------------------------------------------------------
# PUT /{call_log_id}  — update call log
# ---------------------------------------------------------------------------


@router.put(
    "/{call_log_id}",
    summary="Update call log",
    description=(
        "Partial update — only non-null fields are applied. "
        "Typical use: add recording_url or duration after the call ends."
    ),
    response_model=CallLogResponse,
    status_code=status.HTTP_200_OK,
)
async def update_call_log(
    call_log_id: uuid.UUID,
    payload: CallLogUpdate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> CallLogResponse:
    call_log = await call_log_service.update_call_log(
        db=db,
        tenant_id=tenant_id,
        call_log_id=call_log_id,
        data=payload,
    )
    return CallLogResponse.model_validate(call_log)


# ---------------------------------------------------------------------------
# DELETE /{call_log_id}  — delete call log
# ---------------------------------------------------------------------------


@router.delete(
    "/{call_log_id}",
    summary="Delete call log",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_call_log(
    call_log_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
):
    await call_log_service.delete_call_log(db, tenant_id, call_log_id)
