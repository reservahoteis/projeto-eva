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
    "CamelModel",
    "UserBasic",
    "TagResponse",
    "PaginatedResponse",
]


# ---------------------------------------------------------------------------
# CamelModel — base class for schemas that use camelCase field aliases
# ---------------------------------------------------------------------------


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase."""
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


class CamelModel(BaseModel):
    """Base model that accepts and returns camelCase field names.

    Also accepts snake_case via populate_by_name=True so both conventions work.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


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
