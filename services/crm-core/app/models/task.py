import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import CreatedByMixin, TenantBase

if TYPE_CHECKING:
    from app.models.user import User


class Task(TenantBase, CreatedByMixin):
    __tablename__ = "tasks"

    __table_args__ = (
        # Most task list queries filter by tenant + assignee or tenant + status;
        # this covering index serves both patterns efficiently.
        Index("ix_tasks_tenant_id_assigned_to_id", "tenant_id", "assigned_to_id"),
        Index("ix_tasks_tenant_id_status", "tenant_id", "status"),
    )

    # Content
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Classification
    priority: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="Low",
        comment="Low | Medium | High",
    )
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="Backlog",
        comment="Backlog | Todo | In Progress | Done | Canceled",
    )

    # Ownership
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Scheduling
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Polymorphic reference — links this task to any CRM doctype (Lead, Deal…)
    # without enforcing a rigid FK so a single tasks table covers all entities.
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

    # --- Relationships ---

    assigned_to: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[assigned_to_id],
        lazy="selectin",
    )
    created_by: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[CreatedByMixin.created_by_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Task id={self.id} title={self.title!r} "
            f"status={self.status!r} tenant_id={self.tenant_id}>"
        )
