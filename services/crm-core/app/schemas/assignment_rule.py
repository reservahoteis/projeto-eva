"""Pydantic v2 schemas for Assignment Rules.

Schema hierarchy:
  AssignmentRuleCreate    — input for POST /assignment-rules
  AssignmentRuleUpdate    — partial update, all fields optional
  AssignmentRuleResponse  — full representation
  AssignmentResponse      — read representation of a single Assignment record
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# AssignmentRuleCreate
# ---------------------------------------------------------------------------


class AssignmentRuleCreate(BaseModel):
    """Fields accepted when creating a new AssignmentRule."""

    name: str = Field(..., min_length=1, max_length=255)
    doctype: Literal["Lead", "Deal"] = Field(
        ...,
        description="Which document type this rule targets: Lead | Deal",
    )
    assign_condition: str | None = Field(
        None,
        description=(
            "Optional Python/Jinja expression evaluated against the document to decide "
            "whether this rule fires. Null means 'always fire'."
        ),
    )
    assignment_type: Literal["round_robin", "load_balancing"] = Field(
        "round_robin",
        description="How to pick the assignee: round_robin | load_balancing",
    )
    user_ids: list[uuid.UUID] = Field(
        ...,
        min_length=1,
        description="Ordered list of user UUIDs forming the assignment pool",
    )
    enabled: bool = Field(True, description="Whether this rule is active")

    @field_validator("user_ids")
    @classmethod
    def no_duplicate_users(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(v) != len(set(v)):
            raise ValueError("user_ids must not contain duplicates")
        return v


# ---------------------------------------------------------------------------
# AssignmentRuleUpdate
# ---------------------------------------------------------------------------


class AssignmentRuleUpdate(BaseModel):
    """All fields optional for PATCH-style updates via PUT /assignment-rules/{id}.

    When user_ids is provided it REPLACES the current pool entirely.
    """

    name: str | None = Field(None, min_length=1, max_length=255)
    doctype: Literal["Lead", "Deal"] | None = None
    assign_condition: str | None = None
    assignment_type: Literal["round_robin", "load_balancing"] | None = None
    user_ids: list[uuid.UUID] | None = None
    enabled: bool | None = None

    @field_validator("user_ids")
    @classmethod
    def no_duplicate_users(
        cls, v: list[uuid.UUID] | None
    ) -> list[uuid.UUID] | None:
        if v is not None and len(v) != len(set(v)):
            raise ValueError("user_ids must not contain duplicates")
        return v


# ---------------------------------------------------------------------------
# AssignmentRuleResponse
# ---------------------------------------------------------------------------


class AssignmentRuleResponse(BaseModel):
    """Complete AssignmentRule representation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    doctype: str
    assign_condition: str | None
    assignment_type: str
    # Expose the user pool as a parsed list — the service converts users_json
    # (stored as raw JSON text) to a Python list before returning.
    user_ids: list[uuid.UUID]
    enabled: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# AssignmentResponse — individual Assignment record
# ---------------------------------------------------------------------------


class AssignedUserEmbed(BaseModel):
    """Minimal User projection for embedding inside an Assignment response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    avatar_url: str | None = None


class AssignmentDetailResponse(BaseModel):
    """Full Assignment record as returned by the assignment engine."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    doctype: str
    docname: uuid.UUID
    assigned_to_id: uuid.UUID
    assigned_by_id: uuid.UUID | None
    status: str
    assigned_to: AssignedUserEmbed | None = None
    created_at: datetime
    updated_at: datetime
