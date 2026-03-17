"""Service Level Agreement models.

Three related tables:
  ServiceLevelAgreement  — top-level SLA definition per tenant
  ServiceLevelPriority   — response/resolution time per priority within an SLA
  ServiceDay             — working-hours configuration per day within an SLA

The three tables are intentionally separate so that each SLA can have an
arbitrary number of priorities and an arbitrary set of working days without
array columns or JSON blobs.
"""

import uuid
from datetime import time

from sqlalchemy import Boolean, ForeignKey, Index, Interval, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase
from app.core.database import Base


# ---------------------------------------------------------------------------
# ServiceLevelAgreement
# ---------------------------------------------------------------------------

class ServiceLevelAgreement(TenantBase):
    __tablename__ = "service_level_agreements"

    __table_args__ = (
        Index("ix_sla_tenant_id_applies_to", "tenant_id", "applies_to"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    applies_to: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Lead | Deal — which doctype this SLA governs",
    )
    # Frappe-style Jinja/Python expression that is evaluated to decide whether
    # this SLA applies to a given document.  Null means "always applies".
    condition: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- Relationships ---

    priorities: Mapped[list["ServiceLevelPriority"]] = relationship(
        "ServiceLevelPriority",
        back_populates="sla",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    service_days: Mapped[list["ServiceDay"]] = relationship(
        "ServiceDay",
        back_populates="sla",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<ServiceLevelAgreement id={self.id} name={self.name!r} "
            f"applies_to={self.applies_to!r} tenant_id={self.tenant_id}>"
        )


# ---------------------------------------------------------------------------
# ServiceLevelPriority
# ---------------------------------------------------------------------------

class ServiceLevelPriority(Base):
    """One row per priority tier within an SLA (e.g. High / Medium / Low).

    Does NOT inherit TenantBase because the tenant context is implicit via
    the sla_id FK — keeping the table lean and avoiding a redundant tenant_id
    column that could de-sync from the parent row.
    """

    __tablename__ = "service_level_priorities"

    __table_args__ = (
        Index("ix_slp_sla_id_priority", "sla_id", "priority"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sla_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("service_level_agreements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Low | Medium | High — matches Task.priority and Lead priority",
    )
    # PostgreSQL INTERVAL stores durations precisely (supports hours > 24).
    response_time: Mapped[object] = mapped_column(
        Interval,
        nullable=False,
        comment="Maximum time before first response must be sent",
    )
    resolution_time: Mapped[object] = mapped_column(
        Interval,
        nullable=False,
        comment="Maximum time before the issue must be resolved/closed",
    )

    # --- Relationships ---

    sla: Mapped["ServiceLevelAgreement"] = relationship(
        "ServiceLevelAgreement",
        back_populates="priorities",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<ServiceLevelPriority id={self.id} sla_id={self.sla_id} "
            f"priority={self.priority!r}>"
        )


# ---------------------------------------------------------------------------
# ServiceDay
# ---------------------------------------------------------------------------

class ServiceDay(Base):
    """Working-hours configuration for one calendar day within an SLA.

    Same rationale as ServiceLevelPriority — tenant context flows through
    the parent SLA, so no separate tenant_id column is needed here.
    """

    __tablename__ = "service_days"

    __table_args__ = (
        Index("ix_service_days_sla_id_day", "sla_id", "day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sla_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("service_level_agreements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    day: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        comment="Three-letter abbreviation: Mon | Tue | Wed | Thu | Fri | Sat | Sun",
    )
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    # --- Relationships ---

    sla: Mapped["ServiceLevelAgreement"] = relationship(
        "ServiceLevelAgreement",
        back_populates="service_days",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<ServiceDay id={self.id} sla_id={self.sla_id} "
            f"day={self.day!r} {self.start_time}-{self.end_time}>"
        )
