"""Pydantic v2 schemas for the Lead resource.

Schema hierarchy:
  LeadCreate        — input for POST /leads
  LeadUpdate        — input for PUT /leads/{id}  (all fields optional)
  LeadResponse      — full representation returned from GET /leads/{id}
  LeadListItem      — lightweight projection used in list / kanban / group_by views
  LeadListParams    — validated query-string parameters for GET /leads
  PaginatedResponse — generic envelope wrapping list results

Nested read-only schemas (LeadStatusEmbed, LeadSourceEmbed, …) keep the
response contract stable even when the underlying lookup tables gain new columns.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# ---------------------------------------------------------------------------
# Generic type variable for PaginatedResponse
# ---------------------------------------------------------------------------

DataT = TypeVar("DataT")


# ---------------------------------------------------------------------------
# Embedded / nested read schemas
# ---------------------------------------------------------------------------


class LeadStatusEmbed(BaseModel):
    """Minimal LeadStatus projection for embedding in Lead responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    label: str
    color: str
    status_type: str | None = None
    position: int


class LeadSourceEmbed(BaseModel):
    """Minimal LeadSource projection."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class IndustryEmbed(BaseModel):
    """Minimal Industry projection."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class TerritoryEmbed(BaseModel):
    """Minimal Territory projection."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None = None


class LeadOwnerEmbed(BaseModel):
    """Minimal User projection for the lead owner field."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    avatar_url: str | None = None


class OrganizationEmbed(BaseModel):
    """Minimal Organization projection."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_name: str
    logo_url: str | None = None
    website: str | None = None


# ---------------------------------------------------------------------------
# LeadCreate
# ---------------------------------------------------------------------------


class LeadCreate(BaseModel):
    """Fields accepted when creating a new Lead via POST /leads."""

    # Required identity
    first_name: str = Field(..., min_length=1, max_length=100)
    status_id: uuid.UUID

    # Optional identity
    salutation: str | None = Field(None, max_length=20)
    middle_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    gender: str | None = Field(None, max_length=20)

    # Contact details
    email: EmailStr | None = None
    mobile_no: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=50)
    website: str | None = Field(None, max_length=500)

    # Professional
    job_title: str | None = Field(None, max_length=150)
    organization_name: str | None = Field(None, max_length=255)
    image_url: str | None = Field(None, max_length=500)

    # Classification FKs
    source_id: uuid.UUID | None = None
    industry_id: uuid.UUID | None = None
    territory_id: uuid.UUID | None = None
    organization_id: uuid.UUID | None = None

    # Ownership
    lead_owner_id: uuid.UUID | None = None

    # Company sizing
    no_of_employees: str | None = Field(
        None,
        max_length=20,
        description="Enum-like bucket: 1-10 | 11-50 | 51-200 | 201-500 | 501-1000 | 1000+",
    )
    annual_revenue: float | None = Field(None, ge=0)
    currency: str = Field("BRL", max_length=10)

    # Disqualification (may be set at creation for imported leads)
    lost_reason_id: uuid.UUID | None = None
    lost_notes: str | None = None

    # Meta integration
    facebook_lead_id: str | None = Field(None, max_length=255)
    facebook_form_id: str | None = Field(None, max_length=255)

    @field_validator("no_of_employees")
    @classmethod
    def validate_employee_bucket(cls, v: str | None) -> str | None:
        allowed = {"1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"}
        if v is not None and v not in allowed:
            raise ValueError(f"no_of_employees must be one of {sorted(allowed)}")
        return v


# ---------------------------------------------------------------------------
# LeadUpdate
# ---------------------------------------------------------------------------


class LeadUpdate(BaseModel):
    """All fields from LeadCreate made optional for partial updates via PUT /leads/{id}.

    Pydantic v2 does not support automatic Optional generation from another model,
    so we redefine all fields explicitly.  This keeps the update contract visible
    and avoids magic.
    """

    # Identity
    salutation: str | None = Field(None, max_length=20)
    first_name: str | None = Field(None, min_length=1, max_length=100)
    middle_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    gender: str | None = Field(None, max_length=20)

    # Contact
    email: EmailStr | None = None
    mobile_no: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=50)
    website: str | None = Field(None, max_length=500)

    # Professional
    job_title: str | None = Field(None, max_length=150)
    organization_name: str | None = Field(None, max_length=255)
    image_url: str | None = Field(None, max_length=500)

    # Classification
    status_id: uuid.UUID | None = None
    source_id: uuid.UUID | None = None
    industry_id: uuid.UUID | None = None
    territory_id: uuid.UUID | None = None
    organization_id: uuid.UUID | None = None

    # Ownership
    lead_owner_id: uuid.UUID | None = None

    # Sizing
    no_of_employees: str | None = Field(None, max_length=20)
    annual_revenue: float | None = Field(None, ge=0)
    currency: str | None = Field(None, max_length=10)

    # Disqualification
    lost_reason_id: uuid.UUID | None = None
    lost_notes: str | None = None

    # Meta integration
    facebook_lead_id: str | None = Field(None, max_length=255)
    facebook_form_id: str | None = Field(None, max_length=255)

    @field_validator("no_of_employees")
    @classmethod
    def validate_employee_bucket(cls, v: str | None) -> str | None:
        allowed = {"1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"}
        if v is not None and v not in allowed:
            raise ValueError(f"no_of_employees must be one of {sorted(allowed)}")
        return v


# ---------------------------------------------------------------------------
# LeadResponse — full detail view
# ---------------------------------------------------------------------------


class LeadResponse(BaseModel):
    """Complete Lead representation returned from GET /leads/{id}."""

    model_config = ConfigDict(from_attributes=True)

    # Base
    id: uuid.UUID
    tenant_id: uuid.UUID
    naming_series: str | None = None
    created_by_id: uuid.UUID | None = None

    # Identity
    salutation: str | None = None
    first_name: str
    middle_name: str | None = None
    last_name: str | None = None
    lead_name: str | None = None
    gender: str | None = None

    # Contact
    email: str | None = None
    mobile_no: str | None = None
    phone: str | None = None
    website: str | None = None

    # Professional
    job_title: str | None = None
    organization_name: str | None = None
    image_url: str | None = None

    # FK IDs (raw, for client-side caching / optimistic updates)
    status_id: uuid.UUID
    source_id: uuid.UUID | None = None
    industry_id: uuid.UUID | None = None
    territory_id: uuid.UUID | None = None
    organization_id: uuid.UUID | None = None
    lead_owner_id: uuid.UUID | None = None
    lost_reason_id: uuid.UUID | None = None
    sla_id: uuid.UUID | None = None

    # Nested objects (populated via SQLAlchemy selectin relationships)
    status: LeadStatusEmbed
    source: LeadSourceEmbed | None = None
    industry: IndustryEmbed | None = None
    territory: TerritoryEmbed | None = None
    lead_owner: LeadOwnerEmbed | None = None
    organization: OrganizationEmbed | None = None

    # Sizing
    no_of_employees: str | None = None
    annual_revenue: float | None = None
    currency: str

    # Conversion
    converted: bool

    # SLA
    sla_status: str | None = None
    sla_creation: datetime | None = None
    response_by: datetime | None = None
    first_responded_on: datetime | None = None
    communication_status: str | None = None

    # Facebook
    facebook_lead_id: str | None = None
    facebook_form_id: str | None = None

    # Disqualification
    lost_notes: str | None = None

    # Financials
    total: float | None = None
    net_total: float | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# LeadListItem — lightweight projection for list / kanban / group_by views
# ---------------------------------------------------------------------------


class LeadStatusMini(BaseModel):
    """Ultra-lean status embed for list rows — only what the UI needs to render."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    label: str
    color: str
    position: int


class LeadSourceMini(BaseModel):
    """Ultra-lean source embed for list rows."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class LeadOwnerMini(BaseModel):
    """Ultra-lean owner embed for list rows — avatar for kanban card chips."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    avatar_url: str | None = None


class LeadListItem(BaseModel):
    """Lean Lead projection used in list / kanban / group_by views.

    Deliberately excludes heavy text fields (lost_notes, SLA timestamps, etc.)
    to keep list payloads small.  The frontend fetches the full LeadResponse
    only when a user opens the detail panel.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    naming_series: str | None = None
    lead_name: str | None = None
    first_name: str
    last_name: str | None = None

    email: str | None = None
    mobile_no: str | None = None

    organization_name: str | None = None

    # Nested mini embeds
    status: LeadStatusMini
    source: LeadSourceMini | None = None
    lead_owner: LeadOwnerMini | None = None

    converted: bool
    currency: str

    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# LeadListParams — validated query-string parameters
# ---------------------------------------------------------------------------

# Valid fields for ordering — prevents SQL injection via ORDER BY
_ORDERABLE_FIELDS = {
    "created_at",
    "updated_at",
    "lead_name",
    "first_name",
    "email",
    "organization_name",
    "annual_revenue",
    "status_id",
    "source_id",
    "lead_owner_id",
}

# Valid fields for kanban column grouping
_KANBAN_COLUMN_FIELDS = {"status_id", "source_id", "lead_owner_id", "territory_id"}

# Valid fields for group_by aggregation
_GROUP_BY_FIELDS = {
    "status_id",
    "source_id",
    "lead_owner_id",
    "territory_id",
    "industry_id",
    "no_of_employees",
    "converted",
    "gender",
}


class LeadListParams(BaseModel):
    """Query-string parameters for GET /leads.

    FastAPI automatically populates a Depends(LeadListParams) from query-string
    when the router uses Annotated[LeadListParams, Query()].
    """

    # Pagination
    page: int = Field(1, ge=1, description="1-based page number")
    page_size: int = Field(20, ge=1, le=200, description="Results per page (max 200)")

    # Sorting — format: "field_name asc|desc"
    order_by: str = Field(
        "created_at desc",
        description='Comma-separated sort tokens, e.g. "created_at desc,lead_name asc"',
    )

    # View type
    view_type: Literal["list", "kanban", "group_by"] = Field(
        "list",
        description="Determines the response shape",
    )

    # Kanban-specific: which field defines the columns
    column_field: str | None = Field(
        None,
        description='Field to use as kanban column (e.g. "status_id"). Required when view_type=kanban.',
    )

    # Group-by-specific
    group_by_field: str | None = Field(
        None,
        description='Field to aggregate by (e.g. "source_id"). Required when view_type=group_by.',
    )

    # Arbitrary filter dict — keys are Lead column names, values are filter values.
    # Example: {"status_id": "uuid", "converted": false}
    # Sent as JSON-encoded query param: ?filters={"status_id":"..."}
    filters: dict[str, Any] | None = Field(
        None,
        description="JSON dict of field->value filters, e.g. {'converted': false, 'status_id': 'uuid'}",
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
            if field not in _ORDERABLE_FIELDS:
                raise ValueError(
                    f"Field {field!r} is not orderable. "
                    f"Allowed: {sorted(_ORDERABLE_FIELDS)}"
                )
            if direction not in ("asc", "desc"):
                raise ValueError(f"Direction must be 'asc' or 'desc', got {direction!r}")
        return v

    @field_validator("column_field")
    @classmethod
    def validate_column_field(cls, v: str | None) -> str | None:
        if v is not None and v not in _KANBAN_COLUMN_FIELDS:
            raise ValueError(
                f"column_field {v!r} is not supported. "
                f"Allowed: {sorted(_KANBAN_COLUMN_FIELDS)}"
            )
        return v

    @field_validator("group_by_field")
    @classmethod
    def validate_group_by_field(cls, v: str | None) -> str | None:
        if v is not None and v not in _GROUP_BY_FIELDS:
            raise ValueError(
                f"group_by_field {v!r} is not supported. "
                f"Allowed: {sorted(_GROUP_BY_FIELDS)}"
            )
        return v


# ---------------------------------------------------------------------------
# PaginatedResponse — generic envelope
# ---------------------------------------------------------------------------


class PaginatedResponse(BaseModel, Generic[DataT]):
    """Generic paginated envelope used by all list endpoints."""

    data: list[DataT]
    total_count: int
    page: int
    page_size: int

    @property
    def total_pages(self) -> int:
        if self.page_size == 0:
            return 0
        import math
        return math.ceil(self.total_count / self.page_size)


# ---------------------------------------------------------------------------
# Kanban / Group-by response shapes
# ---------------------------------------------------------------------------


class KanbanColumn(BaseModel, Generic[DataT]):
    """One column in a kanban board response."""

    column_value: str | None = Field(
        None,
        description="The value of column_field for this group (e.g. status label)",
    )
    column_id: uuid.UUID | None = Field(
        None,
        description="FK UUID of the column_field value, if applicable",
    )
    color: str | None = None
    position: int | None = None
    count: int
    data: list[DataT]


class KanbanResponse(BaseModel, Generic[DataT]):
    """Full kanban board response: one KanbanColumn per distinct column_field value."""

    columns: list[KanbanColumn[DataT]]
    total_count: int


class GroupByBucket(BaseModel, Generic[DataT]):
    """One bucket in a group_by response."""

    group_value: str | None = Field(
        None,
        description="The value of group_by_field for this bucket",
    )
    group_id: uuid.UUID | None = None
    count: int
    data: list[DataT]


class GroupByResponse(BaseModel, Generic[DataT]):
    """Full group_by response: one bucket per distinct group_by_field value."""

    buckets: list[GroupByBucket[DataT]]
    total_count: int


# ---------------------------------------------------------------------------
# Assignment response schema
# ---------------------------------------------------------------------------


class AssignmentResponse(BaseModel):
    """Response returned from POST /leads/{id}/assign."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    doctype: str
    docname: uuid.UUID
    assigned_to_id: uuid.UUID
    assigned_by_id: uuid.UUID | None = None
    status: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# BulkDelete request/response schemas
# ---------------------------------------------------------------------------


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID] = Field(..., min_length=1, max_length=500)


class BulkDeleteResponse(BaseModel):
    deleted_count: int


# ---------------------------------------------------------------------------
# Convert-to-deal schemas
# ---------------------------------------------------------------------------


class ConvertToDealResponse(BaseModel):
    """Minimal Deal summary returned when a lead is converted."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    naming_series: str | None = None
    lead_id: uuid.UUID | None = None
    lead_name: str | None = None
    organization_name: str | None = None
    status_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Assign request schema
# ---------------------------------------------------------------------------


class AssignRequest(BaseModel):
    user_id: uuid.UUID
