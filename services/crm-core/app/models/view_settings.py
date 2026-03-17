"""ViewSettings — per-user / per-tenant saved views.

Each row represents a named view configuration for a given doctype (Lead,
Deal, …).  Views can be private (user_id set) or public (user_id NULL,
visible to all users in the tenant).  Standard views shipped with the
application are marked is_standard=True and cannot be deleted by end-users.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.user import User


class ViewSettings(TenantBase):
    __tablename__ = "view_settings"

    __table_args__ = (
        # Primary lookup: all saved views for a user on a given doctype
        Index("ix_view_settings_tenant_doctype_user", "tenant_id", "doctype", "user_id"),
        # Quick lookup for public defaults
        Index("ix_view_settings_tenant_doctype_public", "tenant_id", "doctype", "is_public", "is_default"),
    )

    # Scope
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="NULL = shared across all users in the tenant",
    )
    doctype: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Lead | Deal | Contact | Organization | Task | …",
    )

    # Presentation
    view_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="list",
        comment="list | kanban | group_by",
    )
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Layout / filter payloads stored as JSON text.  Using Text instead of
    # JSONB keeps the schema database-agnostic during early development; can
    # be migrated to JSONB later for GIN indexing if needed.
    columns_json: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="JSON array of column definitions",
    )
    rows_json: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="JSON array of row group-by definitions",
    )
    filters_json: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="JSON array of active filter conditions",
    )
    order_by: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Column name optionally followed by ASC/DESC",
    )

    # Flags
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_standard: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True for views seeded by migrations — cannot be deleted via UI",
    )

    # --- Relationships ---

    user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<ViewSettings id={self.id} doctype={self.doctype!r} "
            f"view_type={self.view_type!r} label={self.label!r} tenant_id={self.tenant_id}>"
        )
