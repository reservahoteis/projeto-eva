"""Pydantic v2 schemas for the Escalation resource.

Schema hierarchy:
  EscalationCreate     — input for POST /escalations
  EscalationUpdate     — input for PUT /escalations/{id}  (all fields optional)
  EscalationResponse   — full representation with nested user embed
  EscalationListParams — validated query-string parameters for GET /escalations
  EscalationStats      — aggregated escalation counts for dashboard widgets
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import UserBasic
from app.schemas.lead import PaginatedResponse as PaginatedResponse  # noqa: F401

__all__ = [
    "EscalationCreate",
    "EscalationUpdate",
    "EscalationResponse",
    "EscalationListParams",
    "EscalationStats",
    "PaginatedResponse",
]

# ---------------------------------------------------------------------------
# Allowed enum-like sets
# ---------------------------------------------------------------------------

_VALID_STATUSES = {"PENDING", "IN_PROGRESS", "RESOLVED", "CLOSED"}

# Valid fields for ordering
_ESCALATION_ORDERABLE_FIELDS = {
    "created_at",
    "updated_at",
    "status",
    "reason",
    "hotel_unit",
    "resolved_at",
}


# ---------------------------------------------------------------------------
# EscalationCreate
# ---------------------------------------------------------------------------


class EscalationCreate(BaseModel):
    """Fields accepted when creating a new Escalation via POST /escalations."""

    conversation_id: uuid.UUID
    reason: str = Field(..., min_length=1, max_length=500)
    hotel_unit: str | None = Field(None, max_length=100)
    ai_context: dict[str, Any] | None = Field(
        None,
        description="Snapshot of the AI conversation context at the moment of escalation",
    )


# ---------------------------------------------------------------------------
# EscalationUpdate
# ---------------------------------------------------------------------------


class EscalationUpdate(BaseModel):
    """All escalation fields made optional for partial updates via PUT /escalations/{id}."""

    status: str | None = None
    attended_by_id: uuid.UUID | None = None
    notes: str | None = Field(None, max_length=2000)

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


# ---------------------------------------------------------------------------
# EscalationResponse — full detail view
# ---------------------------------------------------------------------------


class EscalationResponse(BaseModel):
    """Complete Escalation representation returned from GET /escalations/{id}."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    conversation_id: uuid.UUID

    reason: str
    hotel_unit: str | None = None
    status: str

    # FK IDs retained for optimistic client updates
    attended_by_id: uuid.UUID | None = None

    ai_context: dict[str, Any] | None = None
    resolved_at: datetime | None = None
    notes: str | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    # Nested objects (populated via SQLAlchemy selectin relationships)
    attended_by: UserBasic | None = None


# ---------------------------------------------------------------------------
# EscalationListParams — validated query-string parameters
# ---------------------------------------------------------------------------


class EscalationListParams(BaseModel):
    """Query-string parameters for GET /escalations.

    FastAPI automatically populates a Depends(EscalationListParams) from the
    query-string when the router uses a dependency function.
    """

    # Pagination
    page: int = Field(1, ge=1, description="1-based page number")
    page_size: int = Field(20, ge=1, le=200, description="Results per page (max 200)")

    # Sorting
    order_by: str = Field(
        "created_at desc",
        description='Comma-separated sort tokens, e.g. "created_at desc,status asc"',
    )

    # Filters
    status: str | None = Field(None, description="Filter by escalation status")
    reason: str | None = Field(None, max_length=500, description="Substring filter on reason text")
    hotel_unit: str | None = Field(None, max_length=100, description="Filter by hotel unit")

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
            if field not in _ESCALATION_ORDERABLE_FIELDS:
                raise ValueError(
                    f"Field {field!r} is not orderable. "
                    f"Allowed: {sorted(_ESCALATION_ORDERABLE_FIELDS)}"
                )
            if direction not in ("asc", "desc"):
                raise ValueError(f"Direction must be 'asc' or 'desc', got {direction!r}")
        return v


# ---------------------------------------------------------------------------
# EscalationStats — aggregated dashboard counts
# ---------------------------------------------------------------------------


class EscalationStats(BaseModel):
    """Aggregated escalation counts for dashboard widgets."""

    total: int
    by_status: dict[str, int]
    by_reason: dict[str, int]
    avg_resolution_time_minutes: float | None = None
