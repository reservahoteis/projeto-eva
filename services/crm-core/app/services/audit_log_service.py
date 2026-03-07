"""AuditLogService — append-only compliance audit trail.

Design decisions:
  - log() is fire-and-forget: errors are caught silently so that a logging
    failure never disrupts the main request flow.  Structlog captures the
    exception at ERROR level for monitoring dashboards.
  - Audit rows are never updated or deleted by this service (append-only).
  - Every read query includes tenant_id in the WHERE clause for multi-tenant
    isolation.
  - ORDER BY is hard-coded to created_at DESC — audit logs have only one
    meaningful read order.  A column whitelist on the params validates any
    override to prevent SQL injection.
  - Use db.flush() not db.commit() — caller owns transaction.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogListParams, AuditLogResponse
from app.schemas.lead import PaginatedResponse

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Column whitelist — prevents SQL injection via ORDER BY
# ---------------------------------------------------------------------------

_AUDIT_LOG_COLUMNS: frozenset[str] = frozenset(
    {
        "id",
        "tenant_id",
        "user_id",
        "action",
        "entity",
        "entity_id",
        "ip_address",
        "created_at",
    }
)


def _validate_column(name: str) -> None:
    """Raise BadRequestError if *name* is not a known AuditLog column."""
    if name not in _AUDIT_LOG_COLUMNS:
        raise BadRequestError(f"Unknown sort field: {name!r}")


def _apply_ordering(query, order_by: str):
    """Append ORDER BY clauses from a comma-separated 'field dir' string."""
    tokens = [t.strip() for t in order_by.split(",") if t.strip()]
    for token in tokens:
        parts = token.split()
        field = parts[0]
        direction = parts[1].lower() if len(parts) == 2 else "asc"
        _validate_column(field)
        col = getattr(AuditLog, field)
        query = query.order_by(col.desc() if direction == "desc" else col.asc())
    return query


# ---------------------------------------------------------------------------
# AuditLogService
# ---------------------------------------------------------------------------


class AuditLogService:
    """Append-only audit trail — write (fire-and-forget) + read."""

    # ------------------------------------------------------------------
    # log — fire-and-forget
    # ------------------------------------------------------------------

    async def log(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        action: str,
        user_id: uuid.UUID | None = None,
        entity: str | None = None,
        entity_id: str | None = None,
        old_data: dict[str, Any] | None = None,
        new_data: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Persist a single audit log entry.

        Errors are caught silently — this method must never raise.
        """
        try:
            entry = AuditLog(
                tenant_id=tenant_id,
                user_id=user_id,
                action=action,
                entity=entity,
                entity_id=entity_id,
                old_data=old_data,
                new_data=new_data,
                metadata_json=metadata,
                ip_address=ip_address,
            )
            db.add(entry)
            await db.flush()

            logger.debug(
                "audit_log_created",
                tenant_id=str(tenant_id),
                action=action,
                entity=entity,
                entity_id=entity_id,
                user_id=str(user_id) if user_id else None,
            )
        except Exception:  # noqa: BLE001
            # Expunge the failed entry to prevent session corruption from
            # propagating to subsequent operations on the same session.
            try:
                db.expunge(entry)
            except Exception:  # noqa: BLE001
                pass
            logger.exception(
                "audit_log_write_failed",
                tenant_id=str(tenant_id),
                action=action,
                entity=entity,
            )

    # ------------------------------------------------------------------
    # list_audit_logs
    # ------------------------------------------------------------------

    async def list_audit_logs(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: AuditLogListParams,
    ) -> PaginatedResponse[AuditLogResponse]:
        """Return a paginated list of audit log entries for the given tenant."""
        # ------------------------------------------------------------------
        # Base query — tenant-scoped
        # ------------------------------------------------------------------
        base_q = select(AuditLog).where(AuditLog.tenant_id == tenant_id)

        # Optional filters
        if params.action:
            base_q = base_q.where(AuditLog.action == params.action)
        if params.entity:
            base_q = base_q.where(AuditLog.entity == params.entity)
        if params.user_id:
            base_q = base_q.where(AuditLog.user_id == params.user_id)
        if params.start_date:
            base_q = base_q.where(AuditLog.created_at >= params.start_date)
        if params.end_date:
            base_q = base_q.where(AuditLog.created_at <= params.end_date)

        # ------------------------------------------------------------------
        # Count — reuse filters on a count subquery
        # ------------------------------------------------------------------
        count_q = (
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.tenant_id == tenant_id)
        )
        if params.action:
            count_q = count_q.where(AuditLog.action == params.action)
        if params.entity:
            count_q = count_q.where(AuditLog.entity == params.entity)
        if params.user_id:
            count_q = count_q.where(AuditLog.user_id == params.user_id)
        if params.start_date:
            count_q = count_q.where(AuditLog.created_at >= params.start_date)
        if params.end_date:
            count_q = count_q.where(AuditLog.created_at <= params.end_date)

        total_result = await db.execute(count_q)
        total_count: int = total_result.scalar_one()

        # ------------------------------------------------------------------
        # Paginated data with ordering
        # ------------------------------------------------------------------
        data_q = _apply_ordering(base_q, params.order_by)
        offset = (params.page - 1) * params.page_size
        data_q = data_q.offset(offset).limit(params.page_size)

        rows_result = await db.execute(data_q)
        entries = rows_result.scalars().all()

        return PaginatedResponse[AuditLogResponse](
            data=[AuditLogResponse.model_validate(e) for e in entries],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    # ------------------------------------------------------------------
    # get_audit_log
    # ------------------------------------------------------------------

    async def get_audit_log(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        audit_log_id: uuid.UUID,
    ) -> AuditLogResponse:
        """Fetch a single audit log entry by PK, scoped to tenant_id.

        Includes old_data and new_data for full before/after diff view.
        """
        result = await db.execute(
            select(AuditLog).where(
                AuditLog.tenant_id == tenant_id,
                AuditLog.id == audit_log_id,
            )
        )
        entry = result.scalar_one_or_none()
        if not entry:
            raise NotFoundError(f"AuditLog {audit_log_id} not found")

        return AuditLogResponse.model_validate(entry)


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

audit_log_service = AuditLogService()
