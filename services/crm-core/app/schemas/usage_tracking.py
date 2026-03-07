"""Pydantic v2 schemas for the UsageTracking resource.

Schema hierarchy:
  UsageTrackingResponse   — read-only representation of a single usage period record
  UsageTrackingListParams — validated query-string parameters for GET /usage
  CurrentUsageResponse    — snapshot of the current billing period counters
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.lead import PaginatedResponse as PaginatedResponse  # noqa: F401

__all__ = [
    "UsageTrackingResponse",
    "UsageTrackingListParams",
    "CurrentUsageResponse",
    "PaginatedResponse",
]


# ---------------------------------------------------------------------------
# UsageTrackingResponse — read-only representation
# ---------------------------------------------------------------------------


class UsageTrackingResponse(BaseModel):
    """Complete UsageTracking record for a single billing period.

    Usage records are written by a scheduled job — there are no create/update
    input schemas exposed via the API.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID

    # Billing period start (YYYY-MM-01 by convention)
    period: date

    # Counters accumulated during the period
    messages_count: int
    conversations_count: int
    active_users: int

    # Record timestamps
    created_at: datetime


# ---------------------------------------------------------------------------
# UsageTrackingListParams — validated query-string parameters
# ---------------------------------------------------------------------------


class UsageTrackingListParams(BaseModel):
    """Query-string parameters for GET /usage.

    FastAPI automatically populates a Depends(UsageTrackingListParams) from the
    query-string when the router uses a dependency function.
    """

    # Pagination
    page: int = Field(1, ge=1, description="1-based page number")
    page_size: int = Field(12, ge=1, le=60, description="Results per page — default 12 (one year)")

    # Date range filters
    start_date: date | None = Field(None, description="Inclusive start period (YYYY-MM-DD)")
    end_date: date | None = Field(None, description="Inclusive end period (YYYY-MM-DD)")

    @field_validator("end_date")
    @classmethod
    def end_must_be_after_start(cls, v: date | None, info: object) -> date | None:
        data = getattr(info, "data", {})
        start = data.get("start_date")
        if start is not None and v is not None and v < start:
            raise ValueError("end_date must be on or after start_date")
        return v


# ---------------------------------------------------------------------------
# CurrentUsageResponse — live counters for the active billing period
# ---------------------------------------------------------------------------


class CurrentUsageResponse(BaseModel):
    """Snapshot of usage counters for the current (in-progress) billing period.

    Returned by GET /usage/current — counters are computed in real time from the
    main tables rather than the pre-aggregated usage_tracking records.
    """

    # The billing period this snapshot covers (YYYY-MM-01)
    period: date

    # Live counters
    messages_count: int
    conversations_count: int
    active_users: int
