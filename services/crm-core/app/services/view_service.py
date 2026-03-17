"""ViewService — business logic for saved views (ViewSettings)."""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.models.view_settings import ViewSettings
from app.schemas.view_settings import ViewSettingsCreate, ViewSettingsUpdate

logger = structlog.get_logger()


class ViewService:

    async def list_views(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        doctype: str,
    ) -> list[ViewSettings]:
        """Return all views for a doctype visible to this user.

        Visible means: public views + the user's own private views + standard views.
        """
        result = await db.execute(
            select(ViewSettings)
            .where(
                ViewSettings.tenant_id == tenant_id,
                ViewSettings.doctype == doctype,
                or_(
                    ViewSettings.is_public == True,  # noqa: E712
                    ViewSettings.is_standard == True,  # noqa: E712
                    ViewSettings.user_id == user_id,
                ),
            )
            .options(selectinload(ViewSettings.user))
            .order_by(ViewSettings.is_default.desc(), ViewSettings.label.asc())
        )
        return list(result.scalars().all())

    async def get_view(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        view_id: uuid.UUID,
    ) -> ViewSettings:
        result = await db.execute(
            select(ViewSettings)
            .where(
                ViewSettings.tenant_id == tenant_id,
                ViewSettings.id == view_id,
            )
            .options(selectinload(ViewSettings.user))
        )
        view = result.scalar_one_or_none()
        if not view:
            raise NotFoundError(f"View {view_id} not found")
        return view

    async def create_view(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        data: ViewSettingsCreate,
    ) -> ViewSettings:
        # If setting as default, clear other defaults for same doctype+user
        if data.is_default:
            await self._clear_defaults(db, tenant_id, user_id, data.doctype)

        view = ViewSettings(
            tenant_id=tenant_id,
            user_id=None if data.is_public else user_id,
            doctype=data.doctype,
            view_type=data.view_type,
            label=data.label,
            columns_json=data.columns_json,
            rows_json=data.rows_json,
            filters_json=data.filters_json,
            order_by=data.order_by,
            is_default=data.is_default,
            is_public=data.is_public,
            is_standard=False,
        )
        db.add(view)
        await db.flush()

        logger.info(
            "view_created",
            view_id=str(view.id),
            doctype=data.doctype,
            tenant_id=str(tenant_id),
        )
        return view

    async def update_view(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        view_id: uuid.UUID,
        data: ViewSettingsUpdate,
    ) -> ViewSettings:
        view = await self.get_view(db, tenant_id, view_id)

        if view.is_standard:
            raise ForbiddenError("Standard views cannot be modified")

        # Only owner or public view creator can update
        if view.user_id and view.user_id != user_id:
            raise ForbiddenError("You can only modify your own views")

        update_data = data.model_dump(exclude_none=True)

        if update_data.get("is_default"):
            await self._clear_defaults(db, tenant_id, user_id, view.doctype)

        for field, value in update_data.items():
            setattr(view, field, value)

        await db.flush()

        logger.info(
            "view_updated",
            view_id=str(view_id),
            tenant_id=str(tenant_id),
        )
        return view

    async def delete_view(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        view_id: uuid.UUID,
    ) -> None:
        view = await self.get_view(db, tenant_id, view_id)

        if view.is_standard:
            raise ForbiddenError("Standard views cannot be deleted")

        if view.user_id and view.user_id != user_id:
            raise ForbiddenError("You can only delete your own views")

        await db.delete(view)
        await db.flush()

        logger.info(
            "view_deleted",
            view_id=str(view_id),
            tenant_id=str(tenant_id),
        )

    async def _clear_defaults(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        doctype: str,
    ) -> None:
        """Clear is_default on all views for this doctype+user."""
        await db.execute(
            update(ViewSettings)
            .where(
                ViewSettings.tenant_id == tenant_id,
                ViewSettings.doctype == doctype,
                or_(
                    ViewSettings.user_id == user_id,
                    ViewSettings.user_id.is_(None),
                ),
                ViewSettings.is_default == True,  # noqa: E712
            )
            .values(is_default=False)
        )


view_service = ViewService()
