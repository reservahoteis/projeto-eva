"""Pydantic v2 schemas for the WebhookEvent resource.

Schema hierarchy:
  WebhookEventResponse   — read-only representation of a single webhook event record
  WebhookEventListParams — validated query-string parameters for GET /webhook-events
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.lead import PaginatedResponse as PaginatedResponse  # noqa: F401

__all__ = [
    "WebhookEventResponse",
    "WebhookEventListParams",
    "PaginatedResponse",
]

# ---------------------------------------------------------------------------
# Valid ordering fields — prevents SQL injection via ORDER BY
# ---------------------------------------------------------------------------

_WEBHOOK_EVENT_ORDERABLE_FIELDS = {
    "created_at",
    "source",
    "event",
    "processed",
    "processed_at",
}


# ---------------------------------------------------------------------------
# WebhookEventResponse — read-only representation
# ---------------------------------------------------------------------------


class WebhookEventResponse(BaseModel):
    """Complete WebhookEvent representation.

    Webhook events are recorded by the inbound webhook handler and processed
    asynchronously.  There are no write schemas — the records are created
    internally by the worker, not via public API input.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID

    # Origin channel and event type
    source: str
    event: str

    # Full raw payload as received from the channel provider
    payload: dict[str, Any]

    # Processing state
    processed: bool
    processed_at: datetime | None = None
    error: str | None = None

    # Record timestamp
    created_at: datetime


# ---------------------------------------------------------------------------
# WebhookEventListParams — validated query-string parameters
# ---------------------------------------------------------------------------


class WebhookEventListParams(BaseModel):
    """Query-string parameters for GET /webhook-events.

    FastAPI automatically populates a Depends(WebhookEventListParams) from the
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
    source: str | None = Field(None, max_length=100, description="Filter by source channel (exact match)")
    processed: bool | None = Field(None, description="Filter by processing state")

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
            if field not in _WEBHOOK_EVENT_ORDERABLE_FIELDS:
                raise ValueError(
                    f"Field {field!r} is not orderable. "
                    f"Allowed: {sorted(_WEBHOOK_EVENT_ORDERABLE_FIELDS)}"
                )
            if direction not in ("asc", "desc"):
                raise ValueError(f"Direction must be 'asc' or 'desc', got {direction!r}")
        return v
