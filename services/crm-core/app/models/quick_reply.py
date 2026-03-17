import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.user import User


class QuickReply(TenantBase):
    __tablename__ = "quick_replies"

    __table_args__ = (
        UniqueConstraint("tenant_id", "shortcut", name="uq_quick_replies_tenant_shortcut"),
    )

    # Content
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    shortcut: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Classification
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Ordering — lower values appear first in the list
    order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    # Soft-enable / disable without deleting the record
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

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
            f"<QuickReply id={self.id} shortcut={self.shortcut!r} "
            f"title={self.title!r} tenant_id={self.tenant_id}>"
        )
