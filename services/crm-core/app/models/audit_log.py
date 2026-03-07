"""AuditLog model — immutable record of security and business-critical actions.

Rows are append-only; no row should ever be updated or deleted in production.
The old_data / new_data JSON columns enable full before/after diffing for
compliance queries.

action examples: LOGIN | CREATE_USER | UPDATE_USER | DELETE_USER |
                 CREATE_CONVERSATION | DELETE_CONVERSATION | EXPORT_DATA | ...
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantBase

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(TenantBase):
    """Immutable audit trail entry for a user action."""

    __tablename__ = "audit_logs"

    __table_args__ = (
        # Compliance queries typically filter by action type within a tenant
        Index("ix_audit_logs_tenant_id_action", "tenant_id", "action"),
        # Look up the full history for a specific entity (e.g. a deal)
        Index("ix_audit_logs_tenant_id_entity_entity_id", "tenant_id", "entity", "entity_id"),
        # Per-user activity feed
        Index("ix_audit_logs_tenant_id_user_id", "tenant_id", "user_id"),
        # Time-range scans (e.g. last 30 days of activity)
        Index("ix_audit_logs_tenant_id_created_at", "tenant_id", "created_at"),
    )

    # --- Actor ---

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Null for system-initiated actions (e.g. automated cleanups)",
    )

    # --- Action classification ---

    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Verb describing what happened, e.g. LOGIN, CREATE_USER, DELETE_CONVERSATION",
    )
    entity: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Resource type acted upon, e.g. User | Conversation | Contact",
    )
    entity_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="String PK of the affected row; String to accommodate any ID type",
    )

    # --- Before / after state ---

    old_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Serialised state of the entity before the action",
    )
    new_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Serialised state of the entity after the action",
    )

    # --- Extra context ---

    metadata_json: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Arbitrary extra data: user-agent, request ID, feature flags, etc.",
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        comment="IPv4 or IPv6 source address (45 chars covers full IPv6 with CIDR)",
    )

    # --- Relationships ---

    user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<AuditLog id={self.id} action={self.action!r} "
            f"entity={self.entity!r} entity_id={self.entity_id!r} "
            f"user_id={self.user_id} tenant_id={self.tenant_id}>"
        )
