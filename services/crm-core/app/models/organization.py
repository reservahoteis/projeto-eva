import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.lookups import Industry, Territory


class Organization(TenantBase):
    __tablename__ = "organizations"

    __table_args__ = (
        # Enforces uniqueness of organization name per tenant — two tenants may
        # share the same organization name, but within a single tenant it must
        # be unique to avoid ambiguity during lead/deal association.
        Index("ix_organizations_tenant_id_name", "tenant_id", "organization_name", unique=True),
    )

    # Identity
    organization_name: Mapped[str] = mapped_column(String(255), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Sizing metrics
    no_of_employees: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Enum-like: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+",
    )
    annual_revenue: Mapped[float | None] = mapped_column(
        Numeric(precision=18, scale=2), nullable=True
    )

    # Classification FKs
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

    # Mailing / registered address
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- Relationships ---

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
            f"<Organization id={self.id} name={self.organization_name!r} "
            f"tenant_id={self.tenant_id}>"
        )
