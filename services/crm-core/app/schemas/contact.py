"""Pydantic v2 schemas for the Contact resource.

Schema hierarchy:
  ContactCreate        — input for POST /contacts
  ContactUpdate        — input for PUT /contacts/{id}  (all fields optional)
  ContactResponse      — full representation returned from GET /contacts/{id}
  ContactListItem      — lightweight projection used in list views
  ContactListParams    — validated query-string parameters for GET /contacts
  PaginatedResponse    — generic envelope (re-exported from lead.py)
  BulkDeleteRequest    — body for POST /contacts/bulk-delete
  BulkDeleteResponse   — result of bulk delete
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# Re-export the generic envelope from lead schemas so callers can import it
# from either module without duplicating the definition.
from app.schemas.lead import PaginatedResponse as PaginatedResponse  # noqa: F401

# ---------------------------------------------------------------------------
# Embedded / nested read schemas
# ---------------------------------------------------------------------------


class IndustryEmbed(BaseModel):
    """Minimal Industry projection for embedding in Contact responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class TerritoryEmbed(BaseModel):
    """Minimal Territory projection for embedding in Contact responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None = None


# ---------------------------------------------------------------------------
# ContactCreate
# ---------------------------------------------------------------------------


class ContactCreate(BaseModel):
    """Fields accepted when creating a new Contact via POST /contacts."""

    # Required identity
    first_name: str = Field(..., min_length=1, max_length=100)

    # Optional identity
    salutation: str | None = Field(None, max_length=20)
    last_name: str | None = Field(None, max_length=100)
    gender: str | None = Field(None, max_length=20)

    # Contact channels
    email: EmailStr | None = None
    mobile_no: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=50)

    # Professional profile
    company_name: str | None = Field(None, max_length=255)
    designation: str | None = Field(None, max_length=150)

    # Media
    image_url: str | None = Field(None, max_length=500)

    # Classification FKs
    industry_id: uuid.UUID | None = None
    territory_id: uuid.UUID | None = None


# ---------------------------------------------------------------------------
# ContactUpdate
# ---------------------------------------------------------------------------


class ContactUpdate(BaseModel):
    """All fields from ContactCreate made optional for partial updates via PUT /contacts/{id}."""

    salutation: str | None = Field(None, max_length=20)
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    gender: str | None = Field(None, max_length=20)

    email: EmailStr | None = None
    mobile_no: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=50)

    company_name: str | None = Field(None, max_length=255)
    designation: str | None = Field(None, max_length=150)

    image_url: str | None = Field(None, max_length=500)

    industry_id: uuid.UUID | None = None
    territory_id: uuid.UUID | None = None


# ---------------------------------------------------------------------------
# ContactResponse — full detail view
# ---------------------------------------------------------------------------


class ContactResponse(BaseModel):
    """Complete Contact representation returned from GET /contacts/{id}."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID

    # Identity
    salutation: str | None = None
    first_name: str
    last_name: str | None = None
    full_name: str | None = None
    gender: str | None = None

    # Contact channels
    email: str | None = None
    mobile_no: str | None = None
    phone: str | None = None

    # Professional
    company_name: str | None = None
    designation: str | None = None
    image_url: str | None = None

    # FK IDs (raw, for client-side caching / optimistic updates)
    industry_id: uuid.UUID | None = None
    territory_id: uuid.UUID | None = None

    # Nested objects (populated via SQLAlchemy selectin relationships)
    industry: IndustryEmbed | None = None
    territory: TerritoryEmbed | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# ContactListItem — lightweight projection for list views
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


class ContactListItem(BaseModel):
    """Lean Contact projection used in paginated list views.

    Deliberately excludes heavy fields to keep list payloads small.
    The frontend fetches the full ContactResponse only when opening the
    detail panel.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str | None = None
    full_name: str | None = None

    email: str | None = None
    mobile_no: str | None = None

    company_name: str | None = None
    designation: str | None = None
    image_url: str | None = None

    # Nested mini embeds
    industry: IndustryMini | None = None
    territory: TerritoryMini | None = None

    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# ContactListParams — validated query-string parameters
# ---------------------------------------------------------------------------

# Valid fields for ordering — prevents SQL injection via ORDER BY
_CONTACT_ORDERABLE_FIELDS = {
    "created_at",
    "updated_at",
    "first_name",
    "last_name",
    "full_name",
    "email",
    "company_name",
    "designation",
    "industry_id",
    "territory_id",
}


class ContactListParams(BaseModel):
    """Query-string parameters for GET /contacts.

    FastAPI automatically populates a Depends(ContactListParams) from the
    query-string when the router uses a dependency function.
    """

    # Pagination
    page: int = Field(1, ge=1, description="1-based page number")
    page_size: int = Field(20, ge=1, le=200, description="Results per page (max 200)")

    # Sorting — format: "field_name asc|desc"
    order_by: str = Field(
        "created_at desc",
        description='Comma-separated sort tokens, e.g. "created_at desc,first_name asc"',
    )

    # Full-text search across first_name, last_name, email, company_name
    search: str | None = Field(None, max_length=200)

    # Arbitrary filter dict — keys are Contact column names
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
            if field not in _CONTACT_ORDERABLE_FIELDS:
                raise ValueError(
                    f"Field {field!r} is not orderable. "
                    f"Allowed: {sorted(_CONTACT_ORDERABLE_FIELDS)}"
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
