"""Contacts API router — /api/v1/contacts.

All endpoints require a valid Bearer JWT (get_current_user) and resolve the
calling user's tenant automatically (get_tenant_id — populated by
get_current_user via request.state).

Endpoint map:
  GET    /                       list_contacts      — paginated list
  POST   /                       create_contact
  GET    /{contact_id}           get_contact
  PUT    /{contact_id}           update_contact
  DELETE /{contact_id}           delete_contact
  GET    /{contact_id}/deals     list_contact_deals — deals linked to this contact
  POST   /bulk-delete            bulk_delete_contacts

The `filters` query param is a JSON-encoded dict, e.g.:
  GET /api/v1/contacts?filters={"industry_id":"uuid"}
FastAPI does not natively parse nested JSON from query strings, so we add a
custom dependency (_parse_filters) that reads the raw `filters` string and
decodes it before constructing the ContactListParams.
"""

from __future__ import annotations

import json
import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.core.exceptions import BadRequestError
from app.models.deal import Deal
from app.models.user import User
from app.schemas.contact import (
    BulkDeleteRequest,
    BulkDeleteResponse,
    ContactCreate,
    ContactListItem,
    ContactListParams,
    ContactResponse,
    ContactUpdate,
    PaginatedResponse,
)
from app.schemas.deal import DealListItem
from app.services.contact_service import contact_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Custom query-param dependency: parse JSON `filters` string
# ---------------------------------------------------------------------------


def _parse_filters(filters: str | None = Query(None)) -> dict[str, Any] | None:
    """Parse an optional JSON-encoded filters query parameter.

    Example usage in URL:
        GET /contacts?filters={"industry_id":"<uuid>","territory_id":"<uuid>"}
    """
    if not filters:
        return None
    try:
        parsed = json.loads(filters)
    except json.JSONDecodeError as exc:
        raise BadRequestError(f"Invalid JSON in 'filters' parameter: {exc}") from exc
    if not isinstance(parsed, dict):
        raise BadRequestError("'filters' must be a JSON object, e.g. {\"field\": \"value\"}")
    return parsed


# ---------------------------------------------------------------------------
# Dependency: build ContactListParams from individual query-string args.
# ---------------------------------------------------------------------------


def _contact_list_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    order_by: str = Query("created_at desc"),
    search: str | None = Query(None, max_length=200),
    parsed_filters: dict[str, Any] | None = Depends(_parse_filters),
) -> ContactListParams:
    return ContactListParams(
        page=page,
        page_size=page_size,
        order_by=order_by,
        search=search,
        filters=parsed_filters,
    )


ListParams = Annotated[ContactListParams, Depends(_contact_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list contacts
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List contacts",
    description=(
        "Returns a paginated list of Contacts. "
        "Use `search` for full-text search across first_name, last_name, email, "
        "and company_name. "
        "Use `filters` (JSON dict) to narrow results by any Contact field. "
        "Use `order_by` for multi-column sorting (comma-separated 'field dir' tokens)."
    ),
    response_model=PaginatedResponse[ContactListItem],
    status_code=status.HTTP_200_OK,
)
async def list_contacts(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    params: ListParams,
):
    return await contact_service.list_contacts(db, tenant_id, params)


# ---------------------------------------------------------------------------
# POST /  — create contact
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create a contact",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_contact(
    payload: ContactCreate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ContactResponse:
    contact = await contact_service.create_contact(
        db=db,
        tenant_id=tenant_id,
        data=payload,
    )
    return ContactResponse.model_validate(contact)


# ---------------------------------------------------------------------------
# GET /{contact_id}  — get contact detail
# ---------------------------------------------------------------------------


@router.get(
    "/{contact_id}",
    summary="Get contact detail",
    response_model=ContactResponse,
    status_code=status.HTTP_200_OK,
)
async def get_contact(
    contact_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ContactResponse:
    contact = await contact_service.get_contact(db, tenant_id, contact_id)
    return ContactResponse.model_validate(contact)


# ---------------------------------------------------------------------------
# PUT /{contact_id}  — update contact
# ---------------------------------------------------------------------------


@router.put(
    "/{contact_id}",
    summary="Update a contact",
    description="Partial update — only non-null fields in the request body are applied.",
    response_model=ContactResponse,
    status_code=status.HTTP_200_OK,
)
async def update_contact(
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ContactResponse:
    contact = await contact_service.update_contact(
        db=db,
        tenant_id=tenant_id,
        contact_id=contact_id,
        data=payload,
    )
    return ContactResponse.model_validate(contact)


# ---------------------------------------------------------------------------
# DELETE /{contact_id}  — delete contact
# ---------------------------------------------------------------------------


@router.delete(
    "/{contact_id}",
    summary="Delete a contact",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_contact(
    contact_id: uuid.UUID,
    db: DB,
    current_user: User = Depends(require_roles("SUPER_ADMIN", "TENANT_ADMIN", "HEAD", "SALES_MANAGER")),
    tenant_id: TenantId = Depends(get_tenant_id),
):
    await contact_service.delete_contact(db, tenant_id, contact_id)


# ---------------------------------------------------------------------------
# GET /{contact_id}/deals  — list deals linked to this contact
# ---------------------------------------------------------------------------


@router.get(
    "/{contact_id}/deals",
    summary="List deals linked to a contact",
    description=(
        "Returns a paginated list of Deals where contact_id matches this Contact. "
        "Scoped to the calling user's tenant."
    ),
    response_model=PaginatedResponse[DealListItem],
    status_code=status.HTTP_200_OK,
)
async def list_contact_deals(
    contact_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
) -> PaginatedResponse[DealListItem]:
    # Verify the contact exists and belongs to this tenant first.
    await contact_service.get_contact(db, tenant_id, contact_id)

    from sqlalchemy import func

    base_stmt = (
        select(Deal)
        .where(
            Deal.tenant_id == tenant_id,
            Deal.contact_id == contact_id,
        )
        .options(
            selectinload(Deal.status),
            selectinload(Deal.deal_owner),
        )
        .order_by(Deal.created_at.desc())
    )

    count_stmt = (
        select(func.count())
        .select_from(Deal)
        .where(
            Deal.tenant_id == tenant_id,
            Deal.contact_id == contact_id,
        )
    )

    total_result = await db.execute(count_stmt)
    total_count = total_result.scalar_one()

    offset = (page - 1) * page_size
    rows = await db.execute(base_stmt.offset(offset).limit(page_size))
    deals = rows.scalars().all()

    return PaginatedResponse[DealListItem](
        data=[DealListItem.model_validate(deal) for deal in deals],
        total_count=total_count,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# POST /bulk-delete  — bulk delete contacts
# ---------------------------------------------------------------------------


@router.post(
    "/bulk-delete",
    summary="Bulk delete contacts",
    description=(
        "Delete up to 500 contacts in a single request. "
        "Returns the count of contacts that were actually deleted "
        "(IDs not belonging to this tenant are silently skipped)."
    ),
    response_model=BulkDeleteResponse,
    status_code=status.HTTP_200_OK,
)
async def bulk_delete_contacts(
    body: BulkDeleteRequest,
    db: DB,
    current_user: User = Depends(require_roles("SUPER_ADMIN", "TENANT_ADMIN", "HEAD", "SALES_MANAGER")),
    tenant_id: TenantId = Depends(get_tenant_id),
) -> BulkDeleteResponse:
    deleted_count = await contact_service.bulk_delete(
        db=db,
        tenant_id=tenant_id,
        contact_ids=body.ids,
    )
    return BulkDeleteResponse(deleted_count=deleted_count)
