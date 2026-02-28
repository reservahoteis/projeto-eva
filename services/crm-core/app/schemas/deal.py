"""Pydantic v2 schemas for the Deal entity.

Covers:
  DealCreate       — input for POST /deals
  DealUpdate       — input for PUT /deals/{id} (all fields optional)
  DealResponse     — full representation with nested related objects
  DealListItem     — lightweight projection for list views and kanban cards
  MarkLostRequest  — body for POST /deals/{id}/lost
  AssignRequest    — body for POST /deals/{id}/assign
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Shared leaf schemas (nested inside DealResponse)
# ---------------------------------------------------------------------------


class StatusEmbed(BaseModel):
    """Minimal DealStatus projection embedded in deal responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    label: str
    color: str
    status_type: str | None = None
    position: int = 0


class OrganizationEmbed(BaseModel):
    """Minimal Organization projection embedded in deal responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_name: str


class LeadEmbed(BaseModel):
    """Minimal Lead projection embedded in deal responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_name: str | None = None
    email: str | None = None


class UserEmbed(BaseModel):
    """Minimal User projection embedded in deal responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    avatar_url: str | None = None


class ContactEmbed(BaseModel):
    """Minimal Contact projection embedded in deal responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str | None = None
    email: str | None = None
    mobile_no: str | None = None


# ---------------------------------------------------------------------------
# DealCreate
# ---------------------------------------------------------------------------


class DealCreate(BaseModel):
    """Validated input schema for creating a new deal."""

    # Required
    status_id: uuid.UUID = Field(..., description="FK to deal_statuses.id — must belong to the tenant")

    # Associations
    organization_id: uuid.UUID | None = Field(None, description="FK to organizations.id")
    lead_id: uuid.UUID | None = Field(None, description="FK to leads.id — source lead being converted")
    deal_owner_id: uuid.UUID | None = Field(None, description="FK to users.id — responsible salesperson")
    contact_id: uuid.UUID | None = Field(None, description="FK to contacts.id — primary contact for this deal")

    # Pipeline metrics
    probability: float | None = Field(
        None,
        ge=0.0,
        le=100.0,
        description="Close probability percentage (0–100)",
    )
    deal_value: float | None = Field(None, ge=0.0, description="Monetary value of the deal")
    currency: str = Field("BRL", max_length=10, description="ISO 4217 currency code")
    expected_closure_date: date | None = Field(None, description="Anticipated closing date")

    # Sales process
    next_step: str | None = Field(None, max_length=500)

    # Classification
    source_id: uuid.UUID | None = Field(None, description="FK to lead_sources.id")
    territory_id: uuid.UUID | None = Field(None, description="FK to territories.id")

    # Contact snapshot (denormalised from lead/contact at creation time)
    salutation: str | None = Field(None, max_length=20)
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    lead_name: str | None = Field(None, max_length=300)
    email: str | None = Field(None, max_length=255)
    mobile_no: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=50)
    job_title: str | None = Field(None, max_length=150)

    # Organisation snapshot
    organization_name: str | None = Field(None, max_length=255)

    @field_validator("currency")
    @classmethod
    def currency_uppercase(cls, v: str) -> str:
        return v.upper()


# ---------------------------------------------------------------------------
# DealUpdate
# ---------------------------------------------------------------------------


class DealUpdate(BaseModel):
    """Validated input schema for updating an existing deal.

    Every field is optional — only provided fields are applied (PATCH semantics
    implemented at the service layer via model_fields_set).
    """

    status_id: uuid.UUID | None = None
    organization_id: uuid.UUID | None = None
    lead_id: uuid.UUID | None = None
    deal_owner_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None

    probability: float | None = Field(None, ge=0.0, le=100.0)
    deal_value: float | None = Field(None, ge=0.0)
    currency: str | None = Field(None, max_length=10)
    expected_closure_date: date | None = None

    next_step: str | None = Field(None, max_length=500)

    source_id: uuid.UUID | None = None
    territory_id: uuid.UUID | None = None

    salutation: str | None = Field(None, max_length=20)
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    lead_name: str | None = Field(None, max_length=300)
    email: str | None = Field(None, max_length=255)
    mobile_no: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=50)
    job_title: str | None = Field(None, max_length=150)
    organization_name: str | None = Field(None, max_length=255)

    @field_validator("currency")
    @classmethod
    def currency_uppercase(cls, v: str | None) -> str | None:
        return v.upper() if v else v


# ---------------------------------------------------------------------------
# DealResponse
# ---------------------------------------------------------------------------


class DealResponse(BaseModel):
    """Full deal representation returned by GET /deals/{id} and mutation endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    naming_series: str | None = None

    # Associations — nested projections when relationship is loaded
    status: StatusEmbed
    organization: OrganizationEmbed | None = None
    lead: LeadEmbed | None = None
    deal_owner: UserEmbed | None = None
    contact: ContactEmbed | None = None

    # Raw FK fields retained so callers can also use IDs directly
    status_id: uuid.UUID
    organization_id: uuid.UUID | None = None
    lead_id: uuid.UUID | None = None
    deal_owner_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None

    # Pipeline metrics
    probability: float | None = None
    deal_value: float | None = None
    currency: str = "BRL"
    exchange_rate: float = 1.0
    expected_deal_value: float | None = None

    # Timeline
    expected_closure_date: date | None = None
    closed_date: date | None = None

    # Sales process
    next_step: str | None = None

    # Classification FKs
    source_id: uuid.UUID | None = None
    territory_id: uuid.UUID | None = None
    industry_id: uuid.UUID | None = None

    # Contact snapshot
    salutation: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    lead_name: str | None = None
    email: str | None = None
    mobile_no: str | None = None
    phone: str | None = None
    job_title: str | None = None
    gender: str | None = None

    # Organisation snapshot
    organization_name: str | None = None
    no_of_employees: str | None = None
    annual_revenue: float | None = None
    website: str | None = None

    # SLA
    sla_status: str | None = None
    communication_status: str | None = None

    # Disqualification
    lost_reason_id: uuid.UUID | None = None
    lost_notes: str | None = None

    # Audit
    created_by_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# DealListItem
# ---------------------------------------------------------------------------


class DealListItem(BaseModel):
    """Lightweight projection used in paginated list responses and kanban views.

    Avoids loading full nested objects — only what the list UI needs.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    naming_series: str | None = None

    # Display fields
    organization_name: str | None = None
    lead_name: str | None = None
    deal_value: float | None = None
    probability: float | None = None
    currency: str = "BRL"
    expected_closure_date: date | None = None

    # Nested — only label + color needed for the kanban column / badge
    status: StatusEmbed

    # Owner — only name needed for the assigned-to avatar
    deal_owner: UserEmbed | None = None

    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Pagination wrapper
# ---------------------------------------------------------------------------


class PaginatedDeals(BaseModel):
    """Envelope for paginated deal list responses."""

    items: list[DealListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Action request bodies
# ---------------------------------------------------------------------------


class MarkLostRequest(BaseModel):
    """Body for POST /deals/{id}/lost."""

    reason_id: uuid.UUID = Field(..., description="FK to lost_reasons.id")
    notes: str | None = Field(None, max_length=2000, description="Optional freetext explanation")


class AssignRequest(BaseModel):
    """Body for POST /deals/{id}/assign."""

    assignee_id: uuid.UUID = Field(..., description="User to receive the deal")


class BulkDeleteRequest(BaseModel):
    """Body for POST /deals/bulk-delete."""

    ids: list[uuid.UUID] = Field(..., min_length=1, max_length=100)
