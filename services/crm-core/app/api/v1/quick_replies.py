"""FastAPI router for the QuickReply resource — /api/v1/quick-replies.

Endpoint map:
  GET    /              list_quick_replies   — all authenticated users
  GET    /{qr_id}       get_quick_reply      — all authenticated users
  POST   /              create_quick_reply   — ADMIN only
  PATCH  /{qr_id}       update_quick_reply   — ADMIN only
  DELETE /{qr_id}       delete_quick_reply   — ADMIN only (204)

Read access is intentionally open to all authenticated roles so that attendants
and sales users can load the picker without an extra privilege check.
Write operations are restricted to ADMIN (and SUPER_ADMIN / TENANT_ADMIN) via
the require_roles dependency — quick replies are a shared tenant configuration
that should only be managed by administrators.
"""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.models.user import User
from app.schemas.lead import PaginatedResponse
from app.schemas.quick_reply import (
    QuickReplyCreate,
    QuickReplyListItem,
    QuickReplyListParams,
    QuickReplyResponse,
    QuickReplyUpdate,
)
from app.services.quick_reply_service import quick_reply_service

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
# Dependency: build QuickReplyListParams from individual query-string args
# ---------------------------------------------------------------------------


def _list_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: str | None = Query(
        None,
        description="ILIKE search across title, shortcut, and content",
    ),
    category: str | None = Query(None, max_length=50),
    is_active: bool | None = Query(
        None,
        description="Filter by active state.  Omit to return all records.",
    ),
) -> QuickReplyListParams:
    return QuickReplyListParams(
        page=page,
        page_size=page_size,
        search=search,
        category=category,
        is_active=is_active,
    )


ListParams = Annotated[QuickReplyListParams, Depends(_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list quick replies
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List quick replies",
    description=(
        "Returns a paginated list of quick replies for the tenant. "
        "Supports full-text search (title, shortcut, content) and optional "
        "filtering by category and is_active status. "
        "Results are ordered by category asc (nulls last), order asc, title asc."
    ),
    response_model=PaginatedResponse[QuickReplyListItem],
    status_code=status.HTTP_200_OK,
)
async def list_quick_replies(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    params: ListParams,
):
    return await quick_reply_service.list_quick_replies(db, tenant_id, params)


# ---------------------------------------------------------------------------
# GET /{qr_id}  — get quick reply detail
# ---------------------------------------------------------------------------


@router.get(
    "/{qr_id}",
    summary="Get quick reply detail",
    description="Returns the full QuickReply record for the given ID, scoped to the tenant.",
    response_model=QuickReplyResponse,
    status_code=status.HTTP_200_OK,
)
async def get_quick_reply(
    qr_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> QuickReplyResponse:
    qr = await quick_reply_service.get_quick_reply(db, tenant_id, qr_id)
    return QuickReplyResponse.model_validate(qr)


# ---------------------------------------------------------------------------
# POST /  — create quick reply  (ADMIN only)
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create a quick reply",
    description=(
        "Creates a new QuickReply scoped to the authenticated user's tenant.  "
        "The shortcut must be unique within the tenant (case-sensitive slug). "
        "ADMIN only."
    ),
    response_model=QuickReplyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_quick_reply(
    payload: QuickReplyCreate,
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
) -> QuickReplyResponse:
    qr = await quick_reply_service.create_quick_reply(
        db=db,
        tenant_id=tenant_id,
        data=payload,
        user_id=current_user.id,
    )
    return QuickReplyResponse.model_validate(qr)


# ---------------------------------------------------------------------------
# PATCH /{qr_id}  — partial update  (ADMIN only)
# ---------------------------------------------------------------------------


@router.patch(
    "/{qr_id}",
    summary="Update a quick reply",
    description=(
        "Partial update — only non-null fields in the request body are applied. "
        "If the shortcut is changed it must still be unique within the tenant. "
        "ADMIN only."
    ),
    response_model=QuickReplyResponse,
    status_code=status.HTTP_200_OK,
)
async def update_quick_reply(
    qr_id: uuid.UUID,
    payload: QuickReplyUpdate,
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
) -> QuickReplyResponse:
    qr = await quick_reply_service.update_quick_reply(
        db=db,
        tenant_id=tenant_id,
        qr_id=qr_id,
        data=payload,
    )
    return QuickReplyResponse.model_validate(qr)


# ---------------------------------------------------------------------------
# DELETE /{qr_id}  — delete quick reply  (ADMIN only)
# ---------------------------------------------------------------------------


@router.delete(
    "/{qr_id}",
    summary="Delete a quick reply",
    description="Hard-deletes the QuickReply record.  ADMIN only.",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=FastAPIResponse,
)
async def delete_quick_reply(
    qr_id: uuid.UUID,
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
) -> FastAPIResponse:
    await quick_reply_service.delete_quick_reply(db, tenant_id, qr_id)
    return FastAPIResponse(status_code=status.HTTP_204_NO_CONTENT)
