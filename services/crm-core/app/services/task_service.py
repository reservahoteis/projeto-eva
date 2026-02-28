"""TaskService — business logic for the Task resource.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query that touches Task rows MUST include tenant_id in the WHERE
    clause to enforce strict multi-tenant data isolation.
  - Kanban view groups tasks by status column in Python (same strategy as
    LeadService kanban) to avoid complex SQL PARTITION BY on the ORM layer.
  - Status colours are fixed brand values that the UI uses to tint kanban
    column headers — they are not stored in the DB, they live here.
  - db.flush() (not commit) is used in all write methods so the surrounding
    request transaction can be rolled back by the session middleware on error.
  - The module-level singleton `task_service = TaskService()` is the canonical
    import for use in routers.
"""

from __future__ import annotations

import uuid
from typing import Any

import structlog
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.task import Task
from app.schemas.lead import KanbanColumn, KanbanResponse, PaginatedResponse
from app.schemas.task import (
    TaskCreate,
    TaskListItem,
    TaskListParams,
    TaskUpdate,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Column whitelist — prevents SQL injection through dynamic ORDER BY / filters
# ---------------------------------------------------------------------------

_TASK_COLUMNS: frozenset[str] = frozenset(
    {
        "id",
        "tenant_id",
        "created_by_id",
        "title",
        "description",
        "priority",
        "status",
        "assigned_to_id",
        "due_date",
        "reference_doctype",
        "reference_docname",
        "created_at",
        "updated_at",
    }
)

# Status -> kanban column color mapping (used in KanbanColumn.color)
_STATUS_COLORS: dict[str, str] = {
    "Backlog": "gray",
    "Todo": "blue",
    "In Progress": "yellow",
    "Done": "green",
    "Canceled": "red",
}

# Canonical status ordering for the kanban board
_STATUS_ORDER: list[str] = ["Backlog", "Todo", "In Progress", "Done", "Canceled"]


def _validate_column(name: str) -> None:
    """Raise BadRequestError if `name` is not a known Task column."""
    if name not in _TASK_COLUMNS:
        raise BadRequestError(f"Unknown filter / sort field: {name!r}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_task_query(tenant_id: uuid.UUID):
    """Base SELECT with eager-loaded relationships for full Task responses."""
    return (
        select(Task)
        .where(Task.tenant_id == tenant_id)
        .options(
            selectinload(Task.assigned_to),
            selectinload(Task.created_by),
        )
    )


def _apply_filters(query, filters: dict[str, Any] | None):
    """Append equality WHERE clauses derived from the filters dict.

    Supported value types:
      - scalar (str, int, float, bool, UUID) -> col = value
      - None                                 -> col IS NULL
      - list                                 -> col IN (values)
    """
    if not filters:
        return query
    for field, value in filters.items():
        _validate_column(field)
        col = getattr(Task, field)
        if value is None:
            query = query.where(col.is_(None))
        elif isinstance(value, list):
            query = query.where(col.in_(value))
        else:
            query = query.where(col == value)
    return query


def _apply_ordering(query, order_by: str):
    """Append ORDER BY clauses from a comma-separated 'field dir' string."""
    tokens = [t.strip() for t in order_by.split(",") if t.strip()]
    for token in tokens:
        parts = token.split()
        field = parts[0]
        direction = parts[1].lower() if len(parts) == 2 else "asc"
        _validate_column(field)
        col = getattr(Task, field)
        query = query.order_by(col.desc() if direction == "desc" else col.asc())
    return query


# ---------------------------------------------------------------------------
# TaskService
# ---------------------------------------------------------------------------


class TaskService:
    """All business logic for Tasks, scoped to a single tenant per call."""

    # ------------------------------------------------------------------
    # list_tasks
    # ------------------------------------------------------------------

    async def list_tasks(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: TaskListParams,
    ) -> PaginatedResponse[TaskListItem] | KanbanResponse[TaskListItem]:
        """Return tasks in list or kanban format.

        When view_type is 'kanban', tasks are grouped by status column with
        pre-defined colors.  column_field defaults to 'status' if not provided.
        """
        if params.view_type == "kanban":
            return await self._list_kanban(db, tenant_id, params)
        return await self._list_paginated(db, tenant_id, params)

    async def _list_paginated(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: TaskListParams,
    ) -> PaginatedResponse[TaskListItem]:
        base_query = _build_task_query(tenant_id)
        base_query = _apply_filters(base_query, params.filters)

        # Count total matching rows before pagination
        count_query = (
            select(func.count())
            .select_from(Task)
            .where(Task.tenant_id == tenant_id)
        )
        count_query = _apply_filters(count_query, params.filters)
        total_result = await db.execute(count_query)
        total_count = total_result.scalar_one()

        # Paginated data
        data_query = _apply_ordering(base_query, params.order_by)
        offset = (params.page - 1) * params.page_size
        data_query = data_query.offset(offset).limit(params.page_size)

        rows = await db.execute(data_query)
        tasks = rows.scalars().all()

        return PaginatedResponse[TaskListItem](
            data=[TaskListItem.model_validate(task) for task in tasks],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    async def _list_kanban(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: TaskListParams,
    ) -> KanbanResponse[TaskListItem]:
        """Group tasks by status into kanban columns.

        Strategy:
          1. Fetch all matching tasks (up to a safe cap) ordered by
             canonical status order + created_at.
          2. Group in Python — avoids complex SQL PARTITION BY on the ORM
             layer while keeping N+1 queries away.

        The five status columns are always emitted in canonical order
        (Backlog, Todo, In Progress, Done, Canceled) even when empty,
        so the frontend can render a consistent board structure.
        """
        base_query = _build_task_query(tenant_id)
        base_query = _apply_filters(base_query, params.filters)
        base_query = _apply_ordering(base_query, params.order_by)

        # Safety cap: max 200 tasks per column * 5 columns
        base_query = base_query.limit(200 * 5)

        rows = await db.execute(base_query)
        tasks = rows.scalars().all()

        # Group by status value
        columns_map: dict[str, list[Task]] = {}
        for task in tasks:
            columns_map.setdefault(task.status, []).append(task)

        # Build KanbanColumn list in canonical status order
        kanban_columns: list[KanbanColumn[TaskListItem]] = []
        for position, status_value in enumerate(_STATUS_ORDER):
            col_tasks = columns_map.get(status_value, [])
            kanban_columns.append(
                KanbanColumn[TaskListItem](
                    column_value=status_value,
                    column_id=None,  # status is a string, not a FK UUID
                    color=_STATUS_COLORS.get(status_value),
                    position=position,
                    count=len(col_tasks),
                    data=[TaskListItem.model_validate(t) for t in col_tasks],
                )
            )

        # Also include any unexpected status values not in _STATUS_ORDER
        for status_value, col_tasks in columns_map.items():
            if status_value not in _STATUS_ORDER:
                kanban_columns.append(
                    KanbanColumn[TaskListItem](
                        column_value=status_value,
                        column_id=None,
                        color=None,
                        position=None,
                        count=len(col_tasks),
                        data=[TaskListItem.model_validate(t) for t in col_tasks],
                    )
                )

        return KanbanResponse[TaskListItem](
            columns=kanban_columns,
            total_count=len(tasks),
        )

    # ------------------------------------------------------------------
    # get_task
    # ------------------------------------------------------------------

    async def get_task(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        task_id: uuid.UUID,
    ) -> Task:
        """Fetch a single Task by PK, scoped to tenant_id."""
        result = await db.execute(
            _build_task_query(tenant_id).where(Task.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            raise NotFoundError(f"Task {task_id} not found")
        return task

    # ------------------------------------------------------------------
    # create_task
    # ------------------------------------------------------------------

    async def create_task(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: TaskCreate,
        user_id: uuid.UUID,
    ) -> Task:
        """Create a new Task scoped to tenant_id.

        Validation of enum fields (priority, status, reference_doctype) is
        handled by the TaskCreate Pydantic schema — no additional DB-level
        checks are required here.
        """
        task = Task(
            tenant_id=tenant_id,
            created_by_id=user_id,
            title=data.title,
            description=data.description,
            priority=data.priority,
            status=data.status,
            assigned_to_id=data.assigned_to_id,
            due_date=data.due_date,
            reference_doctype=data.reference_doctype,
            reference_docname=data.reference_docname,
        )

        db.add(task)
        await db.flush()  # populate task.id

        # Reload with relationships
        task = await self.get_task(db, tenant_id, task.id)
        logger.info(
            "task_created",
            task_id=str(task.id),
            tenant_id=str(tenant_id),
            title=data.title,
        )
        return task

    # ------------------------------------------------------------------
    # update_task
    # ------------------------------------------------------------------

    async def update_task(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        task_id: uuid.UUID,
        data: TaskUpdate,
        user_id: uuid.UUID | None = None,
    ) -> Task:
        """Partial update of a Task.  Only non-None fields are applied."""
        task = await self.get_task(db, tenant_id, task_id)

        update_data = data.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(task, field, value)

        await db.flush()

        task = await self.get_task(db, tenant_id, task_id)
        logger.info(
            "task_updated",
            task_id=str(task_id),
            tenant_id=str(tenant_id),
            fields=list(update_data.keys()),
        )
        return task

    # ------------------------------------------------------------------
    # delete_task
    # ------------------------------------------------------------------

    async def delete_task(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        task_id: uuid.UUID,
    ) -> None:
        """Hard-delete a Task scoped to tenant_id."""
        task = await self.get_task(db, tenant_id, task_id)
        await db.delete(task)
        await db.flush()
        logger.info(
            "task_deleted",
            task_id=str(task_id),
            tenant_id=str(tenant_id),
        )

    # ------------------------------------------------------------------
    # bulk_delete
    # ------------------------------------------------------------------

    async def bulk_delete(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        task_ids: list[uuid.UUID],
    ) -> int:
        """Delete multiple Tasks by PK list, scoped to tenant.

        Returns the count of actually deleted rows (may be less than
        len(task_ids) if some IDs do not exist or belong to a different
        tenant — those are silently skipped).
        """
        if not task_ids:
            return 0

        result = await db.execute(
            delete(Task)
            .where(
                Task.tenant_id == tenant_id,
                Task.id.in_(task_ids),
            )
            .returning(Task.id)
        )
        deleted_ids = result.fetchall()
        deleted_count = len(deleted_ids)

        await db.flush()
        logger.info(
            "tasks_bulk_deleted",
            requested=len(task_ids),
            deleted=deleted_count,
            tenant_id=str(tenant_id),
        )
        return deleted_count


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

task_service = TaskService()
