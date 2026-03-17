"""UsageTrackingService — monthly billing counter management.

Design decisions:
  - One row per (tenant_id, period) where period is always the first day of
    the current month.  Enforced by the UniqueConstraint on the model and by
    the upsert pattern used in increment_* methods.
  - increment_messages and increment_conversations use a SELECT-then-UPDATE
    pattern with db.flush() to stay within the async SQLAlchemy session
    without needing raw SQL upsert (INSERT ... ON CONFLICT DO UPDATE).
    PostgreSQL advisory locks are NOT used here — the caller must ensure the
    usage tracking methods are not called from conflicting concurrent
    transactions for the same tenant.  For fire-and-forget increments the
    race window is acceptable.
  - update_active_users counts User rows with last_login_at in the current
    month — this is an overwrite (SET active_users = count) not an increment.
  - Every query includes tenant_id in the WHERE clause.
  - Use db.flush() not db.commit() — caller owns transaction.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import structlog
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.usage_tracking import UsageTracking
from app.models.user import User
from app.schemas.lead import PaginatedResponse
from app.schemas.usage_tracking import (
    CurrentUsageResponse,
    UsageTrackingListParams,
    UsageTrackingResponse,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _current_period() -> date:
    """Return the first day of the current month (the billing period key)."""
    today = datetime.now(tz=timezone.utc).date()
    return today.replace(day=1)


async def _upsert_increment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    period: date,
    *,
    messages_delta: int = 0,
    conversations_delta: int = 0,
) -> None:
    """Atomically increment usage counters using PostgreSQL upsert.

    INSERT ... ON CONFLICT DO UPDATE eliminates the race condition that
    exists with SELECT-then-INSERT patterns under concurrent access.
    """
    stmt = (
        pg_insert(UsageTracking)
        .values(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            period=period,
            messages_count=messages_delta,
            conversations_count=conversations_delta,
            active_users=0,
        )
        .on_conflict_do_update(
            constraint="uq_usage_tracking_tenant_period",
            set_={
                "messages_count": UsageTracking.messages_count + messages_delta,
                "conversations_count": UsageTracking.conversations_count + conversations_delta,
            },
        )
    )
    await db.execute(stmt)


async def _get_or_create_record(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    period: date,
) -> UsageTracking:
    """Fetch the usage tracking row for (tenant_id, period), creating it if absent.

    Uses upsert to avoid TOCTOU race conditions.
    """
    # Ensure row exists via upsert with zero deltas
    await _upsert_increment(db, tenant_id, period)
    await db.flush()

    result = await db.execute(
        select(UsageTracking).where(
            UsageTracking.tenant_id == tenant_id,
            UsageTracking.period == period,
        )
    )
    return result.scalar_one()


# ---------------------------------------------------------------------------
# UsageTrackingService
# ---------------------------------------------------------------------------


class UsageTrackingService:
    """Monthly usage counters for billing and quota enforcement."""

    # ------------------------------------------------------------------
    # get_current_month
    # ------------------------------------------------------------------

    async def get_current_month(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> CurrentUsageResponse:
        """Return usage metrics for the current billing period.

        If no record exists yet (new tenant or first use this month) returns
        zero counters rather than raising NotFoundError.
        """
        period = _current_period()
        result = await db.execute(
            select(UsageTracking).where(
                UsageTracking.tenant_id == tenant_id,
                UsageTracking.period == period,
            )
        )
        record = result.scalar_one_or_none()

        if record is None:
            return CurrentUsageResponse(
                period=period,
                messages_count=0,
                conversations_count=0,
                active_users=0,
            )

        return CurrentUsageResponse(
            period=record.period,
            messages_count=record.messages_count,
            conversations_count=record.conversations_count,
            active_users=record.active_users,
        )

    # ------------------------------------------------------------------
    # list_usage
    # ------------------------------------------------------------------

    async def list_usage(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: UsageTrackingListParams,
    ) -> PaginatedResponse[UsageTrackingResponse]:
        """Return paginated usage history for the given tenant.

        Ordered by period descending (most-recent billing period first).
        """
        # ------------------------------------------------------------------
        # Base query — tenant-scoped
        # ------------------------------------------------------------------
        base_q = select(UsageTracking).where(
            UsageTracking.tenant_id == tenant_id
        )

        if params.start_date:
            base_q = base_q.where(UsageTracking.period >= params.start_date)
        if params.end_date:
            base_q = base_q.where(UsageTracking.period <= params.end_date)

        # ------------------------------------------------------------------
        # Count
        # ------------------------------------------------------------------
        count_q = (
            select(func.count())
            .select_from(UsageTracking)
            .where(UsageTracking.tenant_id == tenant_id)
        )
        if params.start_date:
            count_q = count_q.where(
                UsageTracking.period >= params.start_date
            )
        if params.end_date:
            count_q = count_q.where(UsageTracking.period <= params.end_date)

        total_result = await db.execute(count_q)
        total_count: int = total_result.scalar_one()

        # ------------------------------------------------------------------
        # Paginated data
        # ------------------------------------------------------------------
        offset = (params.page - 1) * params.page_size
        data_q = (
            base_q.order_by(UsageTracking.period.desc())
            .offset(offset)
            .limit(params.page_size)
        )
        rows_result = await db.execute(data_q)
        records = rows_result.scalars().all()

        return PaginatedResponse[UsageTrackingResponse](
            data=[UsageTrackingResponse.model_validate(r) for r in records],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    # ------------------------------------------------------------------
    # increment_messages
    # ------------------------------------------------------------------

    async def increment_messages(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        count: int = 1,
    ) -> None:
        """Increment the messages_count counter for the current billing period.

        Uses PostgreSQL upsert to be safe under concurrent access.
        """
        period = _current_period()
        await _upsert_increment(db, tenant_id, period, messages_delta=count)
        await db.flush()

        logger.debug(
            "usage_messages_incremented",
            tenant_id=str(tenant_id),
            period=str(period),
            count=count,
        )

    # ------------------------------------------------------------------
    # increment_conversations
    # ------------------------------------------------------------------

    async def increment_conversations(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        count: int = 1,
    ) -> None:
        """Increment the conversations_count counter for the current period.

        Uses PostgreSQL upsert to be safe under concurrent access.
        """
        period = _current_period()
        await _upsert_increment(db, tenant_id, period, conversations_delta=count)
        await db.flush()

        logger.debug(
            "usage_conversations_incremented",
            tenant_id=str(tenant_id),
            period=str(period),
            count=count,
        )

    # ------------------------------------------------------------------
    # update_active_users
    # ------------------------------------------------------------------

    async def update_active_users(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> None:
        """Count users with last_login_at in the current month and persist it.

        This is a SET operation (overwrites the previous value) rather than an
        increment, since the true count can only be computed by looking at the
        full user set.
        """
        period = _current_period()
        # First day of next month — used as the exclusive upper bound
        if period.month == 12:
            next_month = period.replace(year=period.year + 1, month=1, day=1)
        else:
            next_month = period.replace(month=period.month + 1, day=1)

        # Count users who logged in during the current month (tenant-scoped)
        count_result = await db.execute(
            select(func.count())
            .select_from(User)
            .where(
                User.tenant_id == tenant_id,
                User.last_login_at >= datetime(
                    period.year, period.month, period.day, tzinfo=timezone.utc
                ),
                User.last_login_at
                < datetime(
                    next_month.year,
                    next_month.month,
                    next_month.day,
                    tzinfo=timezone.utc,
                ),
            )
        )
        active_count: int = count_result.scalar_one()

        record = await _get_or_create_record(db, tenant_id, period)
        record.active_users = active_count
        await db.flush()

        logger.debug(
            "usage_active_users_updated",
            tenant_id=str(tenant_id),
            period=str(period),
            active_users=active_count,
        )


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

usage_tracking_service = UsageTrackingService()
