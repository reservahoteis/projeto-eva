"""Pivot / junction tables for many-to-many relationships.

Three tables:
  DealContact  — M2M between deals and contacts (with is_primary flag)
  LeadProduct  — line items linking leads to products (with qty, rate, discount)
  DealProduct  — same structure as LeadProduct but for deals

LeadProduct and DealProduct intentionally duplicate the schema rather than
using a polymorphic single table.  This allows separate FK constraints,
indexes, and future divergence (e.g. deal products could have tax lines).
"""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Index, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ---------------------------------------------------------------------------
# DealContact  (deal <-> contact M2M)
# ---------------------------------------------------------------------------

class DealContact(Base):
    """Associates contacts with deals.

    is_primary marks the single contact whose details are surfaced prominently
    in the deal card.  Enforced as a single primary per deal at the service
    layer (not as a DB constraint to avoid complex partial-index gymnastics
    across databases).
    """

    __tablename__ = "deal_contacts"

    __table_args__ = (
        # Composite PK expressed as a constraint so SQLAlchemy picks it up
        # correctly alongside the mapped_column definitions below.
        UniqueConstraint("deal_id", "contact_id", name="uq_deal_contacts_deal_contact"),
    )

    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deals.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True for the main contact surfaced in deal cards and email threads",
    )

    # --- Relationships ---

    deal = relationship("Deal", lazy="selectin")
    contact = relationship("Contact", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<DealContact deal_id={self.deal_id} "
            f"contact_id={self.contact_id} is_primary={self.is_primary}>"
        )


# ---------------------------------------------------------------------------
# LeadProduct  (lead line items)
# ---------------------------------------------------------------------------

class LeadProduct(Base):
    """Product line item attached to a lead.

    amount is a computed column (qty * rate * (1 - discount/100)) maintained
    by the application layer so that reporting queries can sum it directly
    without re-computing.
    """

    __tablename__ = "lead_products"

    __table_args__ = (
        Index("ix_lead_products_lead_id", "lead_id"),
        Index("ix_lead_products_product_id", "product_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Line item financials
    qty: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    rate: Mapped[float | None] = mapped_column(
        Numeric(precision=18, scale=2),
        nullable=True,
        comment="Unit price at the time of adding — may differ from product.rate",
    )
    discount: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        comment="Discount percentage (0-100)",
    )
    amount: Mapped[float | None] = mapped_column(
        Numeric(precision=18, scale=2),
        nullable=True,
        comment="Computed: qty * rate * (1 - discount/100); stored for query performance",
    )

    # --- Relationships ---

    lead = relationship("Lead", lazy="selectin")
    product = relationship("Product", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<LeadProduct id={self.id} lead_id={self.lead_id} "
            f"product_id={self.product_id} qty={self.qty} amount={self.amount}>"
        )


# ---------------------------------------------------------------------------
# DealProduct  (deal line items — mirrors LeadProduct)
# ---------------------------------------------------------------------------

class DealProduct(Base):
    """Product line item attached to a deal.

    Identical structure to LeadProduct but references deals.id instead of
    leads.id, allowing the tables to evolve independently (e.g. tax fields
    added only to deal products at quote stage).
    """

    __tablename__ = "deal_products"

    __table_args__ = (
        Index("ix_deal_products_deal_id", "deal_id"),
        Index("ix_deal_products_product_id", "product_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Line item financials
    qty: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    rate: Mapped[float | None] = mapped_column(
        Numeric(precision=18, scale=2),
        nullable=True,
        comment="Unit price at the time of adding — may differ from product.rate",
    )
    discount: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        comment="Discount percentage (0-100)",
    )
    amount: Mapped[float | None] = mapped_column(
        Numeric(precision=18, scale=2),
        nullable=True,
        comment="Computed: qty * rate * (1 - discount/100); stored for query performance",
    )

    # --- Relationships ---

    deal = relationship("Deal", lazy="selectin")
    product = relationship("Product", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<DealProduct id={self.id} deal_id={self.deal_id} "
            f"product_id={self.product_id} qty={self.qty} amount={self.amount}>"
        )
