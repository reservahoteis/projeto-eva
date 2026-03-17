"""Pydantic v2 schemas for the AuditLog resource.

Schema hierarchy:
  AuditLogResponse    — read-only representation of a single audit log entry
  AuditLogListParams  — validated query-string parameters for GET /audit-logs
  ClientErrorReport   — body accepted from frontend error-boundary reporters
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.lead import PaginatedResponse as PaginatedResponse  # noqa: F401

__all__ = [
    "AuditLogResponse",
    "AuditLogListParams",
    "ClientErrorReport",
    "PaginatedResponse",
]

# ---------------------------------------------------------------------------
# Valid ordering fields — prevents SQL injection via ORDER BY
# ---------------------------------------------------------------------------

_AUDIT_LOG_ORDERABLE_FIELDS = {
    "created_at",
    "action",
    "entity",
    "user_id",
}


# ---------------------------------------------------------------------------
# AuditLogResponse — read-only representation
# ---------------------------------------------------------------------------


class AuditLogResponse(BaseModel):
    """Complete AuditLog entry representation.

    Audit logs are immutable — there are no create/update input schemas.
    The service layer creates entries automatically for all mutating operations.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID

    # Actor
    user_id: uuid.UUID | None = None

    # Operation
    action: str
    entity: str | None = None
    entity_id: str | None = None

    # Before/after snapshots stored as JSONB
    old_data: dict[str, Any] | None = None
    new_data: dict[str, Any] | None = None

    # Additional context
    metadata_json: dict[str, Any] | None = None
    ip_address: str | None = None

    # Timestamp
    created_at: datetime


# ---------------------------------------------------------------------------
# AuditLogListParams — validated query-string parameters
# ---------------------------------------------------------------------------


class AuditLogListParams(BaseModel):
    """Query-string parameters for GET /audit-logs.

    FastAPI automatically populates a Depends(AuditLogListParams) from the
    query-string when the router uses a dependency function.
    """

    # Pagination
    page: int = Field(1, ge=1, description="1-based page number")
    page_size: int = Field(20, ge=1, le=200, description="Results per page (max 200)")

    # Sorting
    order_by: str = Field(
        "created_at desc",
        description='Comma-separated sort tokens, e.g. "created_at desc"',
    )

    # Filters
    action: str | None = Field(None, max_length=100, description="Filter by action type (exact match)")
    entity: str | None = Field(None, max_length=100, description="Filter by entity type (exact match)")
    user_id: uuid.UUID | None = Field(None, description="Filter by actor user ID")
    start_date: datetime | None = Field(None, description="Inclusive start of the time window (ISO-8601)")
    end_date: datetime | None = Field(None, description="Inclusive end of the time window (ISO-8601)")

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
            if field not in _AUDIT_LOG_ORDERABLE_FIELDS:
                raise ValueError(
                    f"Field {field!r} is not orderable. "
                    f"Allowed: {sorted(_AUDIT_LOG_ORDERABLE_FIELDS)}"
                )
            if direction not in ("asc", "desc"):
                raise ValueError(f"Direction must be 'asc' or 'desc', got {direction!r}")
        return v

    @field_validator("end_date")
    @classmethod
    def end_must_be_after_start(cls, v: datetime | None, info: object) -> datetime | None:
        data = getattr(info, "data", {})
        start = data.get("start_date")
        if start is not None and v is not None and v < start:
            raise ValueError("end_date must be on or after start_date")
        return v


# ---------------------------------------------------------------------------
# ClientErrorReport — frontend error-boundary reporter
# ---------------------------------------------------------------------------


class ClientErrorReport(BaseModel):
    """Body accepted by POST /client-errors.

    Allows the frontend error boundary to report JavaScript exceptions to the
    backend, which persists them as audit log entries with action='CLIENT_ERROR'.
    """

    error: str = Field(..., min_length=1, max_length=2000, description="Error message or stack trace")
    url: str | None = Field(None, max_length=2000, description="Browser URL where the error occurred")
    user_agent: str | None = Field(None, max_length=500, description="User-agent string from the browser")
    metadata: dict[str, Any] | None = Field(None, description="Additional structured context (component, props, etc.)")
