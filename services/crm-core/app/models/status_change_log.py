"""StatusChangeLog — immutable audit trail for Lead / Deal status transitions.

Intentionally uses Base instead of TenantBase:
- The log is accessed through its parent entity (Lead or Deal), which already
  carries tenant_id.  Adding tenant_id here would be redundant and would
  require a separate index to be kept consistent.
- This keeps the table lean and insert-fast — status changes happen on every
  pipeline movement and the table will grow large quickly.

Duration (Interval) records how long the entity spent in the previous status,
calculated at insert time by the service layer.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Interval, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StatusChangeLog(Base):
    __tablename__ = "status_change_logs"

    __table_args__ = (
        # Hottest query: all transitions for a given entity in chronological order
        Index("ix_scl_entity_type_entity_id_changed_at", "entity_type", "entity_id", "changed_at"),
        # Analytics: status funnel reports aggregate by entity_type + from/to status
        Index("ix_scl_entity_type_from_to", "entity_type", "from_status", "to_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Polymorphic reference — not a hard FK so the log survives entity deletion
    entity_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Lead | Deal",
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        comment="PK of the Lead or Deal that changed status",
    )

    # Transition
    from_status: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Status label before the change; NULL for the initial status assignment",
    )
    to_status: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Status label after the change",
    )

    # Actor
    changed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="NULL for automated/system-triggered transitions",
    )

    # Timing
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="UTC timestamp of the transition",
    )

    # Duration the entity spent in from_status before this transition.
    # Null on the first status assignment (no prior status to measure from).
    duration: Mapped[object | None] = mapped_column(
        Interval,
        nullable=True,
        comment="Time spent in from_status; calculated and stored by the service layer",
    )

    # --- Relationships ---

    changed_by = relationship(
        "User",
        foreign_keys=[changed_by_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<StatusChangeLog id={self.id} entity_type={self.entity_type!r} "
            f"entity_id={self.entity_id} {self.from_status!r}->{self.to_status!r}>"
        )
