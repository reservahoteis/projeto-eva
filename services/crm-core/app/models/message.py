"""Message model — individual message within a conversation thread.

direction values: INBOUND | OUTBOUND
type values     : TEXT | IMAGE | VIDEO | AUDIO | DOCUMENT | LOCATION |
                  STICKER | TEMPLATE | INTERACTIVE
status values   : SENT | DELIVERED | READ | FAILED
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.media_file import MediaFile


class Message(TenantBase):
    """A single message exchanged within a conversation."""

    __tablename__ = "messages"

    __table_args__ = (
        # Unique constraint on external_message_id when present — prevents
        # duplicate ingestion of the same webhook delivery.
        UniqueConstraint(
            "external_message_id",
            name="uq_messages_external_message_id",
        ),
        # Primary inbox query: fetch messages for a tenant's conversation
        Index("ix_messages_tenant_id_conversation_id", "tenant_id", "conversation_id"),
        # Global audit / analytics queries scoped to tenant + time window
        Index("ix_messages_tenant_id_timestamp", "tenant_id", "timestamp"),
        # Chronological fetch within a single conversation (no tenant scope
        # needed here because conversation_id already implies the tenant)
        Index("ix_messages_conversation_id_timestamp", "conversation_id", "timestamp"),
    )

    # --- Foreign keys ---

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Channel-level identity ---

    external_message_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        comment="Platform message ID (e.g. WhatsApp wamid) — used for deduplication",
    )

    # --- Message content ---

    direction: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="INBOUND | OUTBOUND",
    )
    type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="TEXT",
        comment="TEXT | IMAGE | VIDEO | AUDIO | DOCUMENT | LOCATION | STICKER | TEMPLATE | INTERACTIVE",
    )
    content: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Plain-text body; null for pure media messages",
    )
    metadata_json: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Media URL, button payloads, location coords, template params, etc.",
    )

    # --- Delivery tracking ---

    status: Mapped[str] = mapped_column(
        String(15),
        nullable=False,
        default="SENT",
        comment="SENT | DELIVERED | READ | FAILED",
    )
    error_info: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Populated when status=FAILED; stores error code/message from the channel",
    )

    # --- Timing ---

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Channel-reported send time; falls back to server ingestion time",
    )

    # --- Sender identity (for inbound messages the contact name may not yet
    # be resolved to a Contact row) ---

    sender_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # --- Relationships ---

    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="messages",
        lazy="selectin",
    )

    # Media attachments — noload because they are fetched on-demand in the
    # message detail view, not in list queries.
    media_files: Mapped[list["MediaFile"]] = relationship(
        "MediaFile",
        back_populates="message",
        lazy="noload",
    )

    def __repr__(self) -> str:
        return (
            f"<Message id={self.id} direction={self.direction!r} "
            f"type={self.type!r} status={self.status!r} "
            f"conversation_id={self.conversation_id}>"
        )
