"""Pydantic v2 schemas for the Note resource.

Schema hierarchy:
  NoteCreate      — input for POST /notes
  NoteUpdate      — input for PUT /notes/{id}  (all fields optional)
  NoteResponse    — full representation returned from GET /notes/{id}
  NoteListItem    — lightweight projection used in list views
  NoteListParams  — validated query-string parameters for GET /notes

Notes are polymorphic — they attach to any CRM entity via
reference_doctype + reference_docname.  The list endpoint supports
filtering by these fields so the frontend can fetch all notes for a
specific Lead, Deal, Contact, or Organization.

PaginatedResponse is imported from app.schemas.lead to avoid duplication.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.lead import PaginatedResponse
from app.schemas.task import UserEmbed  # reuse the same minimal User embed

# Re-export so callers can import UserEmbed from here if needed
__all__ = [
    "NoteCreate",
    "NoteUpdate",
    "NoteResponse",
    "NoteListItem",
    "NoteListParams",
    "NoteBulkDeleteRequest",
    "NoteBulkDeleteResponse",
    "PaginatedResponse",
    "UserEmbed",
]

_ALLOWED_REFERENCE_DOCTYPES: frozenset[str] = frozenset(
    {"Lead", "Deal", "Contact", "Organization"}
)

# ---------------------------------------------------------------------------
# NoteCreate
# ---------------------------------------------------------------------------


class NoteCreate(BaseModel):
    """Fields accepted when creating a new Note via POST /notes."""

    # Required
    title: str = Field(..., min_length=1, max_length=500)

    # Optional rich-text content
    content: str | None = None

    # Polymorphic reference — links this note to a CRM entity
    reference_doctype: str | None = Field(
        None,
        description="Lead | Deal | Contact | Organization",
    )
    reference_docname: uuid.UUID | None = Field(
        None,
        description="PK of the referenced document",
    )

    @field_validator("reference_doctype")
    @classmethod
    def validate_reference_doctype(cls, v: str | None) -> str | None:
        if v is not None and v not in _ALLOWED_REFERENCE_DOCTYPES:
            raise ValueError(
                f"reference_doctype must be one of {sorted(_ALLOWED_REFERENCE_DOCTYPES)}"
            )
        return v


# ---------------------------------------------------------------------------
# NoteUpdate
# ---------------------------------------------------------------------------


class NoteUpdate(BaseModel):
    """Partial update payload for PUT /notes/{id}.

    Only title and content are mutable after creation.  Changing the
    reference link of a note is intentionally not supported — create a new
    note if the target entity changes.
    """

    title: str | None = Field(None, min_length=1, max_length=500)
    content: str | None = None


# ---------------------------------------------------------------------------
# NoteResponse — full detail view
# ---------------------------------------------------------------------------


class NoteResponse(BaseModel):
    """Complete Note representation returned from GET /notes/{id}."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID

    # Content
    title: str
    content: str | None = None

    # Polymorphic reference
    reference_doctype: str | None = None
    reference_docname: uuid.UUID | None = None

    # Authorship FK (raw)
    created_by_id: uuid.UUID | None = None

    # Nested author embed
    created_by: UserEmbed | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# NoteListItem — lightweight projection for list views
# ---------------------------------------------------------------------------


class NoteListItem(BaseModel):
    """Lean Note projection used in list responses.

    The full content field is omitted — the frontend renders a truncated
    preview from the title and fetches the full NoteResponse only when the
    user opens the detail panel.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str

    # Reference link — lets the UI group notes by entity without a second request
    reference_doctype: str | None = None
    reference_docname: uuid.UUID | None = None

    # Compact author info
    created_by: UserEmbed | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# NoteListParams — validated query-string parameters
# ---------------------------------------------------------------------------


class NoteListParams(BaseModel):
    """Query-string parameters for GET /notes.

    The most common usage is fetching all notes for a specific CRM entity:
      GET /notes?reference_doctype=Lead&reference_docname=<uuid>

    Omitting both filter fields returns all notes for the tenant (paginated).
    """

    # Pagination
    page: int = Field(1, ge=1, description="1-based page number")
    page_size: int = Field(20, ge=1, le=200, description="Results per page (max 200)")

    # Reference filters — the primary way notes are queried
    reference_doctype: str | None = Field(
        None,
        description="Lead | Deal | Contact | Organization",
    )
    reference_docname: uuid.UUID | None = Field(
        None,
        description="PK of the referenced document",
    )

    @field_validator("reference_doctype")
    @classmethod
    def validate_reference_doctype(cls, v: str | None) -> str | None:
        if v is not None and v not in _ALLOWED_REFERENCE_DOCTYPES:
            raise ValueError(
                f"reference_doctype must be one of {sorted(_ALLOWED_REFERENCE_DOCTYPES)}"
            )
        return v


# ---------------------------------------------------------------------------
# BulkDelete request / response for notes
# ---------------------------------------------------------------------------


class NoteBulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID] = Field(..., min_length=1, max_length=500)


class NoteBulkDeleteResponse(BaseModel):
    deleted_count: int
