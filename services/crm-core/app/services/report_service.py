"""ReportService — conversation analytics and attendant performance metrics.

Design decisions:
  - All queries are scoped to tenant_id in the WHERE clause — no global reads.
  - Period arithmetic is done in Python from a small set of validated period
    strings (7d, 30d, 90d, 1y) — never interpolated into SQL.
  - Average response time uses closed_at - created_at on CLOSED conversations
    only; NULL closed_at rows are excluded by the SQL WHERE clause.
  - Hourly aggregation applies a UTC-3 (Brazil / Sao Paulo) offset before
    extracting the hour, keeping business-hours analysis meaningful.
  - Use db.flush() not db.commit() — caller owns transaction.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Brazil standard offset — Sao Paulo (UTC-3).  Used for hourly bucketing.
_BRAZIL_UTC_OFFSET_HOURS: int = -3

# Attendant roles eligible for performance reporting.
_ATTENDANT_ROLES: tuple[str, ...] = ("ATTENDANT", "HEAD")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_period(period: str) -> tuple[datetime, datetime]:
    """Return (start_dt, end_dt) for the requested period string.

    Supported values: 7d | 30d | 90d | 1y

    Raises BadRequestError for unrecognised values.  Both datetimes are
    timezone-aware (UTC).
    """
    now = datetime.now(tz=timezone.utc)
    _DELTAS: dict[str, timedelta] = {
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
        "1y": timedelta(days=365),
    }
    if period not in _DELTAS:
        raise BadRequestError(
            f"Invalid period {period!r}. Allowed: {sorted(_DELTAS.keys())}"
        )
    delta = _DELTAS[period]
    start_dt = now - delta
    # Previous period: same length immediately before start_dt
    return start_dt, now


def _previous_period_start(start_dt: datetime, period: str) -> datetime:
    """Return the start of the comparison period that precedes start_dt."""
    _DELTAS: dict[str, timedelta] = {
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
        "1y": timedelta(days=365),
    }
    delta = _DELTAS[period]
    return start_dt - delta


# ---------------------------------------------------------------------------
# ReportService
# ---------------------------------------------------------------------------


class ReportService:
    """Reporting queries for conversations, attendants, and hourly volume."""

    # ------------------------------------------------------------------
    # get_overview
    # ------------------------------------------------------------------

    async def get_overview(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        period: str = "30d",
    ) -> dict[str, Any]:
        """Return tenant-level conversation overview for the requested period.

        Returns a dict with keys:
          overview        — top-level metrics (total, change_pct, avg_response_time, etc.)
          statusBreakdown — list of {status, count, percentage} dicts
        """
        start_dt, end_dt = _parse_period(period)
        prev_start_dt = _previous_period_start(start_dt, period)

        # ------------------------------------------------------------------
        # 1. Total conversations in current period (tenant-scoped)
        # ------------------------------------------------------------------
        total_result = await db.execute(
            select(func.count())
            .select_from(Conversation)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.created_at >= start_dt,
                Conversation.created_at < end_dt,
            )
        )
        total_conversations: int = total_result.scalar_one()

        # ------------------------------------------------------------------
        # 2. Total conversations in previous period (for % change)
        # ------------------------------------------------------------------
        prev_total_result = await db.execute(
            select(func.count())
            .select_from(Conversation)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.created_at >= prev_start_dt,
                Conversation.created_at < start_dt,
            )
        )
        prev_total: int = prev_total_result.scalar_one()

        change_pct: float | None = None
        if prev_total > 0:
            change_pct = round(
                ((total_conversations - prev_total) / prev_total) * 100, 2
            )

        # ------------------------------------------------------------------
        # 3. Status breakdown — GROUP BY status
        # ------------------------------------------------------------------
        status_rows_result = await db.execute(
            select(
                Conversation.status,
                func.count().label("cnt"),
            )
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.created_at >= start_dt,
                Conversation.created_at < end_dt,
            )
            .group_by(Conversation.status)
        )
        status_rows = status_rows_result.all()

        status_breakdown: list[dict[str, Any]] = []
        for row in status_rows:
            pct = (
                round((row.cnt / total_conversations) * 100, 2)
                if total_conversations > 0
                else 0.0
            )
            status_breakdown.append(
                {"status": row.status, "count": row.cnt, "percentage": pct}
            )

        # ------------------------------------------------------------------
        # 4. Active attendants — users who have at least one conversation
        #    assigned to them within the period (tenant-scoped)
        # ------------------------------------------------------------------
        active_att_result = await db.execute(
            select(func.count(func.distinct(Conversation.assigned_to_id)))
            .select_from(Conversation)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.assigned_to_id.isnot(None),
                Conversation.created_at >= start_dt,
                Conversation.created_at < end_dt,
            )
        )
        active_attendants: int = active_att_result.scalar_one()

        # ------------------------------------------------------------------
        # 5. Average response time — closed conversations only
        #    (closed_at - created_at in seconds, then converted to minutes)
        # ------------------------------------------------------------------
        avg_resp_result = await db.execute(
            select(
                func.avg(
                    func.extract(
                        "epoch",
                        Conversation.closed_at - Conversation.created_at,
                    )
                ).label("avg_seconds")
            )
            .select_from(Conversation)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.status == "CLOSED",
                Conversation.closed_at.isnot(None),
                Conversation.created_at >= start_dt,
                Conversation.created_at < end_dt,
            )
        )
        avg_seconds = avg_resp_result.scalar_one()
        avg_response_time_minutes: float | None = (
            round(float(avg_seconds) / 60, 2) if avg_seconds is not None else None
        )

        # ------------------------------------------------------------------
        # 6. Resolution rate — closed / total * 100
        # ------------------------------------------------------------------
        closed_count_result = await db.execute(
            select(func.count())
            .select_from(Conversation)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.status == "CLOSED",
                Conversation.created_at >= start_dt,
                Conversation.created_at < end_dt,
            )
        )
        closed_count: int = closed_count_result.scalar_one()
        resolution_rate: float = (
            round((closed_count / total_conversations) * 100, 2)
            if total_conversations > 0
            else 0.0
        )

        # ------------------------------------------------------------------
        # 7. Unread messages — INBOUND direction where status != 'READ'
        #    scoped to conversations of this tenant in the period
        # ------------------------------------------------------------------
        unread_result = await db.execute(
            select(func.count())
            .select_from(Message)
            .join(
                Conversation,
                Message.conversation_id == Conversation.id,
            )
            .where(
                Conversation.tenant_id == tenant_id,
                Message.tenant_id == tenant_id,
                Message.direction == "INBOUND",
                Message.status != "READ",
                Conversation.created_at >= start_dt,
                Conversation.created_at < end_dt,
            )
        )
        unread_messages: int = unread_result.scalar_one()

        logger.info(
            "report_overview_fetched",
            tenant_id=str(tenant_id),
            period=period,
            total_conversations=total_conversations,
            change_pct=change_pct,
        )

        return {
            "overview": {
                "total_conversations": total_conversations,
                "change_pct_vs_previous_period": change_pct,
                "active_attendants": active_attendants,
                "avg_response_time_minutes": avg_response_time_minutes,
                "resolution_rate": resolution_rate,
                "unread_messages": unread_messages,
            },
            "statusBreakdown": status_breakdown,
        }

    # ------------------------------------------------------------------
    # get_attendants_performance
    # ------------------------------------------------------------------

    async def get_attendants_performance(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        period: str = "30d",
    ) -> list[dict[str, Any]]:
        """Return per-attendant performance metrics for the requested period.

        Iterates over ATTENDANT and HEAD role users belonging to the tenant.
        For each user, counts assigned + closed conversations in the period.
        """
        start_dt, end_dt = _parse_period(period)

        # ------------------------------------------------------------------
        # 1. Fetch all attendant users for the tenant (tenant-scoped)
        # ------------------------------------------------------------------
        users_result = await db.execute(
            select(User.id, User.name, User.email, User.role)
            .where(
                User.tenant_id == tenant_id,
                User.role.in_(list(_ATTENDANT_ROLES)),
                User.status == "ACTIVE",
            )
            .order_by(User.name.asc())
        )
        users = users_result.all()

        if not users:
            return []

        user_ids = [u.id for u in users]

        # ------------------------------------------------------------------
        # 2. Conversations assigned to each user in the period (tenant-scoped)
        # ------------------------------------------------------------------
        assigned_result = await db.execute(
            select(
                Conversation.assigned_to_id,
                func.count().label("total"),
                func.sum(
                    case((Conversation.status == "CLOSED", 1), else_=0)
                ).label("closed"),
            )
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.assigned_to_id.in_(user_ids),
                Conversation.created_at >= start_dt,
                Conversation.created_at < end_dt,
            )
            .group_by(Conversation.assigned_to_id)
        )
        assigned_rows = assigned_result.all()

        # Build a lookup keyed by user_id
        perf_map: dict[uuid.UUID, dict[str, int]] = {
            row.assigned_to_id: {
                "total": int(row.total),
                "closed": int(row.closed) if row.closed else 0,
            }
            for row in assigned_rows
        }

        # ------------------------------------------------------------------
        # 3. Build result list — zero-fill users with no activity
        # ------------------------------------------------------------------
        results: list[dict[str, Any]] = []
        for user in users:
            data = perf_map.get(user.id, {"total": 0, "closed": 0})
            total = data["total"]
            closed = data["closed"]
            satisfaction_rate = (
                round((closed / total) * 100, 2) if total > 0 else 0.0
            )
            results.append(
                {
                    "user_id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "role": user.role,
                    "conversations_assigned": total,
                    "conversations_closed": closed,
                    "satisfaction_rate": satisfaction_rate,
                }
            )

        logger.info(
            "report_attendants_performance_fetched",
            tenant_id=str(tenant_id),
            period=period,
            attendant_count=len(results),
        )

        return results

    # ------------------------------------------------------------------
    # get_hourly_volume
    # ------------------------------------------------------------------

    async def get_hourly_volume(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        period: str = "30d",
    ) -> dict[str, Any]:
        """Return conversation volume broken down by hour of day (Brazil UTC-3).

        Returns a dict with keys:
          hourly_volume           — list of 24 items {hour, count}
          business_hours_metrics  — {inside_count, outside_count, outside_percentage}
        """
        start_dt, end_dt = _parse_period(period)

        # ------------------------------------------------------------------
        # Fetch conversations in period — apply UTC-3 offset before extracting
        # hour so business-hours metrics are correct for Brazil.
        # ------------------------------------------------------------------
        # SQLAlchemy / PostgreSQL: cast created_at to the local tz via AT TIME ZONE,
        # or apply a fixed integer offset.  We use func.extract on a manually
        # shifted expression to avoid requiring a named timezone in the DB.
        hour_expr = (
            func.extract(
                "hour",
                Conversation.created_at
                + func.make_interval(0, 0, 0, 0, _BRAZIL_UTC_OFFSET_HOURS),
            )
            .cast(type_=None)
            .label("local_hour")
        )

        # Use a simpler, portable approach: extract the epoch, compute modulo
        # arithmetic in Python from the raw rows.  Fetch all created_at values
        # for the period and bucket in Python — avoids complex DB-side tz logic.
        conv_result = await db.execute(
            select(Conversation.created_at)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.created_at >= start_dt,
                Conversation.created_at < end_dt,
            )
        )
        created_ats = conv_result.scalars().all()

        # Bucket into 24 hour slots (Brazil UTC-3)
        hourly_counts: list[int] = [0] * 24
        for ts in created_ats:
            # ts may be offset-naive (stored as UTC) or offset-aware
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            local_hour = (ts.hour + _BRAZIL_UTC_OFFSET_HOURS) % 24
            hourly_counts[local_hour] += 1

        hourly_volume: list[dict[str, Any]] = [
            {"hour": h, "count": hourly_counts[h]} for h in range(24)
        ]

        # ------------------------------------------------------------------
        # Business hours metrics: 08:00 – 18:00 (inclusive start, exclusive end)
        # ------------------------------------------------------------------
        _BH_START = 8
        _BH_END = 18  # up to but not including 18
        inside_count = sum(hourly_counts[h] for h in range(_BH_START, _BH_END))
        outside_count = sum(hourly_counts[h] for h in range(0, _BH_START)) + sum(
            hourly_counts[h] for h in range(_BH_END, 24)
        )
        total_vol = inside_count + outside_count
        outside_percentage = (
            round((outside_count / total_vol) * 100, 2) if total_vol > 0 else 0.0
        )

        logger.info(
            "report_hourly_volume_fetched",
            tenant_id=str(tenant_id),
            period=period,
            total_conversations=total_vol,
        )

        return {
            "hourly_volume": hourly_volume,
            "business_hours_metrics": {
                "inside_count": inside_count,
                "outside_count": outside_count,
                "outside_percentage": outside_percentage,
            },
        }


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

report_service = ReportService()
