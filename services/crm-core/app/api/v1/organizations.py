"""Organizations API router — /api/v1/organizations.

All endpoints require a valid Bearer JWT (get_current_user) and resolve the
calling user's tenant automatically (get_tenant_id — populated by
get_current_user via request.state).

Endpoint map:
  GET    /                            list_organizations
  POST   /                            create_organization
  GET    /{organization_id}           get_organization
  PUT    /{organization_id}           update_organization
  DELETE /{organization_id}           delete_organization
  GET    /{organization_id}/deals     list_organization_deals
  GET    /{organization_id}/contacts  list_organization_contacts
  POST   /bulk-delete                 bulk_delete_organizations

The `filters` query param is a JSON-encoded dict, e.g.:
  GET /api/v1/organizations?filters={"industry_id":"uuid"}
"""

from __future__ import annotations

import json
import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.core.exceptions import BadRequestError
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.user import User
from app.schemas.contact import ContactListItem, PaginatedResponse
from app.schemas.deal import DealListItem
from app.schemas.organization import (
    BulkDeleteRequest,
    BulkDeleteResponse,
    OrganizationCreate,
    OrganizationListItem,
    OrganizationListParams,
    OrganizationResponse,
    OrganizationUpdate,
)
from app.services.organization_service import organization_service

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
        GET /organizations?filters={"industry_id":"<uuid>"}
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
# Dependency: build OrganizationListParams from individual query-string args.
# ---------------------------------------------------------------------------


def _org_list_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    order_by: str = Query("created_at desc"),
    search: str | None = Query(None, max_length=200),
    parsed_filters: dict[str, Any] | None = Depends(_parse_filters),
) -> OrganizationListParams:
    return OrganizationListParams(
        page=page,
        page_size=page_size,
        order_by=order_by,
        search=search,
        filters=parsed_filters,
    )


ListParams = Annotated[OrganizationListParams, Depends(_org_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list organizations
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List organizations",
    description=(
        "Returns a paginated list of Organizations. "
        "Use `search` for a case-insensitive match across organization_name and website. "
        "Use `filters` (JSON dict) to narrow results by any Organization field. "
        "Use `order_by` for multi-column sorting (comma-separated 'field dir' tokens)."
    ),
    response_model=PaginatedResponse[OrganizationListItem],
    status_code=status.HTTP_200_OK,
)
async def list_organizations(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    params: ListParams,
):
    return await organization_service.list_organizations(db, tenant_id, params)


# ---------------------------------------------------------------------------
# POST /  — create organization
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create an organization",
    description=(
        "Creates a new Organization. "
        "organization_name must be unique within the tenant — returns 409 on conflict."
    ),
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_organization(
    payload: OrganizationCreate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> OrganizationResponse:
    org = await organization_service.create_organization(
        db=db,
        tenant_id=tenant_id,
        data=payload,
    )
    return OrganizationResponse.model_validate(org)


# ---------------------------------------------------------------------------
# GET /{organization_id}  — get organization detail
# ---------------------------------------------------------------------------


@router.get(
    "/{organization_id}",
    summary="Get organization detail",
    response_model=OrganizationResponse,
    status_code=status.HTTP_200_OK,
)
async def get_organization(
    organization_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> OrganizationResponse:
    org = await organization_service.get_organization(db, tenant_id, organization_id)
    return OrganizationResponse.model_validate(org)


# ---------------------------------------------------------------------------
# PUT /{organization_id}  — update organization
# ---------------------------------------------------------------------------


@router.put(
    "/{organization_id}",
    summary="Update an organization",
    description=(
        "Partial update — only non-null fields in the request body are applied. "
        "Renaming an organization checks uniqueness within the tenant."
    ),
    response_model=OrganizationResponse,
    status_code=status.HTTP_200_OK,
)
async def update_organization(
    organization_id: uuid.UUID,
    payload: OrganizationUpdate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> OrganizationResponse:
    org = await organization_service.update_organization(
        db=db,
        tenant_id=tenant_id,
        organization_id=organization_id,
        data=payload,
    )
    return OrganizationResponse.model_validate(org)


# ---------------------------------------------------------------------------
# DELETE /{organization_id}  — delete organization
# ---------------------------------------------------------------------------


@router.delete(
    "/{organization_id}",
    summary="Delete an organization",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_organization(
    organization_id: uuid.UUID,
    db: DB,
    current_user: User = Depends(require_roles("SUPER_ADMIN", "TENANT_ADMIN", "HEAD", "SALES_MANAGER")),
    tenant_id: TenantId = Depends(get_tenant_id),
):
    await organization_service.delete_organization(db, tenant_id, organization_id)


# ---------------------------------------------------------------------------
# GET /{organization_id}/deals  — list deals linked to this organization
# ---------------------------------------------------------------------------


@router.get(
    "/{organization_id}/deals",
    summary="List deals linked to an organization",
    description=(
        "Returns a paginated list of Deals where organization_id matches this "
        "Organization. Scoped to the calling user's tenant."
    ),
    response_model=PaginatedResponse[DealListItem],
    status_code=status.HTTP_200_OK,
)
async def list_organization_deals(
    organization_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
) -> PaginatedResponse[DealListItem]:
    # Verify the organization exists and belongs to this tenant first.
    await organization_service.get_organization(db, tenant_id, organization_id)

    base_stmt = (
        select(Deal)
        .where(
            Deal.tenant_id == tenant_id,
            Deal.organization_id == organization_id,
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
            Deal.organization_id == organization_id,
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
# GET /{organization_id}/contacts  — list contacts linked to this organization
# ---------------------------------------------------------------------------


@router.get(
    "/{organization_id}/contacts",
    summary="List contacts linked to an organization",
    description=(
        "Returns a paginated list of Contacts whose company_name matches the "
        "organization name, or that have been explicitly associated via deals. "
        "This endpoint resolves the association through the Deals table: "
        "a Contact appears here when at least one Deal links both this "
        "organization_id and that contact_id within the tenant."
    ),
    response_model=PaginatedResponse[ContactListItem],
    status_code=status.HTTP_200_OK,
)
async def list_organization_contacts(
    organization_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
) -> PaginatedResponse[ContactListItem]:
    # Verify the organization exists and belongs to this tenant first.
    await organization_service.get_organization(db, tenant_id, organization_id)

    # Resolve linked contacts: contacts referenced by deals for this organization.
    # We use a subquery on Deal.contact_id to avoid an N+1 pattern.
    linked_contact_ids_subq = (
        select(Deal.contact_id)
        .where(
            Deal.tenant_id == tenant_id,
            Deal.organization_id == organization_id,
            Deal.contact_id.is_not(None),
        )
        .distinct()
        .scalar_subquery()
    )

    base_stmt = (
        select(Contact)
        .where(
            Contact.tenant_id == tenant_id,
            Contact.id.in_(linked_contact_ids_subq),
        )
        .options(
            selectinload(Contact.industry),
            selectinload(Contact.territory),
        )
        .order_by(Contact.created_at.desc())
    )

    count_stmt = (
        select(func.count())
        .select_from(Contact)
        .where(
            Contact.tenant_id == tenant_id,
            Contact.id.in_(linked_contact_ids_subq),
        )
    )

    total_result = await db.execute(count_stmt)
    total_count = total_result.scalar_one()

    offset = (page - 1) * page_size
    rows = await db.execute(base_stmt.offset(offset).limit(page_size))
    contacts = rows.scalars().all()

    return PaginatedResponse[ContactListItem](
        data=[ContactListItem.model_validate(contact) for contact in contacts],
        total_count=total_count,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# POST /bulk-delete  — bulk delete organizations
# ---------------------------------------------------------------------------


@router.post(
    "/bulk-delete",
    summary="Bulk delete organizations",
    description=(
        "Delete up to 500 organizations in a single request. "
        "Returns the count of organizations that were actually deleted "
        "(IDs not belonging to this tenant are silently skipped)."
    ),
    response_model=BulkDeleteResponse,
    status_code=status.HTTP_200_OK,
)
async def bulk_delete_organizations(
    body: BulkDeleteRequest,
    db: DB,
    current_user: User = Depends(require_roles("SUPER_ADMIN", "TENANT_ADMIN", "HEAD", "SALES_MANAGER")),
    tenant_id: TenantId = Depends(get_tenant_id),
) -> BulkDeleteResponse:
    deleted_count = await organization_service.bulk_delete(
        db=db,
        tenant_id=tenant_id,
        organization_ids=body.ids,
    )
    return BulkDeleteResponse(deleted_count=deleted_count)
