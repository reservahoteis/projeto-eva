"""CallLogService — business logic for the CallLog resource.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query that touches CallLog rows MUST include tenant_id in the WHERE
    clause to enforce strict multi-tenant data isolation.
  - CallLogs reference CRM entities polymorphically via reference_doctype +
    reference_docname; no hard FK is enforced so logs survive entity deletion.
  - db.flush() (not commit) — the session is committed by the outer unit-of-work
    managed by get_db().
"""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.call_log import CallLog
from app.schemas.call_log import (
    CallLogCreate,
    CallLogListItem,
    CallLogListParams,
    CallLogUpdate,
    PaginatedResponse,
)

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# CallLogService
# ---------------------------------------------------------------------------


class CallLogService:
    """All business logic for CallLogs, scoped to a single tenant per call."""

    # ------------------------------------------------------------------
    # list_call_logs
    # ------------------------------------------------------------------

    async def list_call_logs(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: CallLogListParams,
    ) -> PaginatedResponse[CallLogListItem]:
        """Return a paginated list of call logs, optionally filtered."""

        base_conditions = [CallLog.tenant_id == tenant_id]

        if params.type is not None:
            base_conditions.append(CallLog.type == params.type)

        if params.status is not None:
            base_conditions.append(CallLog.status == params.status)

        if params.reference_doctype is not None:
            base_conditions.append(
                CallLog.reference_doctype == params.reference_doctype
            )

        if params.reference_docname is not None:
            base_conditions.append(
                CallLog.reference_docname == params.reference_docname
            )

        # Count total matching rows
        count_result = await db.execute(
            select(func.count())
            .select_from(CallLog)
            .where(*base_conditions)
        )
        total_count = count_result.scalar_one()

        # Paginated data — most-recent first
        offset = (params.page - 1) * params.page_size
        data_result = await db.execute(
            select(CallLog)
            .where(*base_conditions)
            .order_by(CallLog.created_at.desc())
            .offset(offset)
            .limit(params.page_size)
        )
        call_logs = data_result.scalars().all()

        return PaginatedResponse[CallLogListItem](
            data=[CallLogListItem.model_validate(cl) for cl in call_logs],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    # ------------------------------------------------------------------
    # get_call_log
    # ------------------------------------------------------------------

    async def get_call_log(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        call_log_id: uuid.UUID,
    ) -> CallLog:
        """Fetch a single CallLog by PK, scoped to tenant_id."""
        result = await db.execute(
            select(CallLog).where(
                CallLog.tenant_id == tenant_id,
                CallLog.id == call_log_id,
            )
        )
        call_log = result.scalar_one_or_none()
        if not call_log:
            raise NotFoundError(f"CallLog {call_log_id} not found")
        return call_log

    # ------------------------------------------------------------------
    # create_call_log
    # ------------------------------------------------------------------

    async def create_call_log(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: CallLogCreate,
    ) -> CallLog:
        """Create a new CallLog entry."""
        call_log = CallLog(
            tenant_id=tenant_id,
            caller=data.caller,
            receiver=data.receiver,
            type=data.type,
            status=data.status,
            duration=data.duration,
            start_time=data.start_time,
            end_time=data.end_time,
            recording_url=data.recording_url,
            note=data.note,
            telephony_medium=data.telephony_medium,
            reference_doctype=data.reference_doctype,
            reference_docname=data.reference_docname,
        )

        db.add(call_log)
        await db.flush()

        logger.info(
            "call_log_created",
            call_log_id=str(call_log.id),
            tenant_id=str(tenant_id),
            caller=data.caller,
            receiver=data.receiver,
        )
        return call_log

    # ------------------------------------------------------------------
    # update_call_log
    # ------------------------------------------------------------------

    async def update_call_log(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        call_log_id: uuid.UUID,
        data: CallLogUpdate,
    ) -> CallLog:
        """Partial update of a CallLog — only non-None fields are applied."""
        call_log = await self.get_call_log(db, tenant_id, call_log_id)

        update_data = data.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(call_log, field, value)

        await db.flush()

        logger.info(
            "call_log_updated",
            call_log_id=str(call_log_id),
            tenant_id=str(tenant_id),
            fields=list(update_data.keys()),
        )
        return call_log

    # ------------------------------------------------------------------
    # delete_call_log
    # ------------------------------------------------------------------

    async def delete_call_log(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        call_log_id: uuid.UUID,
    ) -> None:
        """Hard-delete a CallLog."""
        call_log = await self.get_call_log(db, tenant_id, call_log_id)
        await db.delete(call_log)
        await db.flush()

        logger.info(
            "call_log_deleted",
            call_log_id=str(call_log_id),
            tenant_id=str(tenant_id),
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

call_log_service = CallLogService()
