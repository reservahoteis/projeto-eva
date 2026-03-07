"""Shared Pydantic v2 schemas used across multiple resources.

Exports:
  UserBasic        — minimal user projection for embedding (id/name/email/role)
  TagResponse      — re-exported from tag.py for convenience
  PaginatedResponse — re-exported from lead.py for convenience
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

# Re-export generic envelope so callers have a single import point
from app.schemas.lead import PaginatedResponse as PaginatedResponse  # noqa: F401

__all__ = [
    "UserBasic",
    "TagResponse",
    "PaginatedResponse",
]


# ---------------------------------------------------------------------------
# UserBasic — minimal user projection embedded in many responses
# ---------------------------------------------------------------------------


class UserBasic(BaseModel):
    """Minimal User projection used as a nested embed across multiple schemas.

    Provides just enough information for the UI to render an assigned-to chip
    (name, email, role badge) without pulling a full UserResponse payload.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    role: str


# ---------------------------------------------------------------------------
# TagResponse (canonical definition lives in tag.py — re-exported here)
# ---------------------------------------------------------------------------

from app.schemas.tag import TagResponse as TagResponse  # noqa: F401, E402
