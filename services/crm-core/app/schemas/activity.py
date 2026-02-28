"""Pydantic v2 schemas for the unified Activity timeline.

ActivityItem is a normalised view over multiple source tables:
  - Note          -> type "note"
  - Task          -> type "task"
  - CallLog       -> type "call"
  - Comment       -> type "comment"
  - Communication -> type "email"
  - StatusChangeLog -> type "status_change"

The type discriminator lets frontend components render each item
with the correct icon and layout without further API calls.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Embedded user snippet (mirrors LeadOwnerEmbed without requiring its import)
# ---------------------------------------------------------------------------


class UserEmbed(BaseModel):
    """Minimal User projection embedded inside activity items."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    avatar_url: str | None = None


# ---------------------------------------------------------------------------
# ActivityItem
# ---------------------------------------------------------------------------

ActivityType = Literal[
    "email",
    "call",
    "note",
    "task",
    "comment",
    "status_change",
]


class ActivityItem(BaseModel):
    """A single entry in the unified CRM activity timeline.

    Fields:
      id           — source row PK
      type         — discriminator string; see ActivityType
      title        — short summary rendered as the headline
      content      — longer body text (note content, email subject, etc.)
      created_by   — author of the activity; None for automated events
      created_at   — timestamp used for chronological sorting
      metadata     — type-specific extras:
                       call       -> {duration, status, caller, receiver}
                       status_change -> {from_status, to_status}
                       task       -> {priority, status, due_date}
                       email      -> {comm_type, sender, recipients}
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: ActivityType
    title: str
    content: str | None = None
    created_by: UserEmbed | None = None
    created_at: datetime
    metadata: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# ActivityListResponse
# ---------------------------------------------------------------------------


class ActivityListResponse(BaseModel):
    """Paginated unified activity timeline response.

    Unlike PaginatedResponse[T], activities from multiple sources are merged
    and sorted before pagination, so we carry total_count separately.
    """

    data: list[ActivityItem]
    total_count: int
    page: int
    page_size: int
