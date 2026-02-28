"""Deal API router — /api/v1/deals.

Endpoints
---------
GET    /              — paginated list
POST   /              — create
GET    /{deal_id}     — detail
PUT    /{deal_id}     — update (partial / full)
DELETE /{deal_id}     — delete
POST   /{deal_id}/won    — mark as won
POST   /{deal_id}/lost   — mark as lost
POST   /{deal_id}/assign — assign to user
POST   /bulk-delete      — delete multiple deals
"""

from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.models.assignment import Assignment
from app.models.user import User
from app.schemas.deal import (
    AssignRequest,
    BulkDeleteRequest,
    DealCreate,
    DealResponse,
    DealUpdate,
    MarkLostRequest,
    PaginatedDeals,
)
from app.services.deal_service import DealListParams, DealService

logger = structlog.get_logger()

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /deals — list
# ---------------------------------------------------------------------------


@router.get("/", response_model=PaginatedDeals, summary="List deals")
async def list_deals(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Records per page"),
    status_id: uuid.UUID | None = Query(None, description="Filter by deal status"),
    deal_owner_id: uuid.UUID | None = Query(None, description="Filter by deal owner user"),
    organization_id: uuid.UUID | None = Query(None, description="Filter by organization"),
    search: str | None = Query(None, description="Full-text search on name / email / org"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> PaginatedDeals:
    """Return a paginated list of deals for the authenticated tenant.

    Results are ordered by creation date descending (newest first).
    """
    params = DealListParams(
        page=page,
        page_size=page_size,
        status_id=status_id,
        deal_owner_id=deal_owner_id,
        organization_id=organization_id,
        search=search,
    )
    return await DealService.list_deals(db, tenant_id, params)


# ---------------------------------------------------------------------------
# POST /deals — create
# ---------------------------------------------------------------------------


@router.post(
    "/",
    response_model=DealResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a deal",
)
async def create_deal(
    body: DealCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> DealResponse:
    """Create a new deal record for the authenticated tenant.

    Automatically generates a naming series (CRM-DEAL-{year}-{seq}) and
    validates that the requested status_id belongs to this tenant.
    """
    deal = await DealService.create_deal(db, tenant_id, body, current_user.id)
    return DealResponse.model_validate(deal)


# ---------------------------------------------------------------------------
# POST /deals/bulk-delete — bulk delete (before /{deal_id} to avoid clash)
# ---------------------------------------------------------------------------


@router.post(
    "/bulk-delete",
    summary="Bulk delete deals",
    status_code=status.HTTP_200_OK,
)
async def bulk_delete_deals(
    body: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "TENANT_ADMIN", "HEAD", "SALES_MANAGER")),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> dict:
    """Delete multiple deals in a single request.

    Returns the count of records actually deleted.  IDs that do not belong to
    this tenant are silently skipped (no error raised).
    """
    deleted = await DealService.bulk_delete(db, tenant_id, body)
    return {"deleted": deleted, "requested": len(body.ids)}


# ---------------------------------------------------------------------------
# GET /deals/{deal_id} — detail
# ---------------------------------------------------------------------------


@router.get("/{deal_id}", response_model=DealResponse, summary="Get deal detail")
async def get_deal(
    deal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> DealResponse:
    """Retrieve a single deal by ID, including all nested relationships."""
    deal = await DealService.get_deal(db, tenant_id, deal_id)
    return DealResponse.model_validate(deal)


# ---------------------------------------------------------------------------
# PUT /deals/{deal_id} — update
# ---------------------------------------------------------------------------


@router.put("/{deal_id}", response_model=DealResponse, summary="Update deal")
async def update_deal(
    deal_id: uuid.UUID,
    body: DealUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> DealResponse:
    """Partially update a deal.

    Only fields included in the request body are written — unset fields
    retain their current database values.
    """
    deal = await DealService.update_deal(db, tenant_id, deal_id, body)
    return DealResponse.model_validate(deal)


# ---------------------------------------------------------------------------
# DELETE /deals/{deal_id} — delete
# ---------------------------------------------------------------------------


@router.delete(
    "/{deal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete deal",
)
async def delete_deal(
    deal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "TENANT_ADMIN", "HEAD", "SALES_MANAGER")),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
):
    """Permanently delete a single deal."""
    await DealService.delete_deal(db, tenant_id, deal_id)


# ---------------------------------------------------------------------------
# POST /deals/{deal_id}/won — mark as won
# ---------------------------------------------------------------------------


@router.post("/{deal_id}/won", response_model=DealResponse, summary="Mark deal as won")
async def mark_deal_won(
    deal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> DealResponse:
    """Transition the deal to the tenant's Won pipeline stage.

    Sets ``closed_date`` to today.  Requires at least one DealStatus with
    ``status_type='Won'`` configured for this tenant.
    """
    deal = await DealService.mark_won(db, tenant_id, deal_id)
    return DealResponse.model_validate(deal)


# ---------------------------------------------------------------------------
# POST /deals/{deal_id}/lost — mark as lost
# ---------------------------------------------------------------------------


@router.post("/{deal_id}/lost", response_model=DealResponse, summary="Mark deal as lost")
async def mark_deal_lost(
    deal_id: uuid.UUID,
    body: MarkLostRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> DealResponse:
    """Transition the deal to the tenant's Lost pipeline stage.

    Records the disqualification reason and optional notes.  Requires at
    least one DealStatus with ``status_type='Lost'`` configured for this
    tenant.
    """
    deal = await DealService.mark_lost(db, tenant_id, deal_id, body)
    return DealResponse.model_validate(deal)


# ---------------------------------------------------------------------------
# POST /deals/{deal_id}/assign — assign to user
# ---------------------------------------------------------------------------


@router.post(
    "/{deal_id}/assign",
    status_code=status.HTTP_201_CREATED,
    summary="Assign deal to a user",
)
async def assign_deal(
    deal_id: uuid.UUID,
    body: AssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> dict:
    """Assign a deal to a team member.

    Creates an Assignment record and updates ``deal.deal_owner_id`` for
    fast denormalised reads.  Returns the new assignment details.
    """
    assignment: Assignment = await DealService.assign_deal(
        db, tenant_id, deal_id, body, assigner_id=current_user.id
    )
    return {
        "assignment_id": str(assignment.id),
        "deal_id": str(deal_id),
        "assignee_id": str(assignment.assigned_to_id),
        "assigner_id": str(assignment.assigned_by_id),
        "status": assignment.status,
        "created_at": assignment.created_at.isoformat(),
    }
