"""SettingsService — CRUD for lookup/config tables (statuses, sources, etc.)."""

from __future__ import annotations

import uuid
from typing import Any, Type

import structlog
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models.base import TenantBase
from app.models.lookups import (
    DealStatus,
    Industry,
    LeadSource,
    LeadStatus,
    LostReason,
    Product,
    Territory,
)

logger = structlog.get_logger()

# Mapping of doctype string to status model
_STATUS_MODELS: dict[str, Type[LeadStatus] | Type[DealStatus]] = {
    "Lead": LeadStatus,
    "Deal": DealStatus,
}

# Mapping of lookup type string to model
_LOOKUP_MODELS: dict[str, Type[TenantBase]] = {
    "lead_source": LeadSource,
    "industry": Industry,
    "territory": Territory,
    "lost_reason": LostReason,
    "product": Product,
}


class SettingsService:

    # ------------------------------------------------------------------
    # Statuses (Lead/Deal)
    # ------------------------------------------------------------------

    async def list_statuses(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        doctype: str,
    ) -> list[Any]:
        model = self._get_status_model(doctype)
        result = await db.execute(
            select(model)
            .where(model.tenant_id == tenant_id)
            .order_by(model.position.asc())
        )
        return list(result.scalars().all())

    async def create_status(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        doctype: str,
        label: str,
        color: str = "#gray",
        status_type: str | None = None,
        position: int | None = None,
        probability: float | None = None,
    ) -> Any:
        model = self._get_status_model(doctype)

        # Auto-assign position if not provided
        if position is None:
            result = await db.execute(
                select(func.coalesce(func.max(model.position), -1) + 1)
                .where(model.tenant_id == tenant_id)
            )
            position = result.scalar_one()

        kwargs: dict[str, Any] = {
            "tenant_id": tenant_id,
            "label": label,
            "color": color,
            "status_type": status_type,
            "position": position,
        }
        if doctype == "Deal" and probability is not None:
            kwargs["probability"] = probability

        status = model(**kwargs)
        db.add(status)
        await db.flush()

        logger.info(
            "status_created",
            doctype=doctype,
            label=label,
            tenant_id=str(tenant_id),
        )
        return status

    async def update_status(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        doctype: str,
        status_id: uuid.UUID,
        **kwargs: Any,
    ) -> Any:
        model = self._get_status_model(doctype)
        result = await db.execute(
            select(model).where(
                model.tenant_id == tenant_id,
                model.id == status_id,
            )
        )
        status = result.scalar_one_or_none()
        if not status:
            raise NotFoundError(f"{doctype} status {status_id} not found")

        for field, value in kwargs.items():
            if value is not None and hasattr(status, field):
                setattr(status, field, value)

        await db.flush()
        return status

    async def delete_status(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        doctype: str,
        status_id: uuid.UUID,
    ) -> None:
        model = self._get_status_model(doctype)
        result = await db.execute(
            select(model).where(
                model.tenant_id == tenant_id,
                model.id == status_id,
            )
        )
        status = result.scalar_one_or_none()
        if not status:
            raise NotFoundError(f"{doctype} status {status_id} not found")

        await db.delete(status)
        await db.flush()

    async def reorder_statuses(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        doctype: str,
        ordered_ids: list[uuid.UUID],
    ) -> list[Any]:
        model = self._get_status_model(doctype)

        for position, status_id in enumerate(ordered_ids):
            await db.execute(
                update(model)
                .where(
                    model.tenant_id == tenant_id,
                    model.id == status_id,
                )
                .values(position=position)
            )
        await db.flush()

        return await self.list_statuses(db, tenant_id, doctype)

    # ------------------------------------------------------------------
    # Lookups (generic CRUD for simple name-based tables)
    # ------------------------------------------------------------------

    async def list_lookups(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        lookup_type: str,
    ) -> list[Any]:
        model = self._get_lookup_model(lookup_type)
        result = await db.execute(
            select(model)
            .where(model.tenant_id == tenant_id)
            .order_by(model.name.asc() if hasattr(model, "name") else model.id.asc())
        )
        return list(result.scalars().all())

    async def create_lookup(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        lookup_type: str,
        name: str,
        **kwargs: Any,
    ) -> Any:
        model = self._get_lookup_model(lookup_type)
        item = model(tenant_id=tenant_id, name=name, **kwargs)
        db.add(item)
        await db.flush()
        return item

    async def update_lookup(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        lookup_type: str,
        item_id: uuid.UUID,
        **kwargs: Any,
    ) -> Any:
        model = self._get_lookup_model(lookup_type)
        result = await db.execute(
            select(model).where(
                model.tenant_id == tenant_id,
                model.id == item_id,
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            raise NotFoundError(f"{lookup_type} item {item_id} not found")

        for field, value in kwargs.items():
            if value is not None and hasattr(item, field):
                setattr(item, field, value)

        await db.flush()
        return item

    async def delete_lookup(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        lookup_type: str,
        item_id: uuid.UUID,
    ) -> None:
        model = self._get_lookup_model(lookup_type)
        result = await db.execute(
            select(model).where(
                model.tenant_id == tenant_id,
                model.id == item_id,
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            raise NotFoundError(f"{lookup_type} item {item_id} not found")

        await db.delete(item)
        await db.flush()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_status_model(doctype: str) -> Type[LeadStatus] | Type[DealStatus]:
        model = _STATUS_MODELS.get(doctype)
        if not model:
            raise BadRequestError(
                f"Invalid doctype '{doctype}'. Must be one of: {list(_STATUS_MODELS.keys())}"
            )
        return model

    @staticmethod
    def _get_lookup_model(lookup_type: str) -> Type[TenantBase]:
        model = _LOOKUP_MODELS.get(lookup_type)
        if not model:
            raise BadRequestError(
                f"Invalid lookup_type '{lookup_type}'. Must be one of: {list(_LOOKUP_MODELS.keys())}"
            )
        return model


settings_service = SettingsService()
