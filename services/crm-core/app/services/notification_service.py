"""NotificationService — business logic for in-app notifications."""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.models.notification import Notification
from app.schemas.lead import PaginatedResponse
from app.schemas.notification import (
    NotificationCreate,
    NotificationListItem,
    NotificationListParams,
)

logger = structlog.get_logger()


class NotificationService:

    async def list_notifications(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        params: NotificationListParams,
    ) -> PaginatedResponse[NotificationListItem]:
        base_query = (
            select(Notification)
            .where(
                Notification.tenant_id == tenant_id,
                Notification.to_user_id == user_id,
            )
            .options(selectinload(Notification.from_user))
        )

        if params.read is not None:
            base_query = base_query.where(Notification.read == params.read)

        # Count
        count_query = (
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.tenant_id == tenant_id,
                Notification.to_user_id == user_id,
            )
        )
        if params.read is not None:
            count_query = count_query.where(Notification.read == params.read)
        total_result = await db.execute(count_query)
        total_count = total_result.scalar_one()

        # Paginate
        offset = (params.page - 1) * params.page_size
        data_query = (
            base_query
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(params.page_size)
        )
        rows = await db.execute(data_query)
        notifications = rows.scalars().all()

        return PaginatedResponse[NotificationListItem](
            data=[NotificationListItem.model_validate(n) for n in notifications],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    async def get_unread_count(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> int:
        result = await db.execute(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.tenant_id == tenant_id,
                Notification.to_user_id == user_id,
                Notification.read == False,  # noqa: E712
            )
        )
        return result.scalar_one()

    async def mark_read(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        notification_id: uuid.UUID,
    ) -> None:
        result = await db.execute(
            update(Notification)
            .where(
                Notification.tenant_id == tenant_id,
                Notification.to_user_id == user_id,
                Notification.id == notification_id,
            )
            .values(read=True)
        )
        if result.rowcount == 0:
            raise NotFoundError(f"Notification {notification_id} not found")
        await db.flush()

    async def mark_all_read(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> int:
        result = await db.execute(
            update(Notification)
            .where(
                Notification.tenant_id == tenant_id,
                Notification.to_user_id == user_id,
                Notification.read == False,  # noqa: E712
            )
            .values(read=True)
        )
        await db.flush()
        return result.rowcount

    async def create_notification(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: NotificationCreate,
        from_user_id: uuid.UUID | None = None,
    ) -> Notification:
        notification = Notification(
            tenant_id=tenant_id,
            from_user_id=from_user_id,
            to_user_id=data.to_user_id,
            notification_type=data.notification_type,
            message=data.message,
            reference_doctype=data.reference_doctype,
            reference_docname=data.reference_docname,
        )
        db.add(notification)
        await db.flush()
        logger.info(
            "notification_created",
            notification_id=str(notification.id),
            to_user_id=str(data.to_user_id),
            tenant_id=str(tenant_id),
        )
        return notification


notification_service = NotificationService()
