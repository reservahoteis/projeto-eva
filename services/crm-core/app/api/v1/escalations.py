"""Escalations API router — /api/v1/escalations.

All endpoints require a valid Bearer JWT (get_current_user) and resolve the
calling user's tenant automatically (get_tenant_id).

Endpoint map:
  GET  /                 list_escalations     — paginated, filtered
  GET  /stats            get_escalation_stats — aggregated counts
  GET  /check-ia-lock    check_ia_lock        — check IA lock status by phone
  POST /                 create_escalation
  GET  /{id}             get_escalation
  PATCH/{id}             update_escalation    — status transitions
"""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id
from app.models.user import User
from app.schemas.escalation import (
    EscalationCreate,
    EscalationListParams,
    EscalationResponse,
    EscalationStats,
    EscalationUpdate,
    PaginatedResponse,
)
from app.services.escalation_service import escalation_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Dependency: build EscalationListParams from query-string args.
# ---------------------------------------------------------------------------


def _escalation_list_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    order_by: str = Query("created_at desc"),
    status: str | None = Query(None, description="Filter by escalation status"),
    reason: str | None = Query(None, max_length=500, description="Substring filter on reason"),
    hotel_unit: str | None = Query(None, max_length=100),
) -> EscalationListParams:
    return EscalationListParams(
        page=page,
        page_size=page_size,
        order_by=order_by,
        status=status,
        reason=reason,
        hotel_unit=hotel_unit,
    )


ListParams = Annotated[EscalationListParams, Depends(_escalation_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list escalations
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List escalations",
    description=(
        "Returns a paginated list of Escalations for the calling user's tenant. "
        "Filter by status, reason substring, or hotel_unit."
    ),
    response_model=PaginatedResponse[EscalationResponse],
    status_code=status.HTTP_200_OK,
)
async def list_escalations(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    params: ListParams,
) -> PaginatedResponse[EscalationResponse]:
    return await escalation_service.list_escalations(
        db=db,
        tenant_id=tenant_id,
        params=params,
    )


# ---------------------------------------------------------------------------
# GET /stats  — escalation statistics
# ---------------------------------------------------------------------------


@router.get(
    "/stats",
    summary="Escalation statistics",
    description=(
        "Returns aggregated escalation counts (by status, by reason) and "
        "average resolution time in minutes for the calling user's tenant."
    ),
    response_model=EscalationStats,
    status_code=status.HTTP_200_OK,
)
async def get_escalation_stats(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> EscalationStats:
    return await escalation_service.get_escalation_stats(
        db=db,
        tenant_id=tenant_id,
    )


# ---------------------------------------------------------------------------
# GET /check-ia-lock  — check IA lock status for a phone number
# ---------------------------------------------------------------------------


@router.get(
    "/check-ia-lock",
    summary="Check IA lock status by phone number",
    description=(
        "Look up the most recent active conversation for a phone number and "
        "return whether the AI is currently locked. "
        "Returns {ia_locked: false} when no contact or active conversation is found "
        "(safe fallback: allow the AI to respond)."
    ),
    status_code=status.HTTP_200_OK,
)
async def check_ia_lock(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    phone_number: str = Query(..., min_length=5, max_length=20, description="E.164 phone number to check"),
    channel: str | None = Query(None, max_length=50, description="Optional channel filter (e.g. WHATSAPP)"),
) -> dict:
    locked = await escalation_service.is_ia_locked_by_phone(
        db=db,
        tenant_id=tenant_id,
        phone_number=phone_number,
        channel=channel,
    )
    return {"ia_locked": locked, "phone_number": phone_number}


# ---------------------------------------------------------------------------
# POST /  — create escalation
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create an escalation",
    description=(
        "Create a new escalation record for a conversation. "
        "Side effects: sets ia_locked=True and transitions the conversation "
        "status from BOT_HANDLING → OPEN so a human attendant can handle it."
    ),
    response_model=EscalationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_escalation(
    payload: EscalationCreate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> EscalationResponse:
    escalation = await escalation_service.create_escalation(
        db=db,
        tenant_id=tenant_id,
        data=payload,
    )
    return EscalationResponse.model_validate(escalation)


# ---------------------------------------------------------------------------
# GET /{escalation_id}  — get escalation detail
# ---------------------------------------------------------------------------


@router.get(
    "/{escalation_id}",
    summary="Get escalation detail",
    description="Return the full Escalation object including nested attended_by user.",
    response_model=EscalationResponse,
    status_code=status.HTTP_200_OK,
)
async def get_escalation(
    escalation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> EscalationResponse:
    escalation = await escalation_service.get_escalation(
        db=db,
        tenant_id=tenant_id,
        escalation_id=escalation_id,
    )
    return EscalationResponse.model_validate(escalation)


# ---------------------------------------------------------------------------
# PATCH /{escalation_id}  — update escalation status
# ---------------------------------------------------------------------------


@router.patch(
    "/{escalation_id}",
    summary="Update escalation status",
    description=(
        "Advance an escalation through its status lifecycle. "
        "Valid transitions: PENDING → IN_PROGRESS | CANCELLED; "
        "IN_PROGRESS → RESOLVED | CANCELLED. "
        "Setting IN_PROGRESS also records the attended_by_id."
    ),
    response_model=EscalationResponse,
    status_code=status.HTTP_200_OK,
)
async def update_escalation(
    escalation_id: uuid.UUID,
    payload: EscalationUpdate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> EscalationResponse:
    escalation = await escalation_service.update_escalation(
        db=db,
        tenant_id=tenant_id,
        escalation_id=escalation_id,
        data=payload,
    )
    return EscalationResponse.model_validate(escalation)
