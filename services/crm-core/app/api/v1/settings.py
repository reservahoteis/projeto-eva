"""Settings API router — /api/v1/settings.

Covers status configuration, lookup tables (sources, industries, territories,
lost reasons), and product management.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.models.user import User
from app.schemas.settings import (
    LookupCreate,
    LookupItem,
    ProductCreate,
    ProductItem,
    ProductUpdate,
    StatusCreate,
    StatusItem,
    StatusReorderRequest,
    StatusUpdate,
    TerritoryCreate,
    TerritoryItem,
)
from app.services.settings_service import settings_service

router = APIRouter()

# ---------------------------------------------------------------------------
# Status endpoints (Lead / Deal pipeline stages)
# ---------------------------------------------------------------------------


@router.get("/statuses/{doctype}", summary="List statuses for doctype")
async def list_statuses(
    doctype: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
) -> list[StatusItem]:
    statuses = await settings_service.list_statuses(db, tenant_id, doctype)
    return [StatusItem.model_validate(s) for s in statuses]


@router.post(
    "/statuses/{doctype}",
    summary="Create a new status",
    status_code=status.HTTP_201_CREATED,
)
async def create_status(
    doctype: str,
    data: StatusCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
) -> StatusItem:
    s = await settings_service.create_status(
        db,
        tenant_id,
        doctype,
        label=data.label,
        color=data.color,
        status_type=data.status_type,
        position=data.position,
        probability=data.probability,
    )
    return StatusItem.model_validate(s)


@router.put("/statuses/{doctype}/{status_id}", summary="Update a status")
async def update_status(
    doctype: str,
    status_id: uuid.UUID,
    data: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
) -> StatusItem:
    update_data = data.model_dump(exclude_none=True)
    s = await settings_service.update_status(
        db, tenant_id, doctype, status_id, **update_data
    )
    return StatusItem.model_validate(s)


@router.delete(
    "/statuses/{doctype}/{status_id}",
    summary="Delete a status",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_status(
    doctype: str,
    status_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
) -> None:
    await settings_service.delete_status(db, tenant_id, doctype, status_id)



@router.put("/statuses/{doctype}/reorder", summary="Reorder statuses (drag-drop)")
async def reorder_statuses(
    doctype: str,
    data: StatusReorderRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
) -> list[StatusItem]:
    statuses = await settings_service.reorder_statuses(
        db, tenant_id, doctype, data.ordered_ids
    )
    return [StatusItem.model_validate(s) for s in statuses]


# ---------------------------------------------------------------------------
# Lookup endpoints (generic for lead_source, industry, lost_reason)
# ---------------------------------------------------------------------------


@router.get("/lookups/{lookup_type}", summary="List lookup items")
async def list_lookups(
    lookup_type: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
) -> list[LookupItem]:
    items = await settings_service.list_lookups(db, tenant_id, lookup_type)
    return [LookupItem.model_validate(i) for i in items]


@router.post(
    "/lookups/{lookup_type}",
    summary="Create a lookup item",
    status_code=status.HTTP_201_CREATED,
)
async def create_lookup(
    lookup_type: str,
    data: LookupCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
) -> LookupItem:
    item = await settings_service.create_lookup(db, tenant_id, lookup_type, data.name)

    return LookupItem.model_validate(item)


@router.put("/lookups/{lookup_type}/{item_id}", summary="Update a lookup item")
async def update_lookup(
    lookup_type: str,
    item_id: uuid.UUID,
    data: LookupCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
) -> LookupItem:
    item = await settings_service.update_lookup(
        db, tenant_id, lookup_type, item_id, name=data.name
    )

    return LookupItem.model_validate(item)


@router.delete(
    "/lookups/{lookup_type}/{item_id}",
    summary="Delete a lookup item",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_lookup(
    lookup_type: str,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
) -> None:
    await settings_service.delete_lookup(db, tenant_id, lookup_type, item_id)



# ---------------------------------------------------------------------------
# Territory endpoints (special: has parent_id for hierarchy)
# ---------------------------------------------------------------------------


@router.get("/territories", summary="List territories")
async def list_territories(
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
) -> list[TerritoryItem]:
    items = await settings_service.list_lookups(db, tenant_id, "territory")
    return [TerritoryItem.model_validate(i) for i in items]


@router.post(
    "/territories",
    summary="Create a territory",
    status_code=status.HTTP_201_CREATED,
)
async def create_territory(
    data: TerritoryCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
) -> TerritoryItem:
    item = await settings_service.create_lookup(
        db, tenant_id, "territory", data.name, parent_id=data.parent_id
    )

    return TerritoryItem.model_validate(item)


# ---------------------------------------------------------------------------
# Product endpoints
# ---------------------------------------------------------------------------


@router.get("/products", summary="List products")
async def list_products(
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
) -> list[ProductItem]:
    items = await settings_service.list_lookups(db, tenant_id, "product")
    return [ProductItem.model_validate(i) for i in items]


@router.post(
    "/products",
    summary="Create a product",
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
) -> ProductItem:
    item = await settings_service.create_lookup(
        db,
        tenant_id,
        "product",
        data.name,
        code=data.code,
        rate=data.rate,
        description=data.description,
    )

    return ProductItem.model_validate(item)


@router.put("/products/{product_id}", summary="Update a product")
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
) -> ProductItem:
    update_data = data.model_dump(exclude_none=True)
    item = await settings_service.update_lookup(
        db, tenant_id, "product", product_id, **update_data
    )

    return ProductItem.model_validate(item)


@router.delete(
    "/products/{product_id}",
    summary="Delete a product",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
) -> None:
    await settings_service.delete_lookup(db, tenant_id, "product", product_id)

