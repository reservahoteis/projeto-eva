"""Pydantic v2 schemas for the Tag resource.

Schema hierarchy:
  TagCreate     — input for POST /tags
  TagUpdate     — input for PATCH /tags/{id}  (all fields optional)
  TagResponse   — full representation returned from GET /tags/{id}
  TagListItem   — lightweight projection used in list views
  TagListParams — validated query-string parameters for GET /tags

Tags are tenant-scoped labels used to categorise CRM entities.
Names are unique per tenant (enforced at DB level via uq_tags_tenant_name).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.lead import PaginatedResponse

__all__ = [
    "TagCreate",
    "TagUpdate",
    "TagResponse",
    "TagListItem",
    "TagListParams",
    "PaginatedResponse",
]

# ---------------------------------------------------------------------------
# TagCreate
# ---------------------------------------------------------------------------


class TagCreate(BaseModel):
    """Fields accepted when creating a new Tag via POST /tags."""

    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field(
        "#6B7280",
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Hex color code, e.g. #6B7280",
    )


# ---------------------------------------------------------------------------
# TagUpdate
# ---------------------------------------------------------------------------


class TagUpdate(BaseModel):
    """Partial update payload for PATCH /tags/{id}.

    All fields are optional — only non-None values are applied.
    """

    name: str | None = Field(None, min_length=1, max_length=50)
    color: str | None = Field(
        None,
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Hex color code, e.g. #6B7280",
    )


# ---------------------------------------------------------------------------
# TagResponse — full detail view
# ---------------------------------------------------------------------------


class TagResponse(BaseModel):
    """Complete Tag representation returned from GET /tags/{id}."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# TagListItem — lightweight projection for list views
# ---------------------------------------------------------------------------


class TagListItem(BaseModel):
    """Lean Tag projection used in list responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# TagListParams — validated query-string parameters
# ---------------------------------------------------------------------------


class TagListParams(BaseModel):
    """Query-string parameters for GET /tags.

    Supports optional name search (case-insensitive substring match).
    """

    # Pagination
    page: int = Field(1, ge=1, description="1-based page number")
    page_size: int = Field(20, ge=1, le=200, description="Results per page (max 200)")

    # Optional name filter
    search: str | None = Field(None, max_length=100, description="Case-insensitive name substring filter")
