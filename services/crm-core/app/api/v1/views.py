"""Views API router — /api/v1/views."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id
from app.models.user import User
from app.schemas.view_settings import (
    ViewSettingsCreate,
    ViewSettingsResponse,
    ViewSettingsUpdate,
)
from app.services.view_service import view_service

router = APIRouter()


@router.get("/{doctype}", summary="List saved views for a doctype")
async def list_views(
    doctype: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> list[ViewSettingsResponse]:
    views = await view_service.list_views(db, tenant_id, current_user.id, doctype)
    return [ViewSettingsResponse.model_validate(v) for v in views]


@router.post("/", summary="Create a saved view", status_code=status.HTTP_201_CREATED)
async def create_view(
    data: ViewSettingsCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> ViewSettingsResponse:
    view = await view_service.create_view(db, tenant_id, current_user.id, data)
    return ViewSettingsResponse.model_validate(view)


@router.put("/{view_id}", summary="Update a saved view")
async def update_view(
    view_id: uuid.UUID,
    data: ViewSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> ViewSettingsResponse:
    view = await view_service.update_view(
        db, tenant_id, current_user.id, view_id, data
    )
    return ViewSettingsResponse.model_validate(view)


@router.delete(
    "/{view_id}",
    summary="Delete a saved view",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_view(
    view_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
):
    await view_service.delete_view(db, tenant_id, current_user.id, view_id)
