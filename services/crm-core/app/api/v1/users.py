"""FastAPI router for the User resource — /api/v1/users.

Endpoint map:
  GET    /              — List users (ADMIN only)
  POST   /              — Create user (ADMIN only)
  GET    /{user_id}     — Get user detail (any authenticated user)
  PUT    /{user_id}     — Update user (ADMIN only)
  DELETE /{user_id}     — Deactivate user (ADMIN only)

Role enforcement is done via require_roles() dependency which calls
get_current_user internally, so tenant_id is always populated.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.models.user import User
from app.schemas.user import UserCreate, UserListItem, UserResponse, UserUpdate
from app.services.user_service import user_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_roles("ADMIN", "SUPER_ADMIN", "TENANT_ADMIN"))]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List users",
    description="Paginated list of users for the current tenant.  ADMIN only.",
    status_code=status.HTTP_200_OK,
)
async def list_users(
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="ILIKE search across name and email"),
) -> dict[str, Any]:
    return await user_service.list_users(
        db=db,
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        search=search,
    )


# ---------------------------------------------------------------------------
# POST /
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create user",
    description="Create a new user for the current tenant.  ADMIN only.",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    body: UserCreate,
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
) -> UserResponse:
    return await user_service.create_user(
        db=db,
        tenant_id=tenant_id,
        data=body,
    )


# ---------------------------------------------------------------------------
# GET /{user_id}
# ---------------------------------------------------------------------------


@router.get(
    "/{user_id}",
    summary="Get user detail",
    description="Return full profile for a single user scoped to the current tenant.",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
async def get_user(
    user_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> UserResponse:
    return await user_service.get_user(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
    )


# ---------------------------------------------------------------------------
# PUT /{user_id}
# ---------------------------------------------------------------------------


@router.put(
    "/{user_id}",
    summary="Update user",
    description=(
        "Partial update — only non-null fields are applied.  ADMIN only. "
        "Callers cannot change their own role."
    ),
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
) -> UserResponse:
    return await user_service.update_user(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        data=body,
        current_user_id=current_user.id,
    )


# ---------------------------------------------------------------------------
# DELETE /{user_id}
# ---------------------------------------------------------------------------


@router.delete(
    "/{user_id}",
    summary="Deactivate user",
    description=(
        "Set user status=INACTIVE rather than hard-deleting.  ADMIN only. "
        "Callers cannot deactivate their own account."
    ),
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=FastAPIResponse,
)
async def deactivate_user(
    user_id: uuid.UUID,
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
) -> FastAPIResponse:
    await user_service.deactivate_user(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        current_user_id=current_user.id,
    )
    return FastAPIResponse(status_code=status.HTTP_204_NO_CONTENT)
