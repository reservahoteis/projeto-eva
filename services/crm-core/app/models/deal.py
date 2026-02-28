import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Interval,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import CreatedByMixin, NamingSeriesMixin, TenantBase

if TYPE_CHECKING:
    from app.models.contact import Contact
    from app.models.lead import Lead
    from app.models.lookups import (
        DealStatus,
        Industry,
        LeadSource,
        LostReason,
        Territory,
    )
    from app.models.organization import Organization
    from app.models.sla import ServiceLevelAgreement
    from app.models.user import User


class Deal(TenantBase, CreatedByMixin, NamingSeriesMixin):
    __tablename__ = "deals"

    __table_args__ = (
        Index("ix_deals_tenant_id_status_id", "tenant_id", "status_id"),
        Index("ix_deals_tenant_id_organization_id", "tenant_id", "organization_id"),
    )

    # Core associations
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deal_statuses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    deal_owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Primary contact for this deal",
    )

    # Pipeline metrics
    probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    deal_value: Mapped[float | None] = mapped_column(
        Numeric(precision=18, scale=2), nullable=True
    )
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="BRL")
    exchange_rate: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    expected_deal_value: Mapped[float | None] = mapped_column(Numeric, nullable=True)

    # Timeline
    expected_closure_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    closed_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Sales process
    next_step: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Classification FKs
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lead_sources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    territory_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("territories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    industry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("industries.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Contact snapshot — denormalised from Lead/Contact at deal creation so
    # the deal record remains readable even if the source lead is deleted.
    salutation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lead_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Organisation snapshot
    no_of_employees: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Enum-like: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+",
    )
    annual_revenue: Mapped[float | None] = mapped_column(
        Numeric(precision=18, scale=2), nullable=True
    )
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    organization_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # SLA tracking
    sla_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("service_level_agreements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    sla_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    sla_creation: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    response_by: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    first_response_time: Mapped[datetime | None] = mapped_column(
        Interval, nullable=True
    )
    first_responded_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    communication_status: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Disqualification
    lost_reason_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lost_reasons.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lost_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Financials
    total: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    net_total: Mapped[float | None] = mapped_column(Numeric, nullable=True)

    # --- Relationships ---

    status: Mapped["DealStatus"] = relationship(
        "DealStatus",
        foreign_keys=[status_id],
        lazy="selectin",
    )
    organization: Mapped["Organization | None"] = relationship(
        "Organization",
        foreign_keys=[organization_id],
        lazy="selectin",
    )
    lead: Mapped["Lead | None"] = relationship(
        "Lead",
        foreign_keys=[lead_id],
        lazy="selectin",
    )
    deal_owner: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[deal_owner_id],
        lazy="selectin",
    )
    contact: Mapped["Contact | None"] = relationship(
        "Contact",
        foreign_keys=[contact_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Deal id={self.id} lead_name={self.lead_name!r} "
            f"status_id={self.status_id} tenant_id={self.tenant_id}>"
        )
