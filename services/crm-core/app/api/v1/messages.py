"""Messages API router — /api/v1/messages.

Endpoints that operate on messages independently of a specific conversation.

Endpoint map:
  GET  /search      — global message search (ADMIN-only)
  POST /{id}/read   — mark a message as read (tenant-scoped)
"""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.core.exceptions import NotFoundError
from app.models.message import Message
from app.models.user import User
from app.schemas.message import MessageCursorResponse, MessageResponse
from app.schemas.lead import PaginatedResponse
from app.services.message_service import message_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# GET /search  — global message search (ADMIN-only)
# ---------------------------------------------------------------------------


@router.get(
    "/search",
    summary="Global message search",
    description=(
        "Full-text search across all messages in the tenant. "
        "Returns messages whose content matches the query string. "
        "Restricted to SUPER_ADMIN, TENANT_ADMIN, and ADMIN roles."
    ),
    response_model=PaginatedResponse[MessageResponse],
    status_code=status.HTTP_200_OK,
)
async def search_messages(
    db: DB,
    tenant_id: TenantId,
    current_user: User = Depends(require_roles("SUPER_ADMIN", "TENANT_ADMIN", "ADMIN")),
    q: str = Query(..., min_length=1, max_length=200, description="Search query string"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[MessageResponse]:
    """Search messages by content substring within the calling user's tenant."""
    from sqlalchemy import func

    pattern = f"%{q}%"

    base_q = (
        select(Message)
        .where(
            Message.tenant_id == tenant_id,
            Message.content.ilike(pattern),
        )
        .order_by(Message.timestamp.desc())
    )

    count_q = (
        select(func.count())
        .select_from(Message)
        .where(
            Message.tenant_id == tenant_id,
            Message.content.ilike(pattern),
        )
    )

    total_result = await db.execute(count_q)
    total_count: int = total_result.scalar_one()

    offset = (page - 1) * page_size
    rows_result = await db.execute(base_q.offset(offset).limit(page_size))
    messages = rows_result.scalars().all()

    logger.info(
        "message_search",
        tenant_id=str(tenant_id),
        query=q,
        total_count=total_count,
    )

    return PaginatedResponse[MessageResponse](
        data=[MessageResponse.model_validate(m) for m in messages],
        total_count=total_count,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# POST /{message_id}/read  — mark message as read
# ---------------------------------------------------------------------------


@router.post(
    "/{message_id}/read",
    summary="Mark a message as read",
    description=(
        "Update the delivery status of a message to READ. "
        "The message must belong to the calling user's tenant."
    ),
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
)
async def mark_message_read(
    message_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> MessageResponse:
    """Mark a specific message as READ, scoped to tenant for isolation."""
    result = await db.execute(
        select(Message).where(
            Message.id == message_id,
            Message.tenant_id == tenant_id,
        )
    )
    message = result.scalar_one_or_none()
    if not message:
        raise NotFoundError(f"Message {message_id} not found")

    message.status = "READ"
    await db.flush()

    logger.info(
        "message_marked_read",
        message_id=str(message_id),
        tenant_id=str(tenant_id),
    )

    return MessageResponse.model_validate(message)
