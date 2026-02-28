"""FastAPI router for the Auth resource — /api/v1/auth.

Endpoint map:
  POST /login           — Login with email + password + tenant_slug
  POST /refresh         — Exchange refresh token for new access token
  GET  /me              — Get current user profile  (requires auth)
  PUT  /me/password     — Change current user password  (requires auth)

login and refresh are intentionally public — no Bearer token is required.
/me and /me/password require a valid access token via get_current_user.
"""

from __future__ import annotations

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, RefreshRequest, RefreshResponse
from app.schemas.user import ChangePasswordRequest, UserResponse
from app.services.auth_service import auth_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


# ---------------------------------------------------------------------------
# POST /login
# ---------------------------------------------------------------------------


@router.post(
    "/login",
    summary="Login",
    description=(
        "Authenticate with email, password and tenant_slug. "
        "Returns a short-lived access token and a long-lived refresh token."
    ),
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
)
async def login(
    body: LoginRequest,
    db: DB,
) -> LoginResponse:
    return await auth_service.login(
        db=db,
        tenant_slug=body.tenant_slug,
        email=body.email,
        password=body.password,
    )


# ---------------------------------------------------------------------------
# POST /refresh
# ---------------------------------------------------------------------------


@router.post(
    "/refresh",
    summary="Refresh access token",
    description=(
        "Exchange a valid refresh token for a new access token. "
        "The refresh token itself is not rotated."
    ),
    response_model=RefreshResponse,
    status_code=status.HTTP_200_OK,
)
async def refresh(
    body: RefreshRequest,
    db: DB,
) -> RefreshResponse:
    return await auth_service.refresh(db=db, refresh_token=body.refresh_token)


# ---------------------------------------------------------------------------
# GET /me
# ---------------------------------------------------------------------------


@router.get(
    "/me",
    summary="Get current user",
    description="Return the profile of the authenticated user.",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
async def me(
    current_user: CurrentUser,
    db: DB,
) -> UserResponse:
    return await auth_service.me(db=db, user_id=current_user.id)


# ---------------------------------------------------------------------------
# PUT /me/password
# ---------------------------------------------------------------------------


@router.put(
    "/me/password",
    summary="Change password",
    description=(
        "Verify the current password and update to the new one. "
        "Returns 204 No Content on success."
    ),
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=FastAPIResponse,
)
async def change_password(
    body: ChangePasswordRequest,
    current_user: CurrentUser,
    db: DB,
) -> FastAPIResponse:
    await auth_service.change_password(
        db=db,
        user_id=current_user.id,
        data=body,
    )
    return FastAPIResponse(status_code=status.HTTP_204_NO_CONTENT)
