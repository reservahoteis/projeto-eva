"""Pydantic v2 schemas for the Auth resource.

Schema hierarchy:
  LoginRequest      — body for POST /auth/login
  LoginResponse     — tokens + user profile returned on successful login
  RefreshRequest    — body for POST /auth/refresh
  RefreshResponse   — new access token returned after refresh
"""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserResponse


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    """Credentials submitted to POST /auth/login.

    The caller MUST provide tenant_slug so the service can resolve the tenant
    and enforce per-tenant email uniqueness before comparing passwords.
    This prevents cross-tenant credential probing.
    """

    tenant_slug: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    """Tokens and minimal user profile returned on a successful login."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


class RefreshRequest(BaseModel):
    """Refresh token submitted to POST /auth/refresh."""

    refresh_token: str = Field(..., min_length=1)


class RefreshResponse(BaseModel):
    """New short-lived access token returned after a successful refresh."""

    access_token: str
    token_type: str = "bearer"
