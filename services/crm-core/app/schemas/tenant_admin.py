"""Pydantic v2 schemas for SUPER_ADMIN tenant management endpoints.

Schema hierarchy:
  TenantCreate          — input for POST /admin/tenants
  TenantUpdate          — input for PUT /admin/tenants/{id}  (all fields optional)
  TenantResponse        — full representation returned from GET /admin/tenants/{id}
  TenantListItem        — lightweight projection used in list views (includes user_count)
  TenantDetailResponse  — full representation with user_count + conversation_count
  TenantCreateResponse  — response from POST /admin/tenants (includes temp_password once)
  WhatsAppConfig        — input body for PUT /admin/tenants/{id}/whatsapp
  WhatsAppConfigResponse — safe (non-sensitive) WhatsApp config view

These schemas are intentionally separate from the main domain schemas because
they expose sensitive configuration fields (WhatsApp tokens, plan tier, billing
status) that must never appear in tenant-scoped API responses.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.lead import PaginatedResponse as PaginatedResponse  # noqa: F401

__all__ = [
    "TenantCreate",
    "TenantUpdate",
    "TenantResponse",
    "TenantListItem",
    "TenantDetailResponse",
    "TenantCreateResponse",
    "WhatsAppConfig",
    "WhatsAppConfigResponse",
    "PaginatedResponse",
]

# ---------------------------------------------------------------------------
# Allowed enum-like sets
# ---------------------------------------------------------------------------

_VALID_STATUSES = {"TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"}
_VALID_PLANS = {"BASIC", "PROFESSIONAL", "ENTERPRISE"}


# ---------------------------------------------------------------------------
# TenantCreate
# ---------------------------------------------------------------------------


class TenantCreate(BaseModel):
    """Fields accepted when provisioning a new Tenant via POST /admin/tenants.

    Only SUPER_ADMIN callers may reach this endpoint.
    """

    # Required identity
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(
        ...,
        min_length=2,
        max_length=100,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        description="URL-safe lowercase slug, e.g. 'hotel-beira-mar'",
    )
    email: EmailStr = Field(..., description="Primary billing / notification email")
    plan: str = Field("BASIC", description="Subscription plan tier")

    # Optional WhatsApp Cloud API integration
    whatsapp_phone_number_id: str | None = Field(None, max_length=255)
    whatsapp_access_token: str | None = Field(None, max_length=1024)
    whatsapp_business_account_id: str | None = Field(None, max_length=255)

    @field_validator("plan")
    @classmethod
    def validate_plan(cls, v: str) -> str:
        normalised = v.upper()
        if normalised not in _VALID_PLANS:
            raise ValueError(
                f"plan {v!r} is not valid. Allowed: {sorted(_VALID_PLANS)}"
            )
        return normalised


# ---------------------------------------------------------------------------
# TenantUpdate
# ---------------------------------------------------------------------------


class TenantUpdate(BaseModel):
    """All tenant fields made optional for partial updates via PUT /admin/tenants/{id}."""

    name: str | None = Field(None, min_length=2, max_length=255)
    email: EmailStr | None = None
    status: str | None = Field(None, description="Lifecycle status of the tenant account")
    plan: str | None = Field(None, description="Subscription plan tier")

    # WhatsApp Cloud API configuration
    whatsapp_phone_number_id: str | None = Field(None, max_length=255)
    whatsapp_access_token: str | None = Field(None, max_length=1024)
    whatsapp_business_account_id: str | None = Field(None, max_length=255)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is None:
            return v
        normalised = v.upper()
        if normalised not in _VALID_STATUSES:
            raise ValueError(
                f"status {v!r} is not valid. Allowed: {sorted(_VALID_STATUSES)}"
            )
        return normalised

    @field_validator("plan")
    @classmethod
    def validate_plan(cls, v: str | None) -> str | None:
        if v is None:
            return v
        normalised = v.upper()
        if normalised not in _VALID_PLANS:
            raise ValueError(
                f"plan {v!r} is not valid. Allowed: {sorted(_VALID_PLANS)}"
            )
        return normalised


# ---------------------------------------------------------------------------
# TenantResponse — full admin view
# ---------------------------------------------------------------------------


class TenantResponse(BaseModel):
    """Complete Tenant representation returned from SUPER_ADMIN endpoints.

    Sensitive token fields are replaced with boolean presence flags so
    they are never serialized in API responses (LOW-004).
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    email: str
    status: str
    plan: str

    # WhatsApp Cloud API integration — SUPER_ADMIN only
    whatsapp_phone_number_id: str | None = None
    whatsapp_access_token_configured: bool = False
    whatsapp_business_account_id: str | None = None

    # Channel token presence flags (never expose raw tokens)
    instagram_access_token_configured: bool = False
    messenger_access_token_configured: bool = False

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# TenantListItem — lightweight projection for list views
# ---------------------------------------------------------------------------


class TenantListItem(BaseModel):
    """Lean Tenant projection for paginated admin list views.

    Includes user_count (fetched separately by TenantAdminService.list_tenants).
    """

    model_config = ConfigDict(from_attributes=False)

    id: uuid.UUID
    name: str
    slug: str
    status: str
    plan: str
    user_count: int
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# TenantDetailResponse — full view including aggregated stats
# ---------------------------------------------------------------------------


class TenantDetailResponse(BaseModel):
    """Complete Tenant detail with user and conversation counts.

    Returned by GET /admin/tenants/{id} (TenantAdminService.get_tenant).
    """

    model_config = ConfigDict(from_attributes=False)

    id: uuid.UUID
    name: str
    slug: str
    status: str
    plan: str
    logo_url: str | None = None

    # WhatsApp — safe fields only (no raw token)
    whatsapp_phone_number_id: str | None = None

    # Stats
    user_count: int
    conversation_count: int

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# TenantCreateResponse — returned once on tenant provisioning
# ---------------------------------------------------------------------------


class AdminUserEmbed(BaseModel):
    """Minimal admin user info embedded in TenantCreateResponse."""

    id: uuid.UUID
    email: str
    name: str
    role: str


class TenantCreateResponse(BaseModel):
    """Response from POST /admin/tenants.

    The temp_password field is returned exactly once — the caller must
    communicate it to the customer securely and immediately.  It is
    not stored in plain text anywhere after this response.
    """

    tenant: TenantResponse
    admin_user: AdminUserEmbed
    temp_password: str = Field(
        ...,
        description="One-time temporary password for the new TENANT_ADMIN user",
    )


# ---------------------------------------------------------------------------
# WhatsAppConfig — input body for configure_whatsapp
# ---------------------------------------------------------------------------


class WhatsAppConfig(BaseModel):
    """Input for PUT /admin/tenants/{id}/whatsapp."""

    phone_number_id: str = Field(..., max_length=255)
    access_token: str = Field(..., max_length=1024)
    business_account_id: str | None = Field(None, max_length=255)
    webhook_verify_token: str | None = Field(None, max_length=255)
    app_secret: str | None = Field(None, max_length=255)


# ---------------------------------------------------------------------------
# WhatsAppConfigResponse — non-sensitive config view
# ---------------------------------------------------------------------------


class WhatsAppConfigResponse(BaseModel):
    """Non-sensitive WhatsApp configuration returned after configure_whatsapp.

    Sensitive fields (access_token, app_secret) are replaced by boolean
    presence flags so the frontend can indicate whether they are configured
    without exposing their values.
    """

    tenant_id: uuid.UUID
    whatsapp_phone_number_id: str | None = None
    whatsapp_access_token_configured: bool
    whatsapp_verify_token: str | None = None
    whatsapp_webhook_secret_configured: bool
