import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.lookups import Industry, Territory


class Contact(TenantBase):
    __tablename__ = "contacts"

    __table_args__ = (
        # Composite index for multi-tenant email lookups — avoids full-table
        # scans when filtering contacts by email within a tenant scope.
        Index("ix_contacts_tenant_id_email", "tenant_id", "email"),
    )

    # Personal identity
    salutation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    full_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Computed: salutation + first_name + last_name, maintained by application layer",
    )
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Contact channels
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Professional profile
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(150), nullable=True)

    # Classification FKs — nullable because contacts can exist without these
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
            f"<Contact id={self.id} full_name={self.full_name!r} "
            f"email={self.email!r} tenant_id={self.tenant_id}>"
        )
