"""Pivot table linking conversations to tags (many-to-many).

Kept intentionally minimal — it is a pure junction table with no extra
columns.  The composite PK naturally enforces uniqueness without a
separate UniqueConstraint.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ConversationTag(Base):
    """Association table between conversations and tags."""

    __tablename__ = "conversation_tags"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<ConversationTag conversation_id={self.conversation_id} "
            f"tag_id={self.tag_id}>"
        )
