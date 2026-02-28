"""Communication models.

Two tables:
  Communication — outbound/inbound messages (Email, WhatsApp, Call summary)
  Comment       — internal team comments attached to any CRM document
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.user import User


# ---------------------------------------------------------------------------
# Communication
# ---------------------------------------------------------------------------

class Communication(TenantBase):
    __tablename__ = "communications"

    __table_args__ = (
        # Fetching all communications for a given document is the hottest query
        # path; also need a per-type filter for email vs WhatsApp views.
        Index("ix_comm_tenant_doctype_docname", "tenant_id", "reference_doctype", "reference_docname"),
        Index("ix_comm_tenant_type", "tenant_id", "comm_type"),
    )

    # Channel
    comm_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Email | WhatsApp | Call",
    )

    # Content
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Addressing
    sender: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recipients: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Comma-separated or JSON array of recipient addresses",
    )

    # Polymorphic reference
    reference_doctype: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Lead | Deal | Contact | Organization",
    )
    reference_docname: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # Delivery timestamp — distinct from created_at which records DB insertion
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Actual delivery time reported by the sending channel",
    )

    def __repr__(self) -> str:
        return (
            f"<Communication id={self.id} comm_type={self.comm_type!r} "
            f"subject={self.subject!r} tenant_id={self.tenant_id}>"
        )


# ---------------------------------------------------------------------------
# Comment
# ---------------------------------------------------------------------------

class Comment(TenantBase):
    __tablename__ = "comments"

    __table_args__ = (
        Index("ix_comments_tenant_doctype_docname", "tenant_id", "reference_doctype", "reference_docname"),
    )

    # Content
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Polymorphic reference
    reference_doctype: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Lead | Deal | Contact | Organization | Task",
    )
    reference_docname: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # Authorship
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --- Relationships ---

    created_by: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[created_by_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Comment id={self.id} reference_doctype={self.reference_doctype!r} "
            f"reference_docname={self.reference_docname} tenant_id={self.tenant_id}>"
        )
