"""UsageTracking model — monthly usage counters per tenant.

One row per (tenant_id, period) where period is always the first day of
the month (YYYY-MM-01).  This allows simple range queries for billing and
quota enforcement without aggregating raw event tables.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantBase


class UsageTracking(TenantBase):
    """Monthly usage counters used for billing and quota checks."""

    __tablename__ = "usage_tracking"

    __table_args__ = (
        # Enforces one row per tenant per billing period; also acts as the
        # primary lookup key for upsert operations.
        UniqueConstraint("tenant_id", "period", name="uq_usage_tracking_tenant_period"),
    )

    # --- Period ---

    period: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="First day of the billing month (YYYY-MM-01)",
    )

    # --- Counters ---

    messages_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Total messages (inbound + outbound) processed this month",
    )
    conversations_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Distinct conversations opened this month",
    )
    active_users: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Unique attendant users who sent at least one message this month",
    )

    def __repr__(self) -> str:
        return (
            f"<UsageTracking id={self.id} period={self.period} "
            f"messages_count={self.messages_count} "
            f"tenant_id={self.tenant_id}>"
        )
