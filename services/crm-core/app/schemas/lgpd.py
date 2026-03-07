"""Pydantic v2 schemas for LGPD compliance endpoints.

Schema hierarchy:
  ConsentUpdateRequest      -- input for consent grant/revoke
  DataExportResponse        -- full data export payload
  DataErasureResponse       -- result of data anonymisation
  RetentionCleanupResponse  -- result of automated retention cleanup
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# ConsentUpdateRequest
# ---------------------------------------------------------------------------


class ConsentUpdateRequest(BaseModel):
    """Optional metadata sent when granting or revoking consent."""

    ip_address: str | None = Field(
        None,
        max_length=45,
        description="IP address of the data subject at the time of consent action",
    )


# ---------------------------------------------------------------------------
# DataExportResponse
# ---------------------------------------------------------------------------


class DataExportResponse(BaseModel):
    """Full LGPD data portability export for a single contact."""

    model_config = ConfigDict(from_attributes=True)

    contact: dict[str, Any] = Field(
        ..., description="Contact profile data"
    )
    conversations: list[dict[str, Any]] = Field(
        default_factory=list, description="All conversations with this contact"
    )
    messages: list[dict[str, Any]] = Field(
        default_factory=list, description="All messages across conversations"
    )
    related_entities: dict[str, Any] = Field(
        default_factory=dict,
        description="Related leads and deals",
    )


# ---------------------------------------------------------------------------
# DataErasureResponse
# ---------------------------------------------------------------------------


class DataErasureResponse(BaseModel):
    """Result of a LGPD data erasure (anonymisation) operation."""

    contact_id: str = Field(..., description="UUID of the anonymised contact")
    erased_fields: list[str] = Field(
        ..., description="List of field names that were anonymised"
    )
    messages_redacted: int = Field(
        0, description="Number of messages whose content was redacted"
    )
    erased_at: datetime = Field(
        ..., description="Timestamp of the erasure operation"
    )


# ---------------------------------------------------------------------------
# RetentionCleanupResponse
# ---------------------------------------------------------------------------


class RetentionCleanupResponse(BaseModel):
    """Result of an automated retention-based cleanup run."""

    contacts_anonymized: int = Field(
        0, description="Number of contacts that were anonymised"
    )
    messages_redacted: int = Field(
        0, description="Total number of messages whose content was redacted"
    )
