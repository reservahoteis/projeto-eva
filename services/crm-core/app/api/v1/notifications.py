"""Notifications API router — /api/v1/notifications."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id
from app.models.user import User
from app.schemas.lead import PaginatedResponse
from app.schemas.notification import (
    MarkReadResponse,
    NotificationListItem,
    NotificationListParams,
    NotificationResponse,
    UnreadCountResponse,
)
from app.services.notification_service import notification_service

router = APIRouter()


@router.get("/", summary="List my notifications")
async def list_notifications(
    page: int = 1,
    page_size: int = 20,
    read: bool | None = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[NotificationListItem]:
    params = NotificationListParams(page=page, page_size=page_size, read=read)
    return await notification_service.list_notifications(
        db, tenant_id, current_user.id, params
    )


@router.get("/unread-count", summary="Get unread notification count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
) -> UnreadCountResponse:
    count = await notification_service.get_unread_count(
        db, tenant_id, current_user.id
    )
    return UnreadCountResponse(count=count)


@router.put(
    "/{notification_id}/read",
    summary="Mark notification as read",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def mark_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
) -> None:
    await notification_service.mark_read(
        db, tenant_id, current_user.id, notification_id
    )


@router.put("/read-all", summary="Mark all notifications as read")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
) -> MarkReadResponse:
    count = await notification_service.mark_all_read(
        db, tenant_id, current_user.id
    )
    return MarkReadResponse(updated_count=count)
