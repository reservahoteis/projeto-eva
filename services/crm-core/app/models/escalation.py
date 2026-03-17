"""Escalation model — records when a conversation was escalated from AI to human.

reason values: USER_REQUESTED | AI_UNABLE | COMPLEX_QUERY | COMPLAINT |
               SALES_OPPORTUNITY | URGENCY | OTHER
status values: PENDING | IN_PROGRESS | RESOLVED | CANCELLED
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.user import User


class Escalation(TenantBase):
    """Tracks the lifecycle of a human-handoff request within a conversation."""

    __tablename__ = "escalations"

    __table_args__ = (
        # Dashboards filter escalations by tenant + status (e.g. pending queue)
        Index("ix_escalations_tenant_id_status", "tenant_id", "status"),
        # Look up all escalations belonging to a specific conversation
        Index("ix_escalations_tenant_id_conversation_id", "tenant_id", "conversation_id"),
    )

    # --- Foreign keys ---

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attended_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --- Classification ---

    reason: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment=(
            "USER_REQUESTED | AI_UNABLE | COMPLEX_QUERY | COMPLAINT | "
            "SALES_OPPORTUNITY | URGENCY | OTHER"
        ),
    )
    hotel_unit: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Hotel unit context at the time of escalation",
    )

    # --- Lifecycle ---

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PENDING",
        comment="PENDING | IN_PROGRESS | RESOLVED | CANCELLED",
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # --- AI handoff context ---

    ai_context: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Snapshot of AI conversation memory / intent at point of escalation",
    )

    # --- Human notes ---

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Attendant notes added during or after resolution",
    )

    # --- Relationships ---

    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="escalations",
        lazy="selectin",
    )
    attended_by: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[attended_by_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Escalation id={self.id} reason={self.reason!r} "
            f"status={self.status!r} conversation_id={self.conversation_id}>"
        )
