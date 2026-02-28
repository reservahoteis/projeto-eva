"""Pydantic v2 schemas for the CallLog resource.

Schema hierarchy:
  CallLogCreate     — input for POST /call-logs
  CallLogUpdate     — input for PUT /call-logs/{id}  (all fields optional)
  CallLogResponse   — full representation returned from GET /call-logs/{id}
  CallLogListItem   — lightweight projection used in list views
  CallLogListParams — validated query-string parameters for GET /call-logs

CallLogs are polymorphic — they reference any CRM entity via
reference_doctype + reference_docname (Lead | Deal | Contact).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.lead import PaginatedResponse  # noqa: F401 — re-exported


# ---------------------------------------------------------------------------
# Type aliases for allowed enum values
# ---------------------------------------------------------------------------

CallType = Literal["Incoming", "Outgoing", "Missed"]

CallStatus = Literal[
    "Ringing",
    "In Progress",
    "Completed",
    "Failed",
    "Busy",
    "No Answer",
    "Queued",
    "Canceled",
    "Unknown",
]

TelephonyMedium = Literal["Manual", "Twilio"]

ReferenceDoctype = Literal["Lead", "Deal", "Contact"]


# ---------------------------------------------------------------------------
# CallLogCreate
# ---------------------------------------------------------------------------


class CallLogCreate(BaseModel):
    """Fields accepted when creating a new CallLog via POST /call-logs."""

    # Required parties
    caller: str = Field(..., min_length=1, max_length=100)
    receiver: str = Field(..., min_length=1, max_length=100)

    # Classification
    type: CallType | None = None
    status: CallStatus | None = None

    # Metrics
    duration: int | None = Field(None, ge=0, description="Duration in seconds")

    # Timeline
    start_time: datetime | None = None
    end_time: datetime | None = None

    # Recording and notes
    recording_url: str | None = Field(None, max_length=500)
    note: str | None = None

    # Channel — defaults to Manual when not provided
    telephony_medium: TelephonyMedium = Field(
        "Manual",
        description="Manual | Twilio",
    )

    # Polymorphic reference
    reference_doctype: ReferenceDoctype | None = Field(
        None,
        description="Lead | Deal | Contact",
    )
    reference_docname: uuid.UUID | None = Field(
        None,
        description="PK of the referenced CRM document",
    )


# ---------------------------------------------------------------------------
# CallLogUpdate
# ---------------------------------------------------------------------------


class CallLogUpdate(BaseModel):
    """All fields from CallLogCreate made optional for partial updates."""

    caller: str | None = Field(None, min_length=1, max_length=100)
    receiver: str | None = Field(None, min_length=1, max_length=100)

    type: CallType | None = None
    status: CallStatus | None = None

    duration: int | None = Field(None, ge=0)

    start_time: datetime | None = None
    end_time: datetime | None = None

    recording_url: str | None = Field(None, max_length=500)
    note: str | None = None

    telephony_medium: TelephonyMedium | None = None

    reference_doctype: ReferenceDoctype | None = None
    reference_docname: uuid.UUID | None = None


# ---------------------------------------------------------------------------
# CallLogResponse — full detail view
# ---------------------------------------------------------------------------


class CallLogResponse(BaseModel):
    """Complete CallLog representation returned from GET /call-logs/{id}."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID

    # Parties
    caller: str
    receiver: str

    # Classification
    type: str | None = None
    status: str | None = None

    # Metrics
    duration: int | None = None

    # Timeline
    start_time: datetime | None = None
    end_time: datetime | None = None

    # Recording and notes
    recording_url: str | None = None
    note: str | None = None

    # Channel
    telephony_medium: str

    # Polymorphic reference
    reference_doctype: str | None = None
    reference_docname: uuid.UUID | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# CallLogListItem — lean projection for list views
# ---------------------------------------------------------------------------


class CallLogListItem(BaseModel):
    """Lean CallLog projection for list views.

    Excludes heavy text fields (note, recording_url) to keep payloads small.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    caller: str
    receiver: str
    type: str | None = None
    status: str | None = None
    duration: int | None = None
    start_time: datetime | None = None
    telephony_medium: str
    reference_doctype: str | None = None
    reference_docname: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# CallLogListParams — validated query-string parameters
# ---------------------------------------------------------------------------


class CallLogListParams(BaseModel):
    """Query-string parameters for GET /call-logs."""

    # Pagination
    page: int = Field(1, ge=1, description="1-based page number")
    page_size: int = Field(20, ge=1, le=200, description="Results per page (max 200)")

    # Filters
    type: CallType | None = Field(None, description="Incoming | Outgoing | Missed")
    status: CallStatus | None = Field(None, description="Filter by call status")
    reference_doctype: ReferenceDoctype | None = Field(
        None,
        description="Filter by referenced document type: Lead | Deal | Contact",
    )
    reference_docname: uuid.UUID | None = Field(
        None,
        description="Filter by referenced document PK",
    )
