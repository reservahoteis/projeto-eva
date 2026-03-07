"""Conversation model — represents a messaging thread with a contact.

A conversation is the central aggregate for the messaging/CRM pipeline:
it groups Messages, tracks escalation state, and carries the ia_locked
flag that controls whether the AI or a human attendant is responding.

status values : OPEN | IN_PROGRESS | WAITING | CLOSED | ARCHIVED | BOT_HANDLING
priority values: LOW | MEDIUM | HIGH | URGENT
channel values : WHATSAPP | MESSENGER | INSTAGRAM | EMAIL | SMS | WEB
source values  : n8n | manual | webhook
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.contact import Contact
    from app.models.escalation import Escalation
    from app.models.message import Message
    from app.models.tag import Tag
    from app.models.user import User


# Secondary table object — imported here so SQLAlchemy can resolve the
# many-to-many before the mapper configuration phase completes.
from app.models.conversation_tag import ConversationTag  # noqa: E402  (circular-safe at runtime)


class Conversation(TenantBase):
    """A messaging thread between the hotel and a contact."""

    __tablename__ = "conversations"

    __table_args__ = (
        # Most list-view queries filter by tenant + status (inbox views)
        Index("ix_conversations_tenant_id_status", "tenant_id", "status"),
        # Channel filtering (e.g. "show only WhatsApp threads")
        Index("ix_conversations_tenant_id_channel", "tenant_id", "channel"),
        # Attendant workload queries
        Index("ix_conversations_tenant_id_assigned_to_id", "tenant_id", "assigned_to_id"),
        # Chronological inbox sorted by last activity
        Index("ix_conversations_tenant_id_last_message_at", "tenant_id", "last_message_at"),
        # Sales pipeline filter — show only opportunity threads
        Index("ix_conversations_tenant_id_is_opportunity", "tenant_id", "is_opportunity"),
    )

    # --- Foreign keys ---

    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --- State fields ---

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="OPEN",
        comment="OPEN | IN_PROGRESS | WAITING | CLOSED | ARCHIVED | BOT_HANDLING",
    )
    priority: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="MEDIUM",
        comment="LOW | MEDIUM | HIGH | URGENT",
    )
    channel: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="WHATSAPP",
        comment="WHATSAPP | MESSENGER | INSTAGRAM | EMAIL | SMS | WEB",
    )

    # --- Operational fields ---

    hotel_unit: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ia_locked: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True when a human attendant has taken over; AI will not respond",
    )
    is_opportunity: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Marks conversations tracked as sales opportunities",
    )
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Denormalised timestamp of the most recent message for sort performance",
    )
    source: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="n8n | manual | webhook — how this conversation was created",
    )
    metadata_json: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Arbitrary extra data (e.g. UTM params, campaign ID)",
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    external_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="External reference ID (e.g. WhatsApp conversation ID)",
    )

    # --- Relationships ---

    contact: Mapped["Contact | None"] = relationship(
        "Contact",
        foreign_keys=[contact_id],
        lazy="selectin",
    )
    assigned_to: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[assigned_to_id],
        lazy="selectin",
    )

    # Collections use noload — callers fetch these explicitly to avoid
    # unbounded N+1 queries when listing conversations.
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        lazy="noload",
    )
    escalations: Mapped[list["Escalation"]] = relationship(
        "Escalation",
        back_populates="conversation",
        lazy="noload",
    )

    # Many-to-many via conversation_tags pivot
    tags: Mapped[list["Tag"]] = relationship(
        "Tag",
        secondary=ConversationTag.__table__,
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Conversation id={self.id} status={self.status!r} "
            f"channel={self.channel!r} tenant_id={self.tenant_id}>"
        )
