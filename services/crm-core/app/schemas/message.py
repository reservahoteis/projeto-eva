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

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

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

    Accepts both snake_case and camelCase field names so the frontend can
    POST in its native camelCase format (populate_by_name=True keeps
    snake_case working for internal callers).
    """

    model_config = ConfigDict(populate_by_name=True)

    # conversation_id is optional here because it is usually supplied via the
    # URL path parameter in /conversations/{id}/messages, but accepting it in
    # the body as well (camelCase alias) improves compatibility with clients
    # that send a flat payload.
    conversation_id: uuid.UUID | None = Field(None, alias="conversationId")

    content: str | None = Field(None, max_length=4096, description="Text body of the message")
    type: str = Field("TEXT", max_length=50, description="Message type enum")
    metadata: dict[str, Any] | None = Field(None, description="Channel-specific metadata payload")

    # Media fields — stored in metadata_json on the DB model; surfaced here so
    # clients can POST media messages without building the metadata envelope.
    media_url: str | None = Field(None, alias="mediaUrl", description="Public URL of the media file")
    media_type: str | None = Field(None, alias="mediaType", description="MIME type of the media file")

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
    """Complete Message representation returned by read endpoints.

    Exposes both snake_case fields (for internal / server-to-server consumers)
    and camelCase computed_fields (for the Next.js frontend).  The computed
    fields are derived from their snake_case counterparts so there is no
    duplication of data.
    """

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

    # Media fields — not DB columns; extracted from metadata_json automatically
    # via model_validator below.
    media_url: str | None = None
    media_type: str | None = None

    # Delivery state
    status: str
    error_info: str | None = None

    # Display name of the sender (contact name for inbound, user name for outbound)
    sender_name: str | None = None

    # Timestamps
    timestamp: datetime
    created_at: datetime

    @model_validator(mode="after")
    def _extract_media_from_metadata(self) -> "MessageResponse":
        """Auto-populate media_url and media_type from metadata_json.

        The Express backend stores media info inside metadata_json (JSONB)
        rather than in dedicated columns.  This validator ensures the
        computed camelCase fields (mediaUrl, mediaType) always reflect
        what is in the DB.
        """
        meta = self.metadata_json
        if meta and isinstance(meta, dict):
            if not self.media_url:
                self.media_url = meta.get("mediaUrl")
            if not self.media_type:
                self.media_type = meta.get("mimeType")
        return self

    # ------------------------------------------------------------------
    # camelCase computed fields — consumed by the Next.js frontend
    # ------------------------------------------------------------------

    @computed_field  # type: ignore[misc]
    @property
    def conversationId(self) -> str:
        return str(self.conversation_id)

    @computed_field  # type: ignore[misc]
    @property
    def tenantId(self) -> str:
        return str(self.tenant_id)

    @computed_field  # type: ignore[misc]
    @property
    def externalMessageId(self) -> str | None:
        return self.external_message_id

    @computed_field  # type: ignore[misc]
    @property
    def createdAt(self) -> str | None:
        return self.created_at.isoformat() if self.created_at else None

    @computed_field  # type: ignore[misc]
    @property
    def updatedAt(self) -> str | None:
        # Message model has no separate updated_at column; mirror created_at
        # so the frontend contract is satisfied.
        return self.created_at.isoformat() if self.created_at else None

    @computed_field  # type: ignore[misc]
    @property
    def mediaUrl(self) -> str | None:
        return self.media_url

    @computed_field  # type: ignore[misc]
    @property
    def mediaType(self) -> str | None:
        return self.media_type

    @computed_field  # type: ignore[misc]
    @property
    def metadata(self) -> dict[str, Any] | None:
        """Expose metadata_json as 'metadata' for frontend compatibility."""
        return self.metadata_json


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
    """Envelope for cursor-paginated message list responses.

    Internally uses cursor-based pagination for stable ordering, but also
    exposes a `pagination` computed_field in the format expected by the
    legacy frontend (`{ page, limit, total, totalPages }`).
    """

    data: list[MessageResponse]
    next_cursor: str | None = Field(
        None,
        description="Pass this value as `cursor` in the next request to load the previous page",
    )
    has_more: bool
    total: int = Field(
        0,
        description="Total number of messages in the conversation (used for pagination compat)",
    )

    @computed_field  # type: ignore[misc]
    @property
    def pagination(self) -> dict[str, int]:
        """Compatibility shim for the frontend's PaginatedResponse format.

        The frontend expects { page, limit, total, totalPages }.  Because this
        endpoint uses cursor-based pagination rather than offset pages, `page`
        is always 1 and `totalPages` is always 1 — the frontend should use
        `has_more` / `next_cursor` for actual navigation.
        """
        limit = len(self.data)
        return {
            "page": 1,
            "limit": limit,
            "total": self.total,
            "totalPages": 1,
        }


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
