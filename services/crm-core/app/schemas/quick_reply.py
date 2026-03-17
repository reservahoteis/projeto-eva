"""Pydantic v2 schemas for the QuickReply resource.

Schema hierarchy:
  QuickReplyCreate      — input for POST /quick-replies
  QuickReplyUpdate      — input for PATCH /quick-replies/{id}  (all fields optional)
  QuickReplyResponse    — full representation returned from GET /quick-replies/{id}
  QuickReplyListItem    — lightweight projection used in list views
  QuickReplyListParams  — validated query-string parameters for GET /quick-replies

Quick replies are tenant-scoped canned responses that attendants can trigger
by typing a shortcut (e.g. "/greeting").  Shortcuts must be unique per tenant.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import CamelModel

from app.schemas.lead import PaginatedResponse
from app.schemas.task import UserEmbed  # reuse the same minimal User embed

__all__ = [
    "QuickReplyCreate",
    "QuickReplyUpdate",
    "QuickReplyResponse",
    "QuickReplyListItem",
    "QuickReplyListParams",
    "PaginatedResponse",
    "UserEmbed",
]

# ---------------------------------------------------------------------------
# Shortcut validation helper
# ---------------------------------------------------------------------------

# Shortcuts are lowercase slugs: letters, digits, and hyphens only.
# Min 2 chars prevents single-char collisions; max 50 keeps DB index tight.
_SHORTCUT_PATTERN = r"^[a-z0-9-]+$"


# ---------------------------------------------------------------------------
# QuickReplyCreate
# ---------------------------------------------------------------------------


class QuickReplyCreate(BaseModel):
    """Fields accepted when creating a new QuickReply via POST /quick-replies."""

    title: str = Field(..., min_length=1, max_length=100)
    shortcut: str = Field(
        ...,
        min_length=2,
        max_length=50,
        pattern=_SHORTCUT_PATTERN,
        description="Lowercase slug, e.g. 'greeting' or 'check-in'.  Must be unique per tenant.",
    )
    content: str = Field(..., min_length=1, max_length=4000)
    category: str | None = Field(None, max_length=50)
    order: int = Field(0, ge=0, description="Display order — lower values appear first")


# ---------------------------------------------------------------------------
# QuickReplyUpdate
# ---------------------------------------------------------------------------


class QuickReplyUpdate(BaseModel):
    """All QuickReplyCreate fields made optional for partial updates via PATCH /quick-replies/{id}."""

    title: str | None = Field(None, min_length=1, max_length=100)
    shortcut: str | None = Field(
        None,
        min_length=2,
        max_length=50,
        pattern=_SHORTCUT_PATTERN,
    )
    content: str | None = Field(None, min_length=1, max_length=4000)
    category: str | None = Field(None, max_length=50)
    order: int | None = Field(None, ge=0)
    is_active: bool | None = None

    @field_validator("shortcut")
    @classmethod
    def strip_shortcut(cls, v: str | None) -> str | None:
        """Normalise to lowercase so callers are not tripped up by casing."""
        return v.lower() if v is not None else v


# ---------------------------------------------------------------------------
# QuickReplyResponse — full detail view
# ---------------------------------------------------------------------------


class QuickReplyResponse(CamelModel):
    """Complete QuickReply representation returned from GET /quick-replies/{id}."""

    id: uuid.UUID

    title: str
    shortcut: str
    content: str
    category: str | None = None
    order: int
    is_active: bool

    # Nested author embed (populated via SQLAlchemy selectin relationship)
    created_by: UserEmbed | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# QuickReplyListItem — lightweight projection for list views
# ---------------------------------------------------------------------------


class QuickReplyListItem(BaseModel):
    """Lean QuickReply projection used in list responses.

    The full content field is included here because attendants need it to
    render the preview card in the picker UI without fetching the detail endpoint.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    shortcut: str
    content: str
    category: str | None = None
    order: int
    is_active: bool

    # Compact author info
    created_by: UserEmbed | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# QuickReplyListParams — validated query-string parameters
# ---------------------------------------------------------------------------


class QuickReplyListParams(BaseModel):
    """Query-string parameters for GET /quick-replies.

    The most common usage pattern is:
      GET /quick-replies                        — all active replies for tenant
      GET /quick-replies?search=greet           — full-text search
      GET /quick-replies?category=onboarding    — filter by category
      GET /quick-replies?is_active=false        — list disabled replies (admin)
    """

    # Pagination
    page: int = Field(1, ge=1, description="1-based page number")
    page_size: int = Field(20, ge=1, le=200, description="Results per page (max 200)")

    # Full-text search — matches against title, shortcut, and content (ilike)
    search: str | None = Field(None, max_length=100, description="ILIKE search across title, shortcut, content")

    # Category filter
    category: str | None = Field(None, max_length=50)

    # Active filter — omit to return all, pass true/false to filter
    is_active: bool | None = None
