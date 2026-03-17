import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.user import User


class Note(TenantBase):
    __tablename__ = "notes"

    __table_args__ = (
        # Notes are almost always fetched scoped to a particular document;
        # this index makes those lookups instant.
        Index("ix_notes_tenant_id_reference", "tenant_id", "reference_doctype", "reference_docname"),
    )

    # Content
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Polymorphic reference
    reference_doctype: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Lead | Deal | Contact | Organization",
    )
    reference_docname: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        comment="PK of the referenced document",
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
            f"<Note id={self.id} title={self.title!r} "
            f"reference_doctype={self.reference_doctype!r} tenant_id={self.tenant_id}>"
        )
