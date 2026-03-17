import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
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
    from app.models.lookups import Industry, LeadSource, LeadStatus, LostReason, Territory
    from app.models.organization import Organization
    from app.models.sla import ServiceLevelAgreement
    from app.models.user import User


class Lead(TenantBase, CreatedByMixin, NamingSeriesMixin):
    __tablename__ = "leads"

    __table_args__ = (
        Index("ix_leads_tenant_id_status_id", "tenant_id", "status_id"),
        Index("ix_leads_tenant_id_email", "tenant_id", "email"),
        Index("ix_leads_tenant_id_converted", "tenant_id", "converted"),
    )

    # Personal identity
    salutation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lead_name: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True,
        comment="Computed full name (salutation + first + middle + last)",
    )
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Contact details
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Professional profile
    job_title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    organization_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Organisation FK — nullable because the organisation may not exist yet
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Classification FKs
    status_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lead_statuses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lead_sources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    industry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("industries.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    territory_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("territories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Ownership
    lead_owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Company sizing
    no_of_employees: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Enum-like: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+",
    )
    annual_revenue: Mapped[float | None] = mapped_column(
        Numeric(precision=18, scale=2), nullable=True
    )
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="BRL")

    # Conversion state
    converted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

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

    # Facebook / Meta Lead Ads integration
    facebook_lead_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )
    facebook_form_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

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

    status: Mapped["LeadStatus"] = relationship(
        "LeadStatus",
        foreign_keys=[status_id],
        lazy="selectin",
    )
    source: Mapped["LeadSource | None"] = relationship(
        "LeadSource",
        foreign_keys=[source_id],
        lazy="selectin",
    )
    organization: Mapped["Organization | None"] = relationship(
        "Organization",
        foreign_keys=[organization_id],
        lazy="selectin",
    )
    lead_owner: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[lead_owner_id],
        lazy="selectin",
    )
    industry: Mapped["Industry | None"] = relationship(
        "Industry",
        foreign_keys=[industry_id],
        lazy="selectin",
    )
    territory: Mapped["Territory | None"] = relationship(
        "Territory",
        foreign_keys=[territory_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Lead id={self.id} lead_name={self.lead_name!r} "
            f"status_id={self.status_id} tenant_id={self.tenant_id}>"
        )
