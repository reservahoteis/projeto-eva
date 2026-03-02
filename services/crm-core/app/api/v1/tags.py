"""FastAPI router for the Tag resource — /api/v1/tags.

All endpoints require a valid Bearer JWT (get_current_user) and resolve the
calling user's tenant automatically (get_tenant_id — populated by
get_current_user via request.state).

Endpoint map:
  GET    /             list_tags    — paginated, optional name search
  POST   /             create_tag   — 201 Created
  GET    /{tag_id}     get_tag
  PATCH  /{tag_id}     update_tag
  DELETE /{tag_id}     delete_tag  — 204 No Content
"""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id
from app.models.user import User
from app.schemas.lead import PaginatedResponse
from app.schemas.tag import (
    TagCreate,
    TagListItem,
    TagListParams,
    TagResponse,
    TagUpdate,
)
from app.services.tag_service import tag_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Dependency: build TagListParams from individual query-string args
# ---------------------------------------------------------------------------


def _tag_list_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: str | None = Query(None, description="Case-insensitive name substring filter"),
) -> TagListParams:
    return TagListParams(
        page=page,
        page_size=page_size,
        search=search,
    )


ListParams = Annotated[TagListParams, Depends(_tag_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list tags
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List tags",
    description=(
        "Returns a paginated list of tags for the tenant, ordered alphabetically. "
        "Optionally filter by name using the search parameter: "
        "GET /tags?search=vip returns all tags whose name contains 'vip'."
    ),
    response_model=PaginatedResponse[TagListItem],
    status_code=status.HTTP_200_OK,
)
async def list_tags(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    params: ListParams,
):
    return await tag_service.list_tags(db, tenant_id, params)


# ---------------------------------------------------------------------------
# POST /  — create tag
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create a tag",
    description=(
        "Creates a tag scoped to the authenticated user's tenant. "
        "Tag names are unique per tenant — a 409 is returned when the name "
        "already exists. Color must be a valid 6-digit hex code (e.g. #6B7280)."
    ),
    response_model=TagResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tag(
    payload: TagCreate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> TagResponse:
    tag = await tag_service.create_tag(
        db=db,
        tenant_id=tenant_id,
        data=payload,
    )
    return TagResponse.model_validate(tag)


# ---------------------------------------------------------------------------
# GET /{tag_id}  — get tag detail
# ---------------------------------------------------------------------------


@router.get(
    "/{tag_id}",
    summary="Get tag detail",
    response_model=TagResponse,
    status_code=status.HTTP_200_OK,
)
async def get_tag(
    tag_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> TagResponse:
    tag = await tag_service.get_tag(db, tenant_id, tag_id)
    return TagResponse.model_validate(tag)


# ---------------------------------------------------------------------------
# PATCH /{tag_id}  — update tag
# ---------------------------------------------------------------------------


@router.patch(
    "/{tag_id}",
    summary="Update a tag",
    description=(
        "Partial update — only non-null fields in the request body are applied. "
        "Renaming a tag to a name already used by another tag in the same tenant "
        "returns a 409."
    ),
    response_model=TagResponse,
    status_code=status.HTTP_200_OK,
)
async def update_tag(
    tag_id: uuid.UUID,
    payload: TagUpdate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> TagResponse:
    tag = await tag_service.update_tag(
        db=db,
        tenant_id=tenant_id,
        tag_id=tag_id,
        data=payload,
    )
    return TagResponse.model_validate(tag)


# ---------------------------------------------------------------------------
# DELETE /{tag_id}  — delete tag
# ---------------------------------------------------------------------------


@router.delete(
    "/{tag_id}",
    summary="Delete a tag",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_tag(
    tag_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
):
    await tag_service.delete_tag(db, tenant_id, tag_id)
