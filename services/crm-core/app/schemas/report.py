"""Pydantic v2 schemas for reporting endpoints.

Schema hierarchy:
  ReportQuery              — shared query parameters (date range + hotel unit filter)
  ReportPeriodQuery        — lightweight period-string query param (7d|30d|90d|1y)
  OverviewReport           — tenant-level summary of conversations, messages, escalations
  OverviewMetrics          — inner metrics block returned by ReportService.get_overview
  StatusBreakdownItem      — single status row in the overview breakdown
  OverviewReportV2         — full response from ReportService.get_overview
  AttendantPerformance     — per-user performance metrics (legacy schema)
  AttendantPerformanceV2   — full per-user performance from ReportService
  HourlyVolumeItem         — single hour bucket in hourly volume
  BusinessHoursMetrics     — inside/outside business hours aggregation
  HourlyVolumeReport       — full response from ReportService.get_hourly_volume
  HourlyVolume             — message/conversation volume broken down by hour-of-day
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from pydantic import BaseModel, Field, field_validator

__all__ = [
    "ReportQuery",
    "ReportPeriodQuery",
    "OverviewReport",
    "OverviewMetrics",
    "StatusBreakdownItem",
    "OverviewReportV2",
    "AttendantPerformance",
    "AttendantPerformanceV2",
    "HourlyVolumeItem",
    "BusinessHoursMetrics",
    "HourlyVolumeReport",
    "HourlyVolume",
]

_VALID_PERIODS = {"7d", "30d", "90d", "1y"}


# ---------------------------------------------------------------------------
# ReportPeriodQuery — lightweight period-string input
# ---------------------------------------------------------------------------


class ReportPeriodQuery(BaseModel):
    """Query parameter for report endpoints that accept a period string.

    Used by GET /reports/overview, GET /reports/attendants, and
    GET /reports/hourly-volume when the caller prefers a named period
    over explicit start_date / end_date values.
    """

    period: str = Field(
        "30d",
        description="Reporting window: 7d | 30d | 90d | 1y",
    )

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        if v not in _VALID_PERIODS:
            raise ValueError(
                f"period {v!r} is not valid. Allowed: {sorted(_VALID_PERIODS)}"
            )
        return v


# ---------------------------------------------------------------------------
# ReportQuery — shared input for all report endpoints
# ---------------------------------------------------------------------------


class ReportQuery(BaseModel):
    """Common query parameters accepted by all report endpoints.

    Passed as query-string params via FastAPI Depends.
    """

    start_date: date = Field(..., description="Inclusive start of the reporting window (YYYY-MM-DD)")
    end_date: date = Field(..., description="Inclusive end of the reporting window (YYYY-MM-DD)")
    hotel_unit: str | None = Field(None, max_length=100, description="Restrict report to a single hotel unit")

    @field_validator("end_date")
    @classmethod
    def end_must_be_after_start(cls, v: date, info: object) -> date:
        # info.data is available in Pydantic v2 FieldValidationInfo
        data = getattr(info, "data", {})
        start = data.get("start_date")
        if start is not None and v < start:
            raise ValueError("end_date must be on or after start_date")
        return v


# ---------------------------------------------------------------------------
# OverviewReport
# ---------------------------------------------------------------------------


class OverviewReport(BaseModel):
    """Tenant-level summary returned by GET /reports/overview."""

    total_conversations: int
    total_messages: int
    new_contacts: int
    escalations: int
    avg_response_time_minutes: float | None = None
    conversations_by_status: dict[str, int]
    conversations_by_channel: dict[str, int]


# ---------------------------------------------------------------------------
# AttendantPerformance
# ---------------------------------------------------------------------------


class AttendantPerformance(BaseModel):
    """Per-user performance metrics returned by GET /reports/attendants."""

    user_id: uuid.UUID
    name: str
    conversations_handled: int
    messages_sent: int
    avg_response_time_minutes: float | None = None
    escalations_resolved: int


# ---------------------------------------------------------------------------
# HourlyVolume
# ---------------------------------------------------------------------------


class HourlyVolume(BaseModel):
    """Message and conversation volume for a single hour of the day (0–23).

    Returned as a list of 24 items by GET /reports/hourly-volume.
    """

    hour: int = Field(..., ge=0, le=23, description="Hour of day in UTC (0–23)")
    messages_count: int
    conversations_count: int


# ---------------------------------------------------------------------------
# OverviewMetrics / StatusBreakdownItem / OverviewReportV2
# — match the dict returned by ReportService.get_overview()
# ---------------------------------------------------------------------------


class StatusBreakdownItem(BaseModel):
    """Single status row in the conversation overview breakdown."""

    status: str
    count: int
    percentage: float


class OverviewMetrics(BaseModel):
    """Top-level metrics block inside OverviewReportV2."""

    total_conversations: int
    change_pct_vs_previous_period: float | None = None
    active_attendants: int
    avg_response_time_minutes: float | None = None
    resolution_rate: float
    unread_messages: int


class OverviewReportV2(BaseModel):
    """Full response envelope from GET /reports/overview (ReportService)."""

    overview: OverviewMetrics
    statusBreakdown: list[StatusBreakdownItem]


# ---------------------------------------------------------------------------
# AttendantPerformanceV2
# — matches the dicts returned by ReportService.get_attendants_performance()
# ---------------------------------------------------------------------------


class AttendantPerformanceV2(BaseModel):
    """Per-attendant performance record returned by ReportService."""

    user_id: uuid.UUID
    name: str
    email: str
    role: str
    conversations_assigned: int
    conversations_closed: int
    satisfaction_rate: float


# ---------------------------------------------------------------------------
# HourlyVolumeItem / BusinessHoursMetrics / HourlyVolumeReport
# — match the dict returned by ReportService.get_hourly_volume()
# ---------------------------------------------------------------------------


class HourlyVolumeItem(BaseModel):
    """Single hour bucket in the hourly volume breakdown."""

    hour: int = Field(..., ge=0, le=23, description="Hour of day in Brazil time (UTC-3), 0–23")
    count: int


class BusinessHoursMetrics(BaseModel):
    """Aggregated inside / outside business hours (08:00–18:00 Brazil time)."""

    inside_count: int
    outside_count: int
    outside_percentage: float


class HourlyVolumeReport(BaseModel):
    """Full response envelope from GET /reports/hourly-volume (ReportService)."""

    hourly_volume: list[HourlyVolumeItem]
    business_hours_metrics: BusinessHoursMetrics
