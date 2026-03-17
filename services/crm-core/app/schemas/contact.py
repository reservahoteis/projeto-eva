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

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field, field_validator

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
    """Fields accepted when creating a new Contact via POST /contacts.

    Accepts both snake_case (API-native) and camelCase (frontend convention)
    field names.  The frontend typically sends phoneNumber, firstName,
    lastName, companyName, profilePictureUrl.
    """

    model_config = ConfigDict(populate_by_name=True)

    # Required identity — relaxed to optional so frontend can create contacts
    # with only a phone number (e.g. from a WhatsApp conversation).
    first_name: str | None = Field(None, alias="firstName", min_length=1, max_length=100)

    # Optional identity
    salutation: str | None = Field(None, max_length=20)
    last_name: str | None = Field(None, alias="lastName", max_length=100)
    gender: str | None = Field(None, max_length=20)

    # Contact channels
    email: EmailStr | None = None
    # camelCase alias: phoneNumber (frontend convention)
    mobile_no: str | None = Field(None, alias="phoneNumber", max_length=50)
    phone: str | None = Field(None, max_length=50)

    # Professional profile
    # camelCase alias: companyName
    company_name: str | None = Field(None, alias="companyName", max_length=255)
    designation: str | None = Field(None, max_length=150)

    # Media
    # camelCase alias: profilePictureUrl
    image_url: str | None = Field(None, alias="profilePictureUrl", max_length=500)

    # Classification FKs
    industry_id: uuid.UUID | None = None
    territory_id: uuid.UUID | None = None


# ---------------------------------------------------------------------------
# ContactUpdate
# ---------------------------------------------------------------------------


class ContactUpdate(BaseModel):
    """All fields from ContactCreate made optional for partial updates via PUT/PATCH /contacts/{id}.

    Accepts both snake_case (API-native) and camelCase (frontend convention)
    field names.
    """

    model_config = ConfigDict(populate_by_name=True)

    salutation: str | None = Field(None, max_length=20)
    first_name: str | None = Field(None, alias="firstName", min_length=1, max_length=100)
    last_name: str | None = Field(None, alias="lastName", max_length=100)
    gender: str | None = Field(None, max_length=20)

    email: EmailStr | None = None
    # camelCase alias: phoneNumber (frontend convention)
    mobile_no: str | None = Field(None, alias="phoneNumber", max_length=50)
    phone: str | None = Field(None, max_length=50)

    # camelCase alias: companyName
    company_name: str | None = Field(None, alias="companyName", max_length=255)
    designation: str | None = Field(None, max_length=150)

    # camelCase alias: profilePictureUrl
    image_url: str | None = Field(None, alias="profilePictureUrl", max_length=500)

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
    first_name: str = "Unknown"
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

    # LGPD consent
    consent_status: str | None = None
    consent_granted_at: datetime | None = None
    consent_revoked_at: datetime | None = None
    consent_ip_address: str | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    # Legacy / camelCase compatibility fields for dashboard frontend
    @computed_field  # type: ignore[misc]
    @property
    def phoneNumber(self) -> str | None:
        return self.mobile_no

    @computed_field  # type: ignore[misc]
    @property
    def name(self) -> str | None:
        return self.full_name or self.first_name

    @computed_field  # type: ignore[misc]
    @property
    def profilePictureUrl(self) -> str | None:
        return self.image_url

    @computed_field  # type: ignore[misc]
    @property
    def tenantId(self) -> str:
        return str(self.tenant_id)

    @computed_field  # type: ignore[misc]
    @property
    def firstName(self) -> str:
        return self.first_name

    @computed_field  # type: ignore[misc]
    @property
    def lastName(self) -> str | None:
        return self.last_name

    @computed_field  # type: ignore[misc]
    @property
    def companyName(self) -> str | None:
        return self.company_name

    @computed_field  # type: ignore[misc]
    @property
    def createdAt(self) -> str:
        return self.created_at.isoformat()

    @computed_field  # type: ignore[misc]
    @property
    def updatedAt(self) -> str:
        return self.updated_at.isoformat()


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

    Includes computed legacy fields (phoneNumber, name, profilePictureUrl,
    tenantId) so the dashboard frontend can consume them without changes.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID | None = None
    first_name: str = "Unknown"
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

    # Legacy / camelCase compatibility fields for dashboard frontend
    @computed_field  # type: ignore[misc]
    @property
    def phoneNumber(self) -> str | None:
        return self.mobile_no

    @computed_field  # type: ignore[misc]
    @property
    def name(self) -> str | None:
        return self.full_name or self.first_name

    @computed_field  # type: ignore[misc]
    @property
    def profilePictureUrl(self) -> str | None:
        return self.image_url

    @computed_field  # type: ignore[misc]
    @property
    def tenantId(self) -> str | None:
        return str(self.tenant_id) if self.tenant_id else None

    @computed_field  # type: ignore[misc]
    @property
    def firstName(self) -> str:
        return self.first_name

    @computed_field  # type: ignore[misc]
    @property
    def lastName(self) -> str | None:
        return self.last_name

    @computed_field  # type: ignore[misc]
    @property
    def companyName(self) -> str | None:
        return self.company_name

    @computed_field  # type: ignore[misc]
    @property
    def createdAt(self) -> str:
        return self.created_at.isoformat()

    @computed_field  # type: ignore[misc]
    @property
    def updatedAt(self) -> str:
        return self.updated_at.isoformat()


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
    "mobile_no",
}

# Frontend camelCase field names → DB column names
_CAMEL_TO_SNAKE: dict[str, str] = {
    "createdAt": "created_at",
    "updatedAt": "updated_at",
    "firstName": "first_name",
    "lastName": "last_name",
    "fullName": "full_name",
    "companyName": "company_name",
    "phoneNumber": "mobile_no",
    "mobileNo": "mobile_no",
    "industryId": "industry_id",
    "territoryId": "territory_id",
}


def _normalize_sort_field(field: str) -> str:
    """Map a camelCase field name to its snake_case DB column equivalent."""
    return _CAMEL_TO_SNAKE.get(field, field)


class ContactListParams(BaseModel):
    """Query-string parameters for GET /contacts.

    FastAPI automatically populates a Depends(ContactListParams) from the
    query-string when the router uses a dependency function.

    Accepts both legacy snake_case params (page_size, order_by) and
    frontend-native camelCase params (limit, sortBy, sortOrder).
    When both are supplied the camelCase value takes precedence.
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
            field = _normalize_sort_field(parts[0])
            direction = parts[1].lower() if len(parts) == 2 else "asc"
            if field not in _CONTACT_ORDERABLE_FIELDS:
                raise ValueError(
                    f"Field {parts[0]!r} is not orderable. "
                    f"Allowed: {sorted(_CONTACT_ORDERABLE_FIELDS)}"
                )
            if direction not in ("asc", "desc"):
                raise ValueError(f"Direction must be 'asc' or 'desc', got {direction!r}")
        # Re-normalise field names so service layer always gets snake_case
        normalised_tokens = []
        for token in tokens:
            parts = token.split()
            field = _normalize_sort_field(parts[0])
            direction = parts[1].lower() if len(parts) == 2 else "asc"
            normalised_tokens.append(f"{field} {direction}")
        return ",".join(normalised_tokens)


# ---------------------------------------------------------------------------
# BulkDelete request/response schemas
# ---------------------------------------------------------------------------


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID] = Field(..., min_length=1, max_length=500)


class BulkDeleteResponse(BaseModel):
    deleted_count: int
