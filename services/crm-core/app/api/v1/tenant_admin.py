"""Tenant Admin API router — /api/v1/tenants.

All endpoints are restricted to SUPER_ADMIN only.
The get_tenant_id dependency is NOT used here because SUPER_ADMIN users
have no tenant_id — they operate globally across all tenants.

Endpoint map:
  POST   /                        create_tenant        — provision new tenant + admin user
  GET    /                        list_tenants         — paginated list of all tenants
  GET    /{id}                    get_tenant           — single tenant with user/conv counts
  PATCH  /{id}                    update_tenant        — partial update (name, status, plan, etc.)
  POST   /{id}/whatsapp-config    configure_whatsapp   — store WhatsApp Cloud API credentials
  GET    /{id}/whatsapp-config    get_whatsapp_config  — retrieve (redacted) WhatsApp config
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import emit_audit_log
from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import User
from app.schemas.tenant_admin import (
    TenantCreate,
    TenantUpdate,
    PaginatedResponse,
)
from app.services.tenant_admin_service import tenant_admin_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

DB = Annotated[AsyncSession, Depends(get_db)]

# Every route in this module requires SUPER_ADMIN.
SuperAdmin = Annotated[User, Depends(require_roles("SUPER_ADMIN"))]


# ---------------------------------------------------------------------------
# POST /  — create tenant
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Provision a new tenant",
    description=(
        "Create a new tenant and its first TENANT_ADMIN user. "
        "Returns the tenant record, admin user info, and a one-time temporary password. "
        "The temp_password is returned ONCE — communicate it securely to the customer."
    ),
    status_code=status.HTTP_201_CREATED,
)
async def create_tenant(
    payload: TenantCreate,
    db: DB,
    current_user: SuperAdmin,
) -> dict[str, Any]:
    result = await tenant_admin_service.create_tenant(
        db=db,
        data=payload,
    )
    await emit_audit_log(
        db=db, tenant_id=result.get("tenant", {}).get("id", current_user.id),
        action="TENANT_CREATED", entity="Tenant",
        entity_id=str(result.get("tenant", {}).get("id", "")),
        user_id=current_user.id,
    )
    return result


# ---------------------------------------------------------------------------
# GET /  — list tenants
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List all tenants",
    description=(
        "Returns a paginated list of all tenants. "
        "Optionally filter by status (exact match) and search across name/slug."
    ),
    response_model=PaginatedResponse[dict],
    status_code=status.HTTP_200_OK,
)
async def list_tenants(
    db: DB,
    current_user: SuperAdmin,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    status_filter: str | None = Query(None, alias="status", description="Filter by tenant status"),
    search: str | None = Query(None, max_length=200, description="Search across name/slug"),
) -> PaginatedResponse[dict]:
    return await tenant_admin_service.list_tenants(
        db=db,
        page=page,
        page_size=page_size,
        status=status_filter,
        search=search,
    )


# ---------------------------------------------------------------------------
# GET /{tenant_id}  — get tenant
# ---------------------------------------------------------------------------


@router.get(
    "/{tenant_id}",
    summary="Get tenant detail",
    description="Return a single tenant by ID with user count and conversation count.",
    status_code=status.HTTP_200_OK,
)
async def get_tenant(
    tenant_id: uuid.UUID,
    db: DB,
    current_user: SuperAdmin,
) -> dict[str, Any]:
    return await tenant_admin_service.get_tenant(
        db=db,
        tenant_id=tenant_id,
    )


# ---------------------------------------------------------------------------
# PATCH /{tenant_id}  — update tenant
# ---------------------------------------------------------------------------


@router.patch(
    "/{tenant_id}",
    summary="Update a tenant",
    description=(
        "Partial update — only non-null fields in the request body are applied. "
        "Validates status and plan values. "
        "If email changes, updates the TENANT_ADMIN user's email."
    ),
    status_code=status.HTTP_200_OK,
)
async def update_tenant(
    tenant_id: uuid.UUID,
    payload: TenantUpdate,
    db: DB,
    current_user: SuperAdmin,
) -> dict[str, Any]:
    result = await tenant_admin_service.update_tenant(
        db=db,
        tenant_id=tenant_id,
        data=payload,
    )
    await emit_audit_log(
        db=db, tenant_id=tenant_id, action="TENANT_UPDATED",
        entity="Tenant", entity_id=str(tenant_id), user_id=current_user.id,
    )
    return result


# ---------------------------------------------------------------------------
# POST /{tenant_id}/whatsapp-config  — configure WhatsApp
# ---------------------------------------------------------------------------


class _WhatsAppConfigRequest:
    """Inline schema for WhatsApp config — avoids polluting the shared schema module."""

    pass


from pydantic import BaseModel, Field  # noqa: E402


class WhatsAppConfigRequest(BaseModel):
    """Body for POST /tenants/{id}/whatsapp-config."""

    phone_number_id: str = Field(..., min_length=1, max_length=255, description="WhatsApp phone number ID")
    access_token: str = Field(..., min_length=1, max_length=1024, description="WhatsApp Cloud API access token")
    business_account_id: str | None = Field(None, max_length=255, description="WhatsApp Business Account ID")
    webhook_verify_token: str | None = Field(None, max_length=255, description="Token used for webhook verification")
    app_secret: str | None = Field(None, max_length=512, description="App Secret for HMAC signature validation")


@router.post(
    "/{tenant_id}/whatsapp-config",
    summary="Configure WhatsApp Cloud API credentials",
    description=(
        "Store WhatsApp Cloud API credentials for a tenant. "
        "Returns non-sensitive config only (tokens are redacted). "
        "The access_token and app_secret are stored server-side and never returned."
    ),
    status_code=status.HTTP_200_OK,
)
async def configure_whatsapp(
    tenant_id: uuid.UUID,
    payload: WhatsAppConfigRequest,
    db: DB,
    current_user: SuperAdmin,
) -> dict[str, Any]:
    result = await tenant_admin_service.configure_whatsapp(
        db=db,
        tenant_id=tenant_id,
        phone_number_id=payload.phone_number_id,
        access_token=payload.access_token,
        business_account_id=payload.business_account_id,
        webhook_verify_token=payload.webhook_verify_token,
        app_secret=payload.app_secret,
    )
    await emit_audit_log(
        db=db, tenant_id=tenant_id, action="WHATSAPP_CONFIG_UPDATED",
        entity="Tenant", entity_id=str(tenant_id), user_id=current_user.id,
    )
    return result


# ---------------------------------------------------------------------------
# GET /{tenant_id}/whatsapp-config  — get WhatsApp config
# ---------------------------------------------------------------------------


@router.get(
    "/{tenant_id}/whatsapp-config",
    summary="Get WhatsApp configuration",
    description=(
        "Return the WhatsApp Cloud API configuration for a tenant. "
        "Sensitive fields (access_token, app_secret) are redacted — "
        "only boolean flags indicating whether they are configured are returned."
    ),
    status_code=status.HTTP_200_OK,
)
async def get_whatsapp_config(
    tenant_id: uuid.UUID,
    db: DB,
    current_user: SuperAdmin,
) -> dict[str, Any]:
    return await tenant_admin_service.get_whatsapp_config(
        db=db,
        tenant_id=tenant_id,
    )
