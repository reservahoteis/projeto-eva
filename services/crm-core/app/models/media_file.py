"""MediaFile model — binary assets attached to messages.

A single message may produce multiple MediaFile rows (e.g. a document
with a thumbnail preview).  The message_id FK is SET NULL so that media
records survive the deletion of their parent message for audit/storage
accounting purposes.

media_type values: image | video | audio | document
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.message import Message


class MediaFile(TenantBase):
    """Binary asset (image, video, audio, document) attached to a message."""

    __tablename__ = "media_files"

    __table_args__ = (
        # Gallery / media-library queries filtered by type within a tenant
        Index("ix_media_files_tenant_id_media_type", "tenant_id", "media_type"),
        # Fetch all attachments for a given message
        Index("ix_media_files_tenant_id_message_id", "tenant_id", "message_id"),
    )

    # --- Parent message ---

    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="SET NULL so the file record survives message deletion",
    )

    # --- File metadata ---

    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Original filename as reported by the sender or inferred from MIME type",
    )
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Path within the object-storage bucket (relative to storage root)",
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="IANA MIME type, e.g. image/jpeg, video/mp4",
    )
    file_size: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
        comment="File size in bytes; null if not yet known (async upload)",
    )
    media_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="image | video | audio | document",
    )

    # --- Remote origin ---

    external_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
        comment="Original CDN or platform URL before local copy was made",
    )

    # --- Integrity ---

    checksum: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        comment="SHA-256 hex digest of the file content; used for deduplication",
    )

    # --- Relationships ---

    message: Mapped["Message | None"] = relationship(
        "Message",
        back_populates="media_files",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<MediaFile id={self.id} file_name={self.file_name!r} "
            f"media_type={self.media_type!r} message_id={self.message_id}>"
        )
