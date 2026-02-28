"""Pydantic v2 schemas for the Comment resource.

Comments are polymorphic — they attach to any CRM document via
reference_doctype + reference_docname.  Only the creator may edit
or delete their own comments.

Schema hierarchy:
  CommentCreate   — input for POST /comments
  CommentUpdate   — input for PUT /comments/{id}
  CommentResponse — full representation
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.activity import UserEmbed


# ---------------------------------------------------------------------------
# CommentCreate
# ---------------------------------------------------------------------------


class CommentCreate(BaseModel):
    """Fields accepted when creating a new Comment."""

    content: str = Field(..., min_length=1)
    reference_doctype: str = Field(
        ...,
        max_length=50,
        description="Lead | Deal | Contact | Organization | Task",
    )
    reference_docname: uuid.UUID = Field(
        ...,
        description="PK of the referenced CRM document",
    )


# ---------------------------------------------------------------------------
# CommentUpdate
# ---------------------------------------------------------------------------


class CommentUpdate(BaseModel):
    """Partial update — only content may be changed."""

    content: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# CommentResponse
# ---------------------------------------------------------------------------


class CommentResponse(BaseModel):
    """Complete Comment representation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content: str
    reference_doctype: str | None = None
    reference_docname: uuid.UUID | None = None
    created_by: UserEmbed | None = None
    created_at: datetime
    updated_at: datetime
