"""Lookup / picklist tables for the CRM.

All lookup tables follow the same pattern:
- Inherit TenantBase (id, tenant_id, timestamps)
- Are intentionally kept simple — no heavy business logic
- Are referenced via FK from Lead, Deal, Contact, Organization

Tables defined here:
  LeadStatus, DealStatus, LeadSource, Industry, Territory, LostReason, Product
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    pass


# ---------------------------------------------------------------------------
# LeadStatus
# ---------------------------------------------------------------------------

class LeadStatus(TenantBase):
    __tablename__ = "lead_statuses"

    __table_args__ = (
        Index("ix_lead_statuses_tenant_id_position", "tenant_id", "position"),
    )

    label: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="#gray",
        comment="CSS color token or hex value for kanban column headers",
    )
    status_type: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Open | Ongoing | OnHold | Lost",
    )
    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Display order within the tenant kanban board",
    )

    def __repr__(self) -> str:
        return f"<LeadStatus id={self.id} label={self.label!r} tenant_id={self.tenant_id}>"


# ---------------------------------------------------------------------------
# DealStatus
# ---------------------------------------------------------------------------

class DealStatus(TenantBase):
    __tablename__ = "deal_statuses"

    __table_args__ = (
        Index("ix_deal_statuses_tenant_id_position", "tenant_id", "position"),
    )

    label: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="#gray",
    )
    status_type: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Open | Ongoing | OnHold | Won | Lost",
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    probability: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Default close probability (0-100) associated with this stage",
    )

    def __repr__(self) -> str:
        return f"<DealStatus id={self.id} label={self.label!r} tenant_id={self.tenant_id}>"


# ---------------------------------------------------------------------------
# LeadSource
# ---------------------------------------------------------------------------

class LeadSource(TenantBase):
    __tablename__ = "lead_sources"

    __table_args__ = (
        Index("ix_lead_sources_tenant_id_name", "tenant_id", "name"),
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)

    def __repr__(self) -> str:
        return f"<LeadSource id={self.id} name={self.name!r} tenant_id={self.tenant_id}>"


# ---------------------------------------------------------------------------
# Industry
# ---------------------------------------------------------------------------

class Industry(TenantBase):
    __tablename__ = "industries"

    __table_args__ = (
        Index("ix_industries_tenant_id_name", "tenant_id", "name"),
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)

    def __repr__(self) -> str:
        return f"<Industry id={self.id} name={self.name!r} tenant_id={self.tenant_id}>"


# ---------------------------------------------------------------------------
# Territory
# ---------------------------------------------------------------------------

class Territory(TenantBase):
    __tablename__ = "territories"

    __table_args__ = (
        Index("ix_territories_tenant_id_name", "tenant_id", "name"),
        Index("ix_territories_tenant_id_parent_id", "tenant_id", "parent_id"),
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)

    # Self-referential FK to support territory hierarchy (e.g. Brazil > South > Rio).
    # Nullable because root-level territories have no parent.
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("territories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --- Relationships ---

    parent: Mapped["Territory | None"] = relationship(
        "Territory",
        remote_side="Territory.id",
        foreign_keys=[parent_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Territory id={self.id} name={self.name!r} "
            f"parent_id={self.parent_id} tenant_id={self.tenant_id}>"
        )


# ---------------------------------------------------------------------------
# LostReason
# ---------------------------------------------------------------------------

class LostReason(TenantBase):
    __tablename__ = "lost_reasons"

    __table_args__ = (
        Index("ix_lost_reasons_tenant_id_name", "tenant_id", "name"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    def __repr__(self) -> str:
        return f"<LostReason id={self.id} name={self.name!r} tenant_id={self.tenant_id}>"


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

class Product(TenantBase):
    __tablename__ = "products"

    __table_args__ = (
        Index("ix_products_tenant_id_name", "tenant_id", "name"),
        Index("ix_products_tenant_id_code", "tenant_id", "code"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="SKU / product code — not enforced unique globally, only meaningful per tenant",
    )
    rate: Mapped[float | None] = mapped_column(
        Numeric(precision=18, scale=2),
        nullable=True,
        comment="Standard unit price used as default when adding to a lead/deal",
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return (
            f"<Product id={self.id} name={self.name!r} "
            f"code={self.code!r} tenant_id={self.tenant_id}>"
        )
