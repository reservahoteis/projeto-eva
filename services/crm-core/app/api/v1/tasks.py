"""FastAPI router for the Task resource — /api/v1/tasks.

All endpoints require a valid Bearer JWT (get_current_user) and resolve the
calling user's tenant automatically (get_tenant_id — populated by
get_current_user via request.state).

Endpoint map:
  GET    /              list_tasks       — list (paginated) or kanban (by status)
  POST   /              create_task
  GET    /{task_id}     get_task
  PUT    /{task_id}     update_task
  DELETE /{task_id}     delete_task
  POST   /bulk-delete   bulk_delete_tasks

Query parameters for GET / are modelled as TaskListParams and injected via
a custom dependency (_task_list_params) that also handles JSON decoding of
the `filters` query param.

Kanban view:
  GET /tasks?view_type=kanban

  Returns a KanbanResponse with five columns in canonical status order
  (Backlog, Todo, In Progress, Done, Canceled).  Each column carries a
  pre-defined color (gray, blue, yellow, green, red).  column_field defaults
  to "status" when view_type=kanban and no column_field is supplied.
"""

from __future__ import annotations

import json
import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id
from app.core.exceptions import BadRequestError
from app.models.user import User
from app.schemas.lead import KanbanResponse, PaginatedResponse
from app.schemas.task import (
    TaskBulkDeleteRequest,
    TaskBulkDeleteResponse,
    TaskCreate,
    TaskListItem,
    TaskListParams,
    TaskResponse,
    TaskUpdate,
)
from app.services.task_service import task_service

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
        GET /tasks?filters={"status":"Todo","assigned_to_id":"<uuid>"}
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
# Dependency: build TaskListParams from individual query-string args
# ---------------------------------------------------------------------------


def _task_list_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    order_by: str = Query("created_at desc"),
    view_type: str = Query("list"),
    column_field: str | None = Query(
        None,
        description='Kanban column field. Only "status" is supported for tasks.',
    ),
    parsed_filters: dict[str, Any] | None = Depends(_parse_filters),
) -> TaskListParams:
    # When the client requests kanban without specifying column_field,
    # default to "status" — the only valid grouping for tasks.
    effective_column_field = column_field
    if view_type == "kanban" and effective_column_field is None:
        effective_column_field = "status"

    return TaskListParams(
        page=page,
        page_size=page_size,
        order_by=order_by,
        view_type=view_type,  # type: ignore[arg-type]
        column_field=effective_column_field,
        filters=parsed_filters,
    )


ListParams = Annotated[TaskListParams, Depends(_task_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list tasks
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List tasks",
    description=(
        "Returns a paginated list or a kanban board depending on the `view_type` "
        "query param. "
        "Use `view_type=kanban` to get tasks grouped by status with color hints. "
        "Use `filters` (JSON dict) to narrow results, e.g. "
        '{"status":"Todo","assigned_to_id":"<uuid>"}. '
        "Use `order_by` for multi-column sorting (comma-separated 'field dir' tokens)."
    ),
    response_model=PaginatedResponse[TaskListItem],
    # Kanban response has a different shape.  FastAPI serialises it correctly
    # at runtime — response_model is set to the common case for OpenAPI docs.
    status_code=status.HTTP_200_OK,
)
async def list_tasks(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    params: ListParams,
):
    return await task_service.list_tasks(db, tenant_id, params)


# ---------------------------------------------------------------------------
# POST /  — create task
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create a task",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task(
    payload: TaskCreate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> TaskResponse:
    task = await task_service.create_task(
        db=db,
        tenant_id=tenant_id,
        data=payload,
        user_id=current_user.id,
    )
    return TaskResponse.model_validate(task)


# ---------------------------------------------------------------------------
# GET /{task_id}  — get task detail
# ---------------------------------------------------------------------------


@router.get(
    "/{task_id}",
    summary="Get task detail",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
)
async def get_task(
    task_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> TaskResponse:
    task = await task_service.get_task(db, tenant_id, task_id)
    return TaskResponse.model_validate(task)


# ---------------------------------------------------------------------------
# PUT /{task_id}  — update task
# ---------------------------------------------------------------------------


@router.put(
    "/{task_id}",
    summary="Update a task",
    description="Partial update — only non-null fields in the request body are applied.",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> TaskResponse:
    task = await task_service.update_task(
        db=db,
        tenant_id=tenant_id,
        task_id=task_id,
        data=payload,
        user_id=current_user.id,
    )
    return TaskResponse.model_validate(task)


# ---------------------------------------------------------------------------
# DELETE /{task_id}  — delete task
# ---------------------------------------------------------------------------


@router.delete(
    "/{task_id}",
    summary="Delete a task",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_task(
    task_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> None:
    await task_service.delete_task(db, tenant_id, task_id)


# ---------------------------------------------------------------------------
# POST /bulk-delete  — bulk delete tasks
# ---------------------------------------------------------------------------


@router.post(
    "/bulk-delete",
    summary="Bulk delete tasks",
    description=(
        "Delete up to 500 tasks in a single request. "
        "Returns the count of tasks that were actually deleted "
        "(IDs not belonging to this tenant are silently skipped)."
    ),
    response_model=TaskBulkDeleteResponse,
    status_code=status.HTTP_200_OK,
)
async def bulk_delete_tasks(
    body: TaskBulkDeleteRequest,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> TaskBulkDeleteResponse:
    deleted_count = await task_service.bulk_delete(
        db=db,
        tenant_id=tenant_id,
        task_ids=body.ids,
    )
    return TaskBulkDeleteResponse(deleted_count=deleted_count)
