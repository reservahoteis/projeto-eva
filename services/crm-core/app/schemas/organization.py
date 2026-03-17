"""Pydantic v2 schemas for the Organization resource.

Schema hierarchy:
  OrganizationCreate      — input for POST /organizations
  OrganizationUpdate      — input for PUT /organizations/{id}  (all fields optional)
  OrganizationResponse    — full representation returned from GET /organizations/{id}
  OrganizationListItem    — lightweight projection used in list views
  OrganizationListParams  — validated query-string parameters for GET /organizations
  PaginatedResponse       — generic envelope (re-exported from lead.py)
  BulkDeleteRequest       — body for POST /organizations/bulk-delete
  BulkDeleteResponse      — result of bulk delete
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Re-export the generic envelope from lead schemas so callers can import it
# from either module without duplicating the definition.
from app.schemas.lead import PaginatedResponse as PaginatedResponse  # noqa: F401

# ---------------------------------------------------------------------------
# Embedded / nested read schemas
# ---------------------------------------------------------------------------


class IndustryEmbed(BaseModel):
    """Minimal Industry projection for embedding in Organization responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class TerritoryEmbed(BaseModel):
    """Minimal Territory projection for embedding in Organization responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None = None


# ---------------------------------------------------------------------------
# OrganizationCreate
# ---------------------------------------------------------------------------

_EMPLOYEE_BUCKETS = {"1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"}


class OrganizationCreate(BaseModel):
    """Fields accepted when creating a new Organization via POST /organizations."""

    # Required identity
    organization_name: str = Field(..., min_length=1, max_length=255)

    # Optional identity / branding
    logo_url: str | None = Field(None, max_length=500)
    website: str | None = Field(None, max_length=500)

    # Sizing metrics
    no_of_employees: str | None = Field(
        None,
        max_length=20,
        description="Enum-like bucket: 1-10 | 11-50 | 51-200 | 201-500 | 501-1000 | 1000+",
    )
    annual_revenue: float | None = Field(None, ge=0)

    # Classification FKs
    industry_id: uuid.UUID | None = None
    territory_id: uuid.UUID | None = None

    # Address / location
    address: str | None = None

    @field_validator("no_of_employees")
    @classmethod
    def validate_employee_bucket(cls, v: str | None) -> str | None:
        if v is not None and v not in _EMPLOYEE_BUCKETS:
            raise ValueError(f"no_of_employees must be one of {sorted(_EMPLOYEE_BUCKETS)}")
        return v


# ---------------------------------------------------------------------------
# OrganizationUpdate
# ---------------------------------------------------------------------------


class OrganizationUpdate(BaseModel):
    """All fields from OrganizationCreate made optional for partial updates."""

    organization_name: str | None = Field(None, min_length=1, max_length=255)
    logo_url: str | None = Field(None, max_length=500)
    website: str | None = Field(None, max_length=500)
    no_of_employees: str | None = Field(None, max_length=20)
    annual_revenue: float | None = Field(None, ge=0)
    industry_id: uuid.UUID | None = None
    territory_id: uuid.UUID | None = None
    address: str | None = None

    @field_validator("no_of_employees")
    @classmethod
    def validate_employee_bucket(cls, v: str | None) -> str | None:
        if v is not None and v not in _EMPLOYEE_BUCKETS:
            raise ValueError(f"no_of_employees must be one of {sorted(_EMPLOYEE_BUCKETS)}")
        return v


# ---------------------------------------------------------------------------
# OrganizationResponse — full detail view
# ---------------------------------------------------------------------------


class OrganizationResponse(BaseModel):
    """Complete Organization representation returned from GET /organizations/{id}."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID

    # Identity
    organization_name: str
    logo_url: str | None = None
    website: str | None = None

    # Sizing
    no_of_employees: str | None = None
    annual_revenue: float | None = None

    # FK IDs (raw, for client-side caching / optimistic updates)
    industry_id: uuid.UUID | None = None
    territory_id: uuid.UUID | None = None

    # Nested objects (populated via SQLAlchemy selectin relationships)
    industry: IndustryEmbed | None = None
    territory: TerritoryEmbed | None = None

    # Address
    address: str | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# OrganizationListItem — lightweight projection for list views
# ---------------------------------------------------------------------------


class IndustryMini(BaseModel):
    """Ultra-lean industry embed for list rows."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class TerritoryMini(BaseModel):
    """Ultra-lean territory embed for list rows."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class OrganizationListItem(BaseModel):
    """Lean Organization projection used in paginated list views.

    Excludes heavy text fields (address, etc.) to keep payloads small.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_name: str
    logo_url: str | None = None
    website: str | None = None
    no_of_employees: str | None = None
    annual_revenue: float | None = None

    # Nested mini embeds
    industry: IndustryMini | None = None
    territory: TerritoryMini | None = None

    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# OrganizationListParams — validated query-string parameters
# ---------------------------------------------------------------------------

# Valid fields for ordering — prevents SQL injection via ORDER BY
_ORG_ORDERABLE_FIELDS = {
    "created_at",
    "updated_at",
    "organization_name",
    "website",
    "annual_revenue",
    "no_of_employees",
    "industry_id",
    "territory_id",
}


class OrganizationListParams(BaseModel):
    """Query-string parameters for GET /organizations.

    FastAPI automatically populates a Depends(OrganizationListParams) from the
    query-string when the router uses a dependency function.
    """

    # Pagination
    page: int = Field(1, ge=1, description="1-based page number")
    page_size: int = Field(20, ge=1, le=200, description="Results per page (max 200)")

    # Sorting — format: "field_name asc|desc"
    order_by: str = Field(
        "created_at desc",
        description='Comma-separated sort tokens, e.g. "created_at desc,organization_name asc"',
    )

    # Full-text search across organization_name and website
    search: str | None = Field(None, max_length=200)

    # Arbitrary filter dict — keys are Organization column names
    filters: dict[str, Any] | None = Field(
        None,
        description="JSON dict of field->value filters, e.g. {'industry_id': 'uuid'}",
    )

    @field_validator("order_by")
    @classmethod
    def validate_order_by(cls, v: str) -> str:
        tokens = [token.strip() for token in v.split(",") if token.strip()]
        for token in tokens:
            parts = token.split()
            if len(parts) not in (1, 2):
                raise ValueError(f"Invalid order_by token: {token!r}")
            field = parts[0]
            direction = parts[1].lower() if len(parts) == 2 else "asc"
            if field not in _ORG_ORDERABLE_FIELDS:
                raise ValueError(
                    f"Field {field!r} is not orderable. "
                    f"Allowed: {sorted(_ORG_ORDERABLE_FIELDS)}"
                )
            if direction not in ("asc", "desc"):
                raise ValueError(f"Direction must be 'asc' or 'desc', got {direction!r}")
        return v


# ---------------------------------------------------------------------------
# BulkDelete request/response schemas
# ---------------------------------------------------------------------------


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID] = Field(..., min_length=1, max_length=500)


class BulkDeleteResponse(BaseModel):
    deleted_count: int
