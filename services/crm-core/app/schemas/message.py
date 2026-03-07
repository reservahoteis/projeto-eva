"""Pydantic v2 schemas for the Message resource.

Schema hierarchy:
  MessageCreate          — input for POST /conversations/{id}/messages
  MessageResponse        — full representation returned from GET /messages/{id}
  MessageListParams      — cursor-based pagination parameters for GET /messages
  MessageCursorResponse  — envelope for cursor-paginated message lists
  MessageStats           — aggregated message counts
  SendTemplateRequest    — body for POST /conversations/{id}/send-template
  SendButtonsRequest     — body for POST /conversations/{id}/send-buttons
  SendListRequest        — body for POST /conversations/{id}/send-list
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

__all__ = [
    "MessageCreate",
    "MessageResponse",
    "MessageListParams",
    "MessageCursorResponse",
    "MessageStats",
    "SendTemplateRequest",
    "SendButtonsRequest",
    "SendListRequest",
    "IaLockRequest",
]

# ---------------------------------------------------------------------------
# Allowed enum-like sets
# ---------------------------------------------------------------------------

_VALID_TYPES = {
    "TEXT",
    "IMAGE",
    "VIDEO",
    "AUDIO",
    "DOCUMENT",
    "STICKER",
    "LOCATION",
    "CONTACTS",
    "INTERACTIVE",
    "TEMPLATE",
    "REACTION",
    "SYSTEM",
}
_VALID_DIRECTIONS = {"INBOUND", "OUTBOUND"}
_VALID_STATUSES = {"PENDING", "SENT", "DELIVERED", "READ", "FAILED"}


# ---------------------------------------------------------------------------
# MessageCreate
# ---------------------------------------------------------------------------


class MessageCreate(BaseModel):
    """Fields accepted when creating a new outbound Message.

    For inbound messages created by the webhook worker the service layer
    constructs the record directly without going through this schema.
    """

    content: str | None = Field(None, max_length=4096, description="Text body of the message")
    type: str = Field("TEXT", max_length=50, description="Message type enum")
    metadata: dict[str, Any] | None = Field(None, description="Channel-specific metadata payload")

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        normalised = v.upper()
        if normalised not in _VALID_TYPES:
            raise ValueError(
                f"type {v!r} is not supported. Allowed: {sorted(_VALID_TYPES)}"
            )
        return normalised


# ---------------------------------------------------------------------------
# MessageResponse — full detail view
# ---------------------------------------------------------------------------


class MessageResponse(BaseModel):
    """Complete Message representation returned by read endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    conversation_id: uuid.UUID

    # External channel reference (e.g. WhatsApp message ID)
    external_message_id: str | None = None

    # Directionality and type
    direction: str
    type: str
    content: str | None = None

    # Channel-specific data stored as JSONB in the DB
    metadata_json: dict[str, Any] | None = None

    # Delivery state
    status: str
    error_info: str | None = None

    # Display name of the sender (contact name for inbound, user name for outbound)
    sender_name: str | None = None

    # Timestamps
    timestamp: datetime
    created_at: datetime


# ---------------------------------------------------------------------------
# MessageListParams — cursor-based pagination
# ---------------------------------------------------------------------------


class MessageListParams(BaseModel):
    """Query-string parameters for GET /conversations/{id}/messages.

    Uses cursor-based pagination (by message ID) rather than offset pagination
    to guarantee stable ordering when new messages arrive during scrollback.
    """

    cursor: str | None = Field(
        None,
        description="Opaque cursor (last seen message UUID). Omit to get the most recent page.",
    )
    limit: int = Field(50, ge=1, le=100, description="Number of messages per page (max 100)")
    direction: str | None = Field(
        None,
        description="Filter by direction: INBOUND or OUTBOUND",
    )

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v: str | None) -> str | None:
        if v is None:
            return v
        normalised = v.upper()
        if normalised not in _VALID_DIRECTIONS:
            raise ValueError(
                f"direction {v!r} is not valid. Allowed: {sorted(_VALID_DIRECTIONS)}"
            )
        return normalised


# ---------------------------------------------------------------------------
# MessageCursorResponse — cursor-paginated envelope
# ---------------------------------------------------------------------------


class MessageCursorResponse(BaseModel):
    """Envelope for cursor-paginated message list responses."""

    data: list[MessageResponse]
    next_cursor: str | None = Field(
        None,
        description="Pass this value as `cursor` in the next request to load the previous page",
    )
    has_more: bool


# ---------------------------------------------------------------------------
# MessageStats — aggregated counts
# ---------------------------------------------------------------------------


class MessageStats(BaseModel):
    """Aggregated message counts for a conversation or tenant-wide report."""

    total: int
    inbound: int
    outbound: int
    by_type: dict[str, int]
    by_status: dict[str, int]


# ---------------------------------------------------------------------------
# Rich-send request bodies
# ---------------------------------------------------------------------------


class SendTemplateRequest(BaseModel):
    """Body for POST /conversations/{id}/send-template.

    Sends a pre-approved WhatsApp message template.
    """

    template_name: str = Field(..., min_length=1, max_length=512)
    language: str = Field("pt_BR", max_length=10, description="BCP-47 language tag of the template")
    components: list[dict[str, Any]] | None = Field(
        None,
        description="Template component substitutions (header, body, buttons)",
    )


class SendButtonsRequest(BaseModel):
    """Body for POST /conversations/{id}/send-buttons.

    Sends an interactive message with up to three quick-reply buttons.
    """

    body: str = Field(..., min_length=1, max_length=1024, description="Main message body text")
    buttons: list[dict[str, Any]] = Field(
        ...,
        min_length=1,
        max_length=3,
        description="Button definitions — max 3 allowed by WhatsApp",
    )
    header: str | None = Field(None, max_length=60, description="Optional header text")
    footer: str | None = Field(None, max_length=60, description="Optional footer text")


class SendListRequest(BaseModel):
    """Body for POST /conversations/{id}/send-list.

    Sends an interactive list message with grouped option rows.
    """

    body: str = Field(..., min_length=1, max_length=1024, description="Main message body text")
    button_text: str = Field(..., min_length=1, max_length=20, description="Label on the list-open button")
    sections: list[dict[str, Any]] = Field(
        ...,
        min_length=1,
        description="Section definitions — each section has a title and up to 10 rows",
    )
    header: str | None = Field(None, max_length=60, description="Optional header text")
    footer: str | None = Field(None, max_length=60, description="Optional footer text")


class IaLockRequest(BaseModel):
    """Body for PATCH /conversations/{id}/ia-lock.

    Controls whether the AI is allowed to respond to incoming messages
    for this conversation.
    """

    locked: bool = Field(..., description="True to lock out the AI; False to re-enable it")
