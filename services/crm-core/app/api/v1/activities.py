"""Activities API router — /api/v1/activities.

Provides a unified activity timeline for any CRM entity.  A single endpoint
aggregates Notes, Tasks, CallLogs, Comments, Communications, and
StatusChangeLogs into a chronologically ordered feed.

Endpoint map:
  GET /{doctype}/{docname}  — unified timeline for a specific CRM document

Path params:
  doctype  — CRM entity type: Lead | Deal | Contact | Organization
  docname  — UUID primary key of the entity

Query params:
  page       — 1-based page number (default 1)
  page_size  — results per page, max 100 (default 20)

All endpoints require a valid Bearer JWT.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id
from app.models.user import User
from app.schemas.activity import ActivityListResponse
from app.services.activity_service import activity_service

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]

# Valid doctype values — used in the path description
_VALID_DOCTYPES = "Lead | Deal | Contact | Organization"


# ---------------------------------------------------------------------------
# GET /{doctype}/{docname}  — unified activity timeline
# ---------------------------------------------------------------------------


@router.get(
    "/{doctype}/{docname}",
    summary="Get unified activity timeline",
    description=(
        "Returns a merged, chronologically ordered activity feed for any CRM entity. "
        "Aggregates notes, tasks, call logs, comments, communications, and status "
        "change history into a single paginated timeline. "
        f"Supported doctype values: {_VALID_DOCTYPES}."
    ),
    response_model=ActivityListResponse,
    status_code=status.HTTP_200_OK,
)
async def get_activities(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    doctype: str = Path(
        ...,
        description=f"CRM entity type: {_VALID_DOCTYPES}",
        min_length=1,
        max_length=50,
    ),
    docname: uuid.UUID = Path(
        ...,
        description="UUID primary key of the CRM entity",
    ),
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(20, ge=1, le=100, description="Results per page (max 100)"),
) -> ActivityListResponse:
    return await activity_service.get_activities(
        db=db,
        tenant_id=tenant_id,
        doctype=doctype,
        docname=docname,
        page=page,
        page_size=page_size,
    )
