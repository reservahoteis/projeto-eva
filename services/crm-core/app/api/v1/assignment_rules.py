"""FastAPI router for Assignment Rules — /api/v1/assignment-rules.

Endpoint map:
  GET    /                    list_rules       — any authenticated user
  POST   /                    create_rule      — ADMIN / SUPER_ADMIN only
  GET    /{rule_id}            get_rule         — any authenticated user
  PUT    /{rule_id}            update_rule      — ADMIN / SUPER_ADMIN only
  DELETE /{rule_id}            delete_rule      — ADMIN / SUPER_ADMIN only

AssignmentRuleResponse.user_ids is built by parsing rule.users_json at the
service layer via AssignmentRuleService.extract_user_ids() so the response
schema never exposes the internal JSON storage format.
"""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.models.assignment import AssignmentRule
from app.models.user import User
from app.schemas.assignment_rule import (
    AssignmentRuleCreate,
    AssignmentRuleResponse,
    AssignmentRuleUpdate,
)
from app.services.assignment_rule_service import assignment_rule_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_roles("ADMIN", "SUPER_ADMIN"))]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]

# ---------------------------------------------------------------------------
# Internal conversion helper
# ---------------------------------------------------------------------------


def _rule_to_response(rule: AssignmentRule) -> AssignmentRuleResponse:
    """Convert an ORM AssignmentRule to the Pydantic response schema.

    AssignmentRuleResponse.user_ids is not a direct ORM attribute — it is
    derived by parsing users_json.  Therefore we cannot use model_validate()
    directly; we build the response manually.
    """
    return AssignmentRuleResponse(
        id=rule.id,
        tenant_id=rule.tenant_id,
        name=rule.name,
        doctype=rule.doctype,
        assign_condition=rule.assign_condition,
        assignment_type=rule.assignment_type,
        user_ids=assignment_rule_service.extract_user_ids(rule),
        enabled=rule.enabled,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


# ---------------------------------------------------------------------------
# GET /  — list rules
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List assignment rules",
    description="Returns all assignment rules configured for the tenant.",
    response_model=list[AssignmentRuleResponse],
    status_code=status.HTTP_200_OK,
)
async def list_rules(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> list[AssignmentRuleResponse]:
    rules = await assignment_rule_service.list_rules(db, tenant_id)
    return [_rule_to_response(r) for r in rules]


# ---------------------------------------------------------------------------
# POST /  — create rule
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create an assignment rule",
    description=(
        "Creates an automated assignment rule for Lead or Deal documents. "
        "Supports round_robin and load_balancing strategies. "
        "Requires ADMIN or SUPER_ADMIN role."
    ),
    response_model=AssignmentRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_rule(
    payload: AssignmentRuleCreate,
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
) -> AssignmentRuleResponse:
    rule = await assignment_rule_service.create_rule(
        db=db, tenant_id=tenant_id, data=payload
    )
    return _rule_to_response(rule)


# ---------------------------------------------------------------------------
# GET /{rule_id}  — get rule detail
# ---------------------------------------------------------------------------


@router.get(
    "/{rule_id}",
    summary="Get assignment rule detail",
    response_model=AssignmentRuleResponse,
    status_code=status.HTTP_200_OK,
)
async def get_rule(
    rule_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> AssignmentRuleResponse:
    rule = await assignment_rule_service.get_rule(db, tenant_id, rule_id)
    return _rule_to_response(rule)


# ---------------------------------------------------------------------------
# PUT /{rule_id}  — update rule
# ---------------------------------------------------------------------------


@router.put(
    "/{rule_id}",
    summary="Update an assignment rule",
    description=(
        "Partial update of an assignment rule. "
        "When `user_ids` is provided it REPLACES the current pool and resets "
        "the round-robin index to 0. "
        "Requires ADMIN or SUPER_ADMIN role."
    ),
    response_model=AssignmentRuleResponse,
    status_code=status.HTTP_200_OK,
)
async def update_rule(
    rule_id: uuid.UUID,
    payload: AssignmentRuleUpdate,
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
) -> AssignmentRuleResponse:
    rule = await assignment_rule_service.update_rule(
        db=db, tenant_id=tenant_id, rule_id=rule_id, data=payload
    )
    return _rule_to_response(rule)


# ---------------------------------------------------------------------------
# DELETE /{rule_id}  — delete rule
# ---------------------------------------------------------------------------


@router.delete(
    "/{rule_id}",
    summary="Delete an assignment rule",
    description=(
        "Hard-deletes the assignment rule. "
        "Existing Assignment records created by this rule are NOT affected. "
        "Requires ADMIN or SUPER_ADMIN role."
    ),
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_rule(
    rule_id: uuid.UUID,
    db: DB,
    current_user: AdminUser,
    tenant_id: TenantId,
):
    await assignment_rule_service.delete_rule(db, tenant_id, rule_id)
