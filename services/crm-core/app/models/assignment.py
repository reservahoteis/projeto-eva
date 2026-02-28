"""Assignment models.

Two tables:
  Assignment      — records that a specific document is assigned to a user
  AssignmentRule  — automated assignment configuration (round-robin / load balancing)
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.user import User


# ---------------------------------------------------------------------------
# Assignment
# ---------------------------------------------------------------------------

class Assignment(TenantBase):
    __tablename__ = "assignments"

    __table_args__ = (
        # Most queries filter by the referenced document; also need to find
        # all open assignments for a given user.
        Index("ix_assignments_tenant_doctype_docname", "tenant_id", "doctype", "docname"),
        Index("ix_assignments_tenant_assigned_to_status", "tenant_id", "assigned_to_id", "status"),
    )

    # Polymorphic reference to the assigned document
    doctype: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Lead | Deal | Contact | Organization | Task",
    )
    docname: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        comment="PK of the referenced document",
    )

    # Parties
    assigned_to_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Lifecycle
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="Open",
        comment="Open | Completed | Cancelled",
    )

    # --- Relationships ---

    assigned_to: Mapped["User"] = relationship(
        "User",
        foreign_keys=[assigned_to_id],
        lazy="selectin",
    )
    assigned_by: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[assigned_by_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Assignment id={self.id} doctype={self.doctype!r} "
            f"docname={self.docname} assigned_to_id={self.assigned_to_id} "
            f"status={self.status!r}>"
        )


# ---------------------------------------------------------------------------
# AssignmentRule
# ---------------------------------------------------------------------------

class AssignmentRule(TenantBase):
    __tablename__ = "assignment_rules"

    __table_args__ = (
        Index("ix_assignment_rules_tenant_id_doctype", "tenant_id", "doctype"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    doctype: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Lead | Deal — doctype this rule targets",
    )

    # Optional Jinja/Python expression evaluated against the document to decide
    # whether this rule should trigger.  Null means "always trigger".
    assign_condition: Mapped[str | None] = mapped_column(Text, nullable=True)

    assignment_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="round_robin",
        comment="round_robin | load_balancing",
    )

    # JSON array of user IDs that form the assignment pool.
    # Stored as Text for portability; validated/parsed at the service layer.
    users_json: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="JSON array of user UUIDs eligible for assignment",
    )

    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return (
            f"<AssignmentRule id={self.id} name={self.name!r} "
            f"doctype={self.doctype!r} type={self.assignment_type!r} "
            f"enabled={self.enabled} tenant_id={self.tenant_id}>"
        )
