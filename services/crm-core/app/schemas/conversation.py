"""Pydantic v2 schemas for the Conversation resource.

Schema hierarchy:
  ConversationCreate       — input for POST /conversations
  ConversationUpdate       — input for PUT /conversations/{id}  (all fields optional)
  ConversationResponse     — full representation with nested contact/user/tags
  ConversationListItem     — lightweight projection for list views
  ConversationListParams   — validated query-string parameters for GET /conversations
  ConversationStats        — aggregated counts for dashboard widgets
  AssignConversationRequest — body for POST /conversations/{id}/assign
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import TagResponse, UserBasic
from app.schemas.contact import ContactListItem
from app.schemas.lead import PaginatedResponse as PaginatedResponse  # noqa: F401

__all__ = [
    "ConversationCreate",
    "ConversationUpdate",
    "ConversationResponse",
    "ConversationListItem",
    "ConversationListParams",
    "ConversationStats",
    "AssignConversationRequest",
    "PaginatedResponse",
]

# ---------------------------------------------------------------------------
# Allowed enum-like sets — used in field validators to prevent invalid values
# ---------------------------------------------------------------------------

_VALID_STATUSES = {"OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"}
_VALID_PRIORITIES = {"LOW", "NORMAL", "HIGH", "URGENT"}
_VALID_CHANNELS = {"WHATSAPP", "INSTAGRAM", "MESSENGER", "WEBCHAT", "EMAIL", "PHONE"}

# Valid fields for ordering — prevents SQL injection via ORDER BY
_CONVERSATION_ORDERABLE_FIELDS = {
    "created_at",
    "updated_at",
    "last_message_at",
    "status",
    "priority",
    "channel",
    "hotel_unit",
}


# ---------------------------------------------------------------------------
# ConversationCreate
# ---------------------------------------------------------------------------


class ConversationCreate(BaseModel):
    """Fields accepted when creating a new Conversation via POST /conversations."""

    contact_id: uuid.UUID | None = None
    channel: str = Field("WHATSAPP", max_length=50)
    hotel_unit: str | None = Field(None, max_length=100)
    source: str | None = Field(None, max_length=100)
    metadata: dict[str, Any] | None = None

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v: str) -> str:
        normalised = v.upper()
        if normalised not in _VALID_CHANNELS:
            raise ValueError(
                f"channel {v!r} is not supported. Allowed: {sorted(_VALID_CHANNELS)}"
            )
        return normalised


# ---------------------------------------------------------------------------
# ConversationUpdate
# ---------------------------------------------------------------------------


class ConversationUpdate(BaseModel):
    """All conversation fields made optional for partial updates via PUT /conversations/{id}."""

    status: str | None = None
    priority: str | None = None
    assigned_to_id: uuid.UUID | None = None
    hotel_unit: str | None = Field(None, max_length=100)
    ia_locked: bool | None = None
    is_opportunity: bool | None = None
    metadata: dict[str, Any] | None = None

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

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str | None) -> str | None:
        if v is None:
            return v
        normalised = v.upper()
        if normalised not in _VALID_PRIORITIES:
            raise ValueError(
                f"priority {v!r} is not valid. Allowed: {sorted(_VALID_PRIORITIES)}"
            )
        return normalised


# ---------------------------------------------------------------------------
# ConversationResponse — full detail view
# ---------------------------------------------------------------------------


class ConversationResponse(BaseModel):
    """Complete Conversation representation returned from GET /conversations/{id}."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID

    # Associations — raw FK IDs retained for optimistic client updates
    contact_id: uuid.UUID | None = None
    assigned_to_id: uuid.UUID | None = None

    # State
    status: str
    priority: str
    channel: str

    # Hotel context
    hotel_unit: str | None = None

    # AI control
    ia_locked: bool
    is_opportunity: bool

    # Timeline
    last_message_at: datetime | None = None
    source: str | None = None
    created_at: datetime
    updated_at: datetime

    # Nested objects (populated via SQLAlchemy selectin relationships)
    contact: ContactListItem | None = None
    assigned_to: UserBasic | None = None
    tags: list[TagResponse] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# ConversationListItem — lightweight projection for list views
# ---------------------------------------------------------------------------


class ConversationListItem(BaseModel):
    """Lean Conversation projection for paginated list views.

    Includes a short content snippet from the last message so the list UI
    can render a preview row without a separate message query.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID

    contact_id: uuid.UUID | None = None
    assigned_to_id: uuid.UUID | None = None

    status: str
    priority: str
    channel: str
    hotel_unit: str | None = None

    ia_locked: bool
    is_opportunity: bool

    last_message_at: datetime | None = None

    # Short preview from the most recent message (populated by the service layer)
    last_message_preview: str | None = None

    created_at: datetime
    updated_at: datetime

    # Nested mini embeds — kept lean for list performance
    contact: ContactListItem | None = None
    assigned_to: UserBasic | None = None
    tags: list[TagResponse] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# ConversationListParams — validated query-string parameters
# ---------------------------------------------------------------------------


class ConversationListParams(BaseModel):
    """Query-string parameters for GET /conversations.

    FastAPI automatically populates a Depends(ConversationListParams) from the
    query-string when the router uses a dependency function.
    """

    # Pagination
    page: int = Field(1, ge=1, description="1-based page number")
    page_size: int = Field(20, ge=1, le=200, description="Results per page (max 200)")

    # Sorting
    order_by: str = Field(
        "last_message_at desc",
        description='Comma-separated sort tokens, e.g. "last_message_at desc,status asc"',
    )

    # Full-text search
    search: str | None = Field(None, max_length=200, description="Search across contact name/phone/channel")

    # Filters
    status: str | None = Field(None, description="Filter by conversation status")
    priority: str | None = Field(None, description="Filter by priority level")
    channel: str | None = Field(None, description="Filter by messaging channel")
    assigned_to_id: uuid.UUID | None = Field(None, description="Filter by assigned user")
    hotel_unit: str | None = Field(None, max_length=100, description="Filter by hotel unit")
    is_opportunity: bool | None = Field(None, description="Filter to opportunity conversations only")
    ia_locked: bool | None = Field(None, description="Filter by AI lock state")

    # Arbitrary filter dict — keys are Conversation column names
    filters: dict[str, Any] | None = Field(
        None,
        description="JSON dict of field->value filters",
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
            if field not in _CONVERSATION_ORDERABLE_FIELDS:
                raise ValueError(
                    f"Field {field!r} is not orderable. "
                    f"Allowed: {sorted(_CONVERSATION_ORDERABLE_FIELDS)}"
                )
            if direction not in ("asc", "desc"):
                raise ValueError(f"Direction must be 'asc' or 'desc', got {direction!r}")
        return v


# ---------------------------------------------------------------------------
# ConversationStats — aggregated dashboard counts
# ---------------------------------------------------------------------------


class ConversationStats(BaseModel):
    """Aggregated conversation counts for dashboard widgets."""

    total: int
    by_status: dict[str, int]
    by_channel: dict[str, int]
    by_priority: dict[str, int]
    unassigned: int


# ---------------------------------------------------------------------------
# AssignConversationRequest
# ---------------------------------------------------------------------------


class AssignConversationRequest(BaseModel):
    """Body for POST /conversations/{id}/assign."""

    assigned_to_id: uuid.UUID = Field(..., description="UUID of the user to assign the conversation to")
