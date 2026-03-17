"""Pydantic v2 schemas for the Service Level Agreement resource.

Schema hierarchy:
  SLAPriorityCreate    — input for a single priority tier (response/resolution minutes)
  ServiceDayCreate     — input for one business-day window within an SLA
  SLACreate            — top-level input for POST /sla (includes nested priorities + days)
  SLAUpdate            — partial update, all fields optional
  SLAPriorityResponse  — read representation of ServiceLevelPriority
  ServiceDayResponse   — read representation of ServiceDay
  SLAResponse          — full SLA with nested priorities and service_days
  SLAListItem          — lean projection for list views
"""

from __future__ import annotations

import uuid
from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ---------------------------------------------------------------------------
# Day abbreviation type
# ---------------------------------------------------------------------------

DayAbbreviation = Literal["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# ---------------------------------------------------------------------------
# SLAPriorityCreate
# ---------------------------------------------------------------------------


class SLAPriorityCreate(BaseModel):
    """Input for a single priority tier within an SLA."""

    priority: Literal["Low", "Medium", "High"] = Field(
        ...,
        description="Priority level this row applies to: Low | Medium | High",
    )
    response_time_minutes: int = Field(
        ...,
        gt=0,
        description="Maximum minutes before the first response must be sent (business-hours)",
    )
    resolution_time_minutes: int = Field(
        ...,
        gt=0,
        description="Maximum minutes before the issue must be resolved (business-hours)",
    )

    @field_validator("resolution_time_minutes")
    @classmethod
    def resolution_must_exceed_response(
        cls, v: int, info: object
    ) -> int:
        # Pydantic v2 info.data holds already-validated sibling fields.
        data = getattr(info, "data", {})
        response = data.get("response_time_minutes")
        if response is not None and v <= response:
            raise ValueError(
                "resolution_time_minutes must be greater than response_time_minutes"
            )
        return v


# ---------------------------------------------------------------------------
# ServiceDayCreate
# ---------------------------------------------------------------------------


class ServiceDayCreate(BaseModel):
    """Input for one business-day window within an SLA."""

    day: DayAbbreviation = Field(
        ...,
        description="Three-letter day abbreviation: Mon | Tue | Wed | Thu | Fri | Sat | Sun",
    )
    start_time: time = Field(
        ...,
        description="Business-hours start (e.g. 08:00)",
    )
    end_time: time = Field(
        ...,
        description="Business-hours end (e.g. 18:00). Must be after start_time.",
    )

    @field_validator("end_time")
    @classmethod
    def end_must_be_after_start(cls, v: time, info: object) -> time:
        data = getattr(info, "data", {})
        start = data.get("start_time")
        if start is not None and v <= start:
            raise ValueError("end_time must be after start_time")
        return v


# ---------------------------------------------------------------------------
# SLACreate
# ---------------------------------------------------------------------------


class SLACreate(BaseModel):
    """Fields accepted when creating a new SLA via POST /sla."""

    name: str = Field(..., min_length=1, max_length=255)
    applies_to: Literal["Lead", "Deal"] = Field(
        ...,
        description="Which doctype this SLA governs",
    )
    condition: str | None = Field(
        None,
        description=(
            "Optional Python/Jinja expression evaluated against a document to decide "
            "whether this SLA applies. Null means 'always applies'."
        ),
    )
    enabled: bool = Field(True, description="Whether this SLA is active")
    priorities: list[SLAPriorityCreate] = Field(
        ...,
        min_length=1,
        description="At least one priority tier is required",
    )
    service_days: list[ServiceDayCreate] = Field(
        ...,
        min_length=1,
        description="At least one business day is required",
    )

    @field_validator("priorities")
    @classmethod
    def no_duplicate_priorities(
        cls, v: list[SLAPriorityCreate]
    ) -> list[SLAPriorityCreate]:
        seen: set[str] = set()
        for p in v:
            if p.priority in seen:
                raise ValueError(
                    f"Duplicate priority level '{p.priority}' — each level must appear at most once"
                )
            seen.add(p.priority)
        return v

    @field_validator("service_days")
    @classmethod
    def no_duplicate_days(
        cls, v: list[ServiceDayCreate]
    ) -> list[ServiceDayCreate]:
        seen: set[str] = set()
        for d in v:
            if d.day in seen:
                raise ValueError(
                    f"Duplicate day '{d.day}' — each day must appear at most once"
                )
            seen.add(d.day)
        return v


# ---------------------------------------------------------------------------
# SLAUpdate
# ---------------------------------------------------------------------------


class SLAUpdate(BaseModel):
    """All SLA fields made optional for partial updates via PUT /sla/{id}.

    When priorities or service_days are provided they REPLACE the existing
    child rows entirely (full replace, not merge).  Pass None (or omit) to
    keep the existing children unchanged.
    """

    name: str | None = Field(None, min_length=1, max_length=255)
    applies_to: Literal["Lead", "Deal"] | None = None
    condition: str | None = None
    enabled: bool | None = None
    priorities: list[SLAPriorityCreate] | None = None
    service_days: list[ServiceDayCreate] | None = None

    @field_validator("priorities")
    @classmethod
    def no_duplicate_priorities(
        cls, v: list[SLAPriorityCreate] | None
    ) -> list[SLAPriorityCreate] | None:
        if v is None:
            return v
        seen: set[str] = set()
        for p in v:
            if p.priority in seen:
                raise ValueError(
                    f"Duplicate priority level '{p.priority}'"
                )
            seen.add(p.priority)
        return v

    @field_validator("service_days")
    @classmethod
    def no_duplicate_days(
        cls, v: list[ServiceDayCreate] | None
    ) -> list[ServiceDayCreate] | None:
        if v is None:
            return v
        seen: set[str] = set()
        for d in v:
            if d.day in seen:
                raise ValueError(f"Duplicate day '{d.day}'")
            seen.add(d.day)
        return v


# ---------------------------------------------------------------------------
# Read schemas (response shapes)
# ---------------------------------------------------------------------------


class SLAPriorityResponse(BaseModel):
    """Full representation of ServiceLevelPriority."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sla_id: uuid.UUID
    priority: str
    # Expose as plain minutes so the API contract never leaks SQLAlchemy
    # Interval objects or timedelta details.  The service layer converts
    # timedelta -> total_seconds -> minutes.
    response_time_minutes: int
    resolution_time_minutes: int


class ServiceDayResponse(BaseModel):
    """Full representation of ServiceDay."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sla_id: uuid.UUID
    day: str
    start_time: time
    end_time: time


class SLAResponse(BaseModel):
    """Complete SLA representation returned from detail / mutation endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    applies_to: str | None
    condition: str | None
    enabled: bool
    priorities: list[SLAPriorityResponse]
    service_days: list[ServiceDayResponse]
    created_at: datetime
    updated_at: datetime


class SLAListItem(BaseModel):
    """Lean projection used in the list endpoint."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    applies_to: str | None
    enabled: bool
    created_at: datetime
    updated_at: datetime
