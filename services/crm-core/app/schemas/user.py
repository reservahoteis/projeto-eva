"""Pydantic v2 schemas for the User resource.

Schema hierarchy:
  UserCreate            — input for POST /users
  UserUpdate            — input for PUT /users/{id}  (all fields optional)
  UserResponse          — full representation returned from GET /users/{id}
  UserListItem          — lean projection used in list views
  ChangePasswordRequest — body for PUT /auth/me/password
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def _to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(w.capitalize() for w in parts[1:])


# ---------------------------------------------------------------------------
# Role / status literals
# ---------------------------------------------------------------------------

UserRole = Literal["SUPER_ADMIN", "TENANT_ADMIN", "ADMIN", "HEAD", "MANAGER", "ATTENDANT", "SALES"]
UserStatus = Literal["ACTIVE", "INACTIVE"]


# ---------------------------------------------------------------------------
# UserCreate
# ---------------------------------------------------------------------------


class UserCreate(BaseModel):
    """Fields accepted when creating a new User via POST /users.

    Password is stored as a bcrypt hash — the plain-text value is
    accepted here and hashed inside UserService.create_user.
    """

    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole = "ATTENDANT"
    phone: str | None = Field(None, max_length=50)
    avatar_url: str | None = Field(None, max_length=500)


# ---------------------------------------------------------------------------
# UserUpdate
# ---------------------------------------------------------------------------


class UserUpdate(BaseModel):
    """Partial update body for PUT /users/{id}.

    All fields are optional — only non-None values are applied.
    Callers cannot change their own role (enforced in the service layer).
    """

    name: str | None = Field(None, min_length=2, max_length=255)
    email: EmailStr | None = None
    role: UserRole | None = None
    phone: str | None = Field(None, max_length=50)
    avatar_url: str | None = Field(None, max_length=500)
    status: UserStatus | None = None


# ---------------------------------------------------------------------------
# UserResponse
# ---------------------------------------------------------------------------


class UserResponse(BaseModel):
    """Full user representation returned from GET /users/{id} and /auth/me."""

    model_config = ConfigDict(from_attributes=True, alias_generator=_to_camel, populate_by_name=True)

    id: uuid.UUID
    tenant_id: uuid.UUID | None
    name: str
    email: str
    role: str
    status: str
    # Exposed as "avatar" (not "avatarUrl") to match frontend expectations.
    # The explicit alias takes precedence over alias_generator.
    avatar_url: str | None = Field(None, alias="avatar")
    phone: str | None = None
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None


# ---------------------------------------------------------------------------
# UserListItem
# ---------------------------------------------------------------------------


class UserListItem(BaseModel):
    """Lean user projection for list endpoints — omits audit timestamps."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    role: str
    status: str
    avatar_url: str | None = None
    phone: str | None = None


# ---------------------------------------------------------------------------
# ChangePasswordRequest
# ---------------------------------------------------------------------------


class ChangePasswordRequest(BaseModel):
    """Body for PUT /auth/me/password."""

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)
