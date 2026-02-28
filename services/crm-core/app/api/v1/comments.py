"""Comments API router — /api/v1/comments.

Comments are polymorphic — they attach to any CRM entity via
reference_doctype + reference_docname.

Endpoint map:
  GET    /                — list comments filtered by reference document
  POST   /                — create a new comment
  PUT    /{comment_id}    — update comment content (author only)
  DELETE /{comment_id}    — delete comment (author only)

All endpoints require a valid Bearer JWT (get_current_user) and resolve the
calling user's tenant automatically via get_tenant_id.

Authorization:
  - Any authenticated user may create comments.
  - Only the original author may update or delete their own comment.
    The service layer raises ForbiddenError (HTTP 403) for violations.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentResponse, CommentUpdate
from app.schemas.lead import PaginatedResponse
from app.services.comment_service import comment_service

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# GET /  — list comments
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List comments",
    description=(
        "Returns paginated comments for a specific CRM document. "
        "Both reference_doctype and reference_docname must be provided."
    ),
    response_model=PaginatedResponse[CommentResponse],
    status_code=status.HTTP_200_OK,
)
async def list_comments(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    reference_doctype: str = Query(
        ...,
        description="Lead | Deal | Contact | Organization | Task",
        min_length=1,
        max_length=50,
    ),
    reference_docname: uuid.UUID = Query(
        ...,
        description="UUID primary key of the referenced CRM document",
    ),
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(20, ge=1, le=100, description="Results per page (max 100)"),
) -> PaginatedResponse[CommentResponse]:
    return await comment_service.list_comments(
        db=db,
        tenant_id=tenant_id,
        reference_doctype=reference_doctype,
        reference_docname=reference_docname,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# POST /  — create comment
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create comment",
    description="Add a new comment to any CRM document.  Authorship is recorded automatically.",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    payload: CommentCreate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> CommentResponse:
    comment = await comment_service.create_comment(
        db=db,
        tenant_id=tenant_id,
        data=payload,
        user_id=current_user.id,
    )
    return CommentResponse.model_validate(comment)


# ---------------------------------------------------------------------------
# PUT /{comment_id}  — update comment
# ---------------------------------------------------------------------------


@router.put(
    "/{comment_id}",
    summary="Update comment",
    description=(
        "Update the content of an existing comment. "
        "Only the original author may edit their comment (HTTP 403 otherwise)."
    ),
    response_model=CommentResponse,
    status_code=status.HTTP_200_OK,
)
async def update_comment(
    comment_id: uuid.UUID,
    payload: CommentUpdate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> CommentResponse:
    comment = await comment_service.update_comment(
        db=db,
        tenant_id=tenant_id,
        comment_id=comment_id,
        data=payload,
        user_id=current_user.id,
    )
    return CommentResponse.model_validate(comment)


# ---------------------------------------------------------------------------
# DELETE /{comment_id}  — delete comment
# ---------------------------------------------------------------------------


@router.delete(
    "/{comment_id}",
    summary="Delete comment",
    description=(
        "Hard-delete a comment. "
        "Only the original author may delete their comment (HTTP 403 otherwise)."
    ),
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_comment(
    comment_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> None:
    await comment_service.delete_comment(
        db=db,
        tenant_id=tenant_id,
        comment_id=comment_id,
        user_id=current_user.id,
    )
