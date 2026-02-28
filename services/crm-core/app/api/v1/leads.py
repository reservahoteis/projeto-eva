"""FastAPI router for the Lead resource — /api/v1/leads.

All endpoints require a valid Bearer JWT (get_current_user) and resolve the
calling user's tenant automatically (get_tenant_id — populated by
get_current_user via request.state).

Endpoint map:
  GET    /                       list_leads      — list / kanban / group_by
  POST   /                       create_lead
  GET    /{lead_id}               get_lead
  PUT    /{lead_id}               update_lead
  DELETE /{lead_id}               delete_lead
  POST   /{lead_id}/convert       convert_to_deal
  POST   /{lead_id}/assign        assign_lead
  DELETE /{lead_id}/assign        remove_assignment
  POST   /bulk-delete             bulk_delete

Query parameters for GET / are modelled as a Pydantic model (LeadListParams)
and injected via Depends — FastAPI maps query-string keys to the model fields.

The `filters` query param is a JSON-encoded dict, e.g.:
  GET /api/v1/leads?filters={"status_id":"uuid","converted":false}
FastAPI does not natively parse nested JSON from query strings, so we add a
custom dependency (_parse_filters) that reads the raw `filters` string and
decodes it before constructing the LeadListParams.
"""

from __future__ import annotations

import json
import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.core.exceptions import BadRequestError
from app.models.user import User
from app.schemas.lead import (
    AssignmentResponse,
    AssignRequest,
    BulkDeleteRequest,
    BulkDeleteResponse,
    ConvertToDealResponse,
    LeadCreate,
    LeadListItem,
    LeadListParams,
    LeadResponse,
    LeadUpdate,
    PaginatedResponse,
    KanbanResponse,
    GroupByResponse,
)
from app.services.lead_service import lead_service

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
        GET /leads?filters={"converted":false,"status_id":"<uuid>"}
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
# Dependency: build LeadListParams from individual query-string args.
#
# FastAPI can bind a Pydantic model from query params directly, but the
# `filters` field requires JSON decoding — so we construct it manually.
# ---------------------------------------------------------------------------


def _lead_list_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    order_by: str = Query("created_at desc"),
    view_type: str = Query("list"),
    column_field: str | None = Query(None),
    group_by_field: str | None = Query(None),
    parsed_filters: dict[str, Any] | None = Depends(_parse_filters),
) -> LeadListParams:
    return LeadListParams(
        page=page,
        page_size=page_size,
        order_by=order_by,
        view_type=view_type,  # type: ignore[arg-type]
        column_field=column_field,
        group_by_field=group_by_field,
        filters=parsed_filters,
    )


ListParams = Annotated[LeadListParams, Depends(_lead_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list leads
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List leads",
    description=(
        "Returns a paginated list, a kanban board, or a group_by aggregation "
        "depending on the `view_type` query param. "
        "Use `filters` (JSON dict) to narrow results by any Lead field. "
        "Use `order_by` for multi-column sorting (comma-separated 'field dir' tokens)."
    ),
    response_model=PaginatedResponse[LeadListItem],
    # Note: Kanban / GroupBy responses have different shapes.
    # FastAPI will still serialise them correctly at runtime because we return
    # the raw Pydantic models — response_model is set to the common case for
    # OpenAPI doc generation.
    status_code=status.HTTP_200_OK,
)
async def list_leads(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    params: ListParams,
):
    return await lead_service.list_leads(db, tenant_id, params)


# ---------------------------------------------------------------------------
# POST /  — create lead
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create a lead",
    response_model=LeadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_lead(
    payload: LeadCreate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> LeadResponse:
    lead = await lead_service.create_lead(
        db=db,
        tenant_id=tenant_id,
        data=payload,
        user_id=current_user.id,
    )
    return LeadResponse.model_validate(lead)


# ---------------------------------------------------------------------------
# GET /{lead_id}  — get lead detail
# ---------------------------------------------------------------------------


@router.get(
    "/{lead_id}",
    summary="Get lead detail",
    response_model=LeadResponse,
    status_code=status.HTTP_200_OK,
)
async def get_lead(
    lead_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> LeadResponse:
    lead = await lead_service.get_lead(db, tenant_id, lead_id)
    return LeadResponse.model_validate(lead)


# ---------------------------------------------------------------------------
# PUT /{lead_id}  — update lead
# ---------------------------------------------------------------------------


@router.put(
    "/{lead_id}",
    summary="Update a lead",
    description="Partial update — only non-null fields in the request body are applied.",
    response_model=LeadResponse,
    status_code=status.HTTP_200_OK,
)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> LeadResponse:
    lead = await lead_service.update_lead(
        db=db,
        tenant_id=tenant_id,
        lead_id=lead_id,
        data=payload,
        user_id=current_user.id,
    )
    return LeadResponse.model_validate(lead)


# ---------------------------------------------------------------------------
# DELETE /{lead_id}  — delete lead
# ---------------------------------------------------------------------------


@router.delete(
    "/{lead_id}",
    summary="Delete a lead",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_lead(
    lead_id: uuid.UUID,
    db: DB,
    current_user: User = Depends(require_roles("SUPER_ADMIN", "TENANT_ADMIN", "HEAD", "SALES_MANAGER")),
    tenant_id: TenantId = Depends(get_tenant_id),
):
    await lead_service.delete_lead(db, tenant_id, lead_id)


# ---------------------------------------------------------------------------
# POST /{lead_id}/convert  — convert lead to deal
# ---------------------------------------------------------------------------


@router.post(
    "/{lead_id}/convert",
    summary="Convert lead to deal",
    description=(
        "Creates a new Deal from the Lead's contact snapshot, marks the Lead "
        "as converted, and returns the new Deal. "
        "Requires at least one DealStatus to be configured for the tenant."
    ),
    response_model=ConvertToDealResponse,
    status_code=status.HTTP_201_CREATED,
)
async def convert_to_deal(
    lead_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ConvertToDealResponse:
    deal = await lead_service.convert_to_deal(
        db=db,
        tenant_id=tenant_id,
        lead_id=lead_id,
        user_id=current_user.id,
    )
    return ConvertToDealResponse.model_validate(deal)


# ---------------------------------------------------------------------------
# POST /{lead_id}/assign  — assign lead to user
# ---------------------------------------------------------------------------


@router.post(
    "/{lead_id}/assign",
    summary="Assign lead to a user",
    description=(
        "Creates an Assignment record linking this lead to the target user. "
        "Idempotent — if an open assignment already exists for the same user, "
        "it is returned unchanged."
    ),
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_lead(
    lead_id: uuid.UUID,
    body: AssignRequest,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> AssignmentResponse:
    assignment = await lead_service.assign_lead(
        db=db,
        tenant_id=tenant_id,
        lead_id=lead_id,
        assignee_id=body.user_id,
        assigner_id=current_user.id,
    )
    return AssignmentResponse.model_validate(assignment)


# ---------------------------------------------------------------------------
# DELETE /{lead_id}/assign  — remove assignment
# ---------------------------------------------------------------------------


@router.delete(
    "/{lead_id}/assign",
    summary="Remove a user assignment from a lead",
    description="Cancels the open Assignment for the specified user_id query param.",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_assignment(
    lead_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    user_id: uuid.UUID = Query(..., description="ID of the user whose assignment to cancel"),
):
    await lead_service.remove_assignment(
        db=db,
        tenant_id=tenant_id,
        lead_id=lead_id,
        assignee_id=user_id,
    )


# ---------------------------------------------------------------------------
# POST /bulk-delete  — bulk delete leads
# ---------------------------------------------------------------------------


@router.post(
    "/bulk-delete",
    summary="Bulk delete leads",
    description=(
        "Delete up to 500 leads in a single request. "
        "Returns the count of leads that were actually deleted "
        "(IDs not belonging to this tenant are silently skipped)."
    ),
    response_model=BulkDeleteResponse,
    status_code=status.HTTP_200_OK,
)
async def bulk_delete_leads(
    body: BulkDeleteRequest,
    db: DB,
    current_user: User = Depends(require_roles("SUPER_ADMIN", "TENANT_ADMIN", "HEAD", "SALES_MANAGER")),
    tenant_id: TenantId = Depends(get_tenant_id),
) -> BulkDeleteResponse:
    deleted_count = await lead_service.bulk_delete(
        db=db,
        tenant_id=tenant_id,
        lead_ids=body.ids,
    )
    return BulkDeleteResponse(deleted_count=deleted_count)
