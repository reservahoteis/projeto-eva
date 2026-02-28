"""Notification model.

Stores in-app notifications directed at specific users.  Designed for
append-heavy workloads; the `read` flag is the only field updated after
insert.

The from_user_id FK is nullable to support system-generated notifications
that are not triggered by a human actor (e.g. SLA breach alerts).
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.user import User


class Notification(TenantBase):
    __tablename__ = "notifications"

    __table_args__ = (
        # Primary read path: "give me all unread notifications for user X"
        Index("ix_notifications_tenant_to_user_read", "tenant_id", "to_user_id", "read"),
    )

    # Parties
    from_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="NULL for system-generated notifications (SLA breach, auto-assignment, …)",
    )
    to_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Content
    notification_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="assignment | mention | sla_breach | status_change | comment | …",
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Polymorphic reference — links the notification to the triggering document
    reference_doctype: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    reference_docname: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # State
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # --- Relationships ---

    from_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[from_user_id],
        lazy="selectin",
    )
    to_user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[to_user_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Notification id={self.id} to_user_id={self.to_user_id} "
            f"type={self.notification_type!r} read={self.read} "
            f"tenant_id={self.tenant_id}>"
        )
