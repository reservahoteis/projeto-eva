"""Pydantic v2 schemas for the Task resource.

Schema hierarchy:
  TaskCreate        — input for POST /tasks
  TaskUpdate        — input for PUT /tasks/{id}  (all fields optional)
  TaskResponse      — full representation returned from GET /tasks/{id}
  TaskListItem      — lightweight projection used in list / kanban views
  TaskListParams    — validated query-string parameters for GET /tasks

Kanban support:
  Tasks support view_type=kanban with column_field fixed to "status", grouping
  cards into the five status buckets (Backlog, Todo, In Progress, Done, Canceled)
  each with a pre-defined brand color.

Shared generics (PaginatedResponse, KanbanColumn, KanbanResponse) are imported
from app.schemas.lead to avoid duplication.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.lead import KanbanColumn, KanbanResponse, PaginatedResponse

# ---------------------------------------------------------------------------
# Allowed value sets — validated at schema level to fail fast
# ---------------------------------------------------------------------------

_ALLOWED_PRIORITIES: frozenset[str] = frozenset({"Low", "Medium", "High"})
_ALLOWED_STATUSES: frozenset[str] = frozenset(
    {"Backlog", "Todo", "In Progress", "Done", "Canceled"}
)
_ALLOWED_REFERENCE_DOCTYPES: frozenset[str] = frozenset(
    {"Lead", "Deal", "Contact", "Organization"}
)

# ---------------------------------------------------------------------------
# Embedded / nested read schemas
# ---------------------------------------------------------------------------


class UserEmbed(BaseModel):
    """Minimal User projection for embedding in Task / Note responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    avatar_url: str | None = None


# ---------------------------------------------------------------------------
# TaskCreate
# ---------------------------------------------------------------------------


class TaskCreate(BaseModel):
    """Fields accepted when creating a new Task via POST /tasks."""

    # Required
    title: str = Field(..., min_length=1, max_length=500)

    # Optional content
    description: str | None = None

    # Classification with validated defaults
    priority: str = Field("Low", description="Low | Medium | High")
    status: str = Field(
        "Backlog",
        description="Backlog | Todo | In Progress | Done | Canceled",
    )

    # Ownership
    assigned_to_id: uuid.UUID | None = None

    # Scheduling
    due_date: date | None = None

    # Polymorphic reference
    reference_doctype: str | None = Field(
        None,
        description="Lead | Deal | Contact | Organization",
    )
    reference_docname: uuid.UUID | None = Field(
        None,
        description="PK of the referenced document",
    )

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        if v not in _ALLOWED_PRIORITIES:
            raise ValueError(
                f"priority must be one of {sorted(_ALLOWED_PRIORITIES)}"
            )
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in _ALLOWED_STATUSES:
            raise ValueError(
                f"status must be one of {sorted(_ALLOWED_STATUSES)}"
            )
        return v

    @field_validator("reference_doctype")
    @classmethod
    def validate_reference_doctype(cls, v: str | None) -> str | None:
        if v is not None and v not in _ALLOWED_REFERENCE_DOCTYPES:
            raise ValueError(
                f"reference_doctype must be one of {sorted(_ALLOWED_REFERENCE_DOCTYPES)}"
            )
        return v


# ---------------------------------------------------------------------------
# TaskUpdate
# ---------------------------------------------------------------------------


class TaskUpdate(BaseModel):
    """All TaskCreate fields made optional for partial updates via PUT /tasks/{id}."""

    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    assigned_to_id: uuid.UUID | None = None
    due_date: date | None = None
    reference_doctype: str | None = None
    reference_docname: uuid.UUID | None = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str | None) -> str | None:
        if v is not None and v not in _ALLOWED_PRIORITIES:
            raise ValueError(
                f"priority must be one of {sorted(_ALLOWED_PRIORITIES)}"
            )
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in _ALLOWED_STATUSES:
            raise ValueError(
                f"status must be one of {sorted(_ALLOWED_STATUSES)}"
            )
        return v

    @field_validator("reference_doctype")
    @classmethod
    def validate_reference_doctype(cls, v: str | None) -> str | None:
        if v is not None and v not in _ALLOWED_REFERENCE_DOCTYPES:
            raise ValueError(
                f"reference_doctype must be one of {sorted(_ALLOWED_REFERENCE_DOCTYPES)}"
            )
        return v


# ---------------------------------------------------------------------------
# TaskResponse — full detail view
# ---------------------------------------------------------------------------


class TaskResponse(BaseModel):
    """Complete Task representation returned from GET /tasks/{id}."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID

    # Content
    title: str
    description: str | None = None

    # Classification
    priority: str
    status: str

    # FK IDs (raw)
    assigned_to_id: uuid.UUID | None = None
    created_by_id: uuid.UUID | None = None

    # Nested user embeds
    assigned_to: UserEmbed | None = None
    created_by: UserEmbed | None = None

    # Scheduling
    due_date: date | None = None

    # Polymorphic reference
    reference_doctype: str | None = None
    reference_docname: uuid.UUID | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# TaskListItem — lightweight projection for list / kanban views
# ---------------------------------------------------------------------------


class TaskListItem(BaseModel):
    """Lean Task projection used in list / kanban views.

    Omits the full description to keep list payloads small.
    The frontend fetches the full TaskResponse only when the user opens the
    detail panel.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID

    # Core display fields
    title: str
    priority: str
    status: str

    # Ownership mini embed
    assigned_to: UserEmbed | None = None

    # Scheduling
    due_date: date | None = None

    # Reference link
    reference_doctype: str | None = None
    reference_docname: uuid.UUID | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# TaskListParams — validated query-string parameters
# ---------------------------------------------------------------------------

# Valid fields for ordering
_TASK_ORDERABLE_FIELDS: frozenset[str] = frozenset(
    {
        "created_at",
        "updated_at",
        "title",
        "priority",
        "status",
        "due_date",
        "assigned_to_id",
    }
)

# For tasks, kanban is always by "status" — the only supported column_field
_TASK_KANBAN_COLUMN_FIELDS: frozenset[str] = frozenset({"status"})


class TaskListParams(BaseModel):
    """Query-string parameters for GET /tasks.

    FastAPI automatically populates a Depends(TaskListParams) from the
    query string when the router uses a custom dependency factory.
    """

    # Pagination
    page: int = Field(1, ge=1, description="1-based page number")
    page_size: int = Field(20, ge=1, le=200, description="Results per page (max 200)")

    # Sorting
    order_by: str = Field(
        "created_at desc",
        description='Comma-separated sort tokens, e.g. "created_at desc,title asc"',
    )

    # View type
    view_type: Literal["list", "kanban"] = Field(
        "list",
        description="list returns paginated rows; kanban groups by status",
    )

    # Kanban column field — for tasks the only valid value is "status"
    column_field: str | None = Field(
        None,
        description='Field to use as kanban column. For tasks only "status" is supported.',
    )

    # Arbitrary equality filters
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
            if field not in _TASK_ORDERABLE_FIELDS:
                raise ValueError(
                    f"Field {field!r} is not orderable. "
                    f"Allowed: {sorted(_TASK_ORDERABLE_FIELDS)}"
                )
            if direction not in ("asc", "desc"):
                raise ValueError(f"Direction must be 'asc' or 'desc', got {direction!r}")
        return v

    @field_validator("column_field")
    @classmethod
    def validate_column_field(cls, v: str | None) -> str | None:
        if v is not None and v not in _TASK_KANBAN_COLUMN_FIELDS:
            raise ValueError(
                f"column_field {v!r} is not supported for tasks. "
                f"Allowed: {sorted(_TASK_KANBAN_COLUMN_FIELDS)}"
            )
        return v


# ---------------------------------------------------------------------------
# BulkDelete request / response for tasks
# ---------------------------------------------------------------------------


class TaskBulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID] = Field(..., min_length=1, max_length=500)


class TaskBulkDeleteResponse(BaseModel):
    deleted_count: int
