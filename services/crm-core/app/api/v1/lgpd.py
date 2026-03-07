"""LGPD compliance API router -- /api/v1/lgpd.

Implements data-subject rights mandated by the Brazilian LGPD:
  - Consent management (grant / revoke)
  - Data portability (export)
  - Right to erasure (anonymisation)
  - Automated retention cleanup

Endpoint map:
  POST   /contacts/{contact_id}/consent/grant  -- grant consent
  POST   /contacts/{contact_id}/consent/revoke -- revoke consent
  GET    /contacts/{contact_id}/export         -- data portability export
  DELETE /contacts/{contact_id}/erase          -- data erasure (ADMIN only)
  POST   /cleanup                              -- retention cleanup (ADMIN only)
"""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.models.user import User
from app.schemas.lgpd import (
    ConsentUpdateRequest,
    DataErasureResponse,
    DataExportResponse,
    RetentionCleanupResponse,
)
from app.services.lgpd_service import lgpd_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_roles("SUPER_ADMIN", "TENANT_ADMIN"))]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# POST /contacts/{contact_id}/consent/grant
# ---------------------------------------------------------------------------


@router.post(
    "/contacts/{contact_id}/consent/grant",
    summary="Grant LGPD consent",
    description="Record explicit consent from a data subject.",
    status_code=status.HTTP_200_OK,
)
async def grant_consent(
    contact_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    body: ConsentUpdateRequest | None = None,
):
    ip_address = body.ip_address if body else None
    contact = await lgpd_service.grant_consent(
        db=db,
        tenant_id=tenant_id,
        contact_id=contact_id,
        ip_address=ip_address,
    )
    return contact


# ---------------------------------------------------------------------------
# POST /contacts/{contact_id}/consent/revoke
# ---------------------------------------------------------------------------


@router.post(
    "/contacts/{contact_id}/consent/revoke",
    summary="Revoke LGPD consent",
    description="Record consent revocation from a data subject.",
    status_code=status.HTTP_200_OK,
)
async def revoke_consent(
    contact_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    body: ConsentUpdateRequest | None = None,
):
    ip_address = body.ip_address if body else None
    contact = await lgpd_service.revoke_consent(
        db=db,
        tenant_id=tenant_id,
        contact_id=contact_id,
        ip_address=ip_address,
    )
    return contact


# ---------------------------------------------------------------------------
# GET /contacts/{contact_id}/export
# ---------------------------------------------------------------------------


@router.get(
    "/contacts/{contact_id}/export",
    summary="Export contact data (LGPD)",
    description=(
        "Export all data related to a contact for LGPD data portability. "
        "Includes profile, conversations, messages, leads, and deals."
    ),
    response_model=DataExportResponse,
    status_code=status.HTTP_200_OK,
)
async def export_contact_data(
    contact_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> DataExportResponse:
    data = await lgpd_service.export_contact_data(
        db=db,
        tenant_id=tenant_id,
        contact_id=contact_id,
    )
    return DataExportResponse(**data)


# ---------------------------------------------------------------------------
# DELETE /contacts/{contact_id}/erase
# ---------------------------------------------------------------------------


@router.delete(
    "/contacts/{contact_id}/erase",
    summary="Erase contact data (LGPD)",
    description=(
        "Anonymise all PII for a contact. Does not hard-delete rows -- "
        "replaces personal data with redaction markers. ADMIN only."
    ),
    response_model=DataErasureResponse,
    status_code=status.HTTP_200_OK,
)
async def erase_contact_data(
    contact_id: uuid.UUID,
    db: DB,
    tenant_id: TenantId,
    current_user: AdminUser,
) -> DataErasureResponse:
    result = await lgpd_service.erase_contact_data(
        db=db,
        tenant_id=tenant_id,
        contact_id=contact_id,
        user_id=current_user.id,
    )
    return DataErasureResponse(**result)


# ---------------------------------------------------------------------------
# POST /cleanup
# ---------------------------------------------------------------------------


@router.post(
    "/cleanup",
    summary="Trigger retention cleanup (LGPD)",
    description=(
        "Anonymise contacts whose last activity exceeds the tenant's "
        "data_retention_days setting. ADMIN only."
    ),
    response_model=RetentionCleanupResponse,
    status_code=status.HTTP_200_OK,
)
async def retention_cleanup(
    db: DB,
    tenant_id: TenantId,
    current_user: AdminUser,
) -> RetentionCleanupResponse:
    result = await lgpd_service.cleanup_expired_data(
        db=db,
        tenant_id=tenant_id,
    )
    return RetentionCleanupResponse(**result)
