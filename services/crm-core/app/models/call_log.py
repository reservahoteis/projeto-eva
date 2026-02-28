import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantBase


class CallLog(TenantBase):
    __tablename__ = "call_logs"

    __table_args__ = (
        # Call logs are queried by caller/receiver phone numbers within a tenant
        # and also by the referenced CRM document.
        Index("ix_call_logs_tenant_id_caller", "tenant_id", "caller"),
        Index("ix_call_logs_tenant_id_reference", "tenant_id", "reference_doctype", "reference_docname"),
    )

    # Parties
    caller: Mapped[str] = mapped_column(String(100), nullable=False)
    receiver: Mapped[str] = mapped_column(String(100), nullable=False)

    # Classification
    type: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Incoming | Outgoing | Missed",
    )
    status: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        comment=(
            "Ringing | In Progress | Completed | Failed | "
            "Busy | No Answer | Queued | Canceled | Unknown"
        ),
    )

    # Metrics
    duration: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Duration in seconds",
    )

    # Timeline
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Recording / notes
    recording_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Channel
    telephony_medium: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="Manual",
        comment="Manual | Twilio",
    )

    # Polymorphic reference
    reference_doctype: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Lead | Deal | Contact",
    )
    reference_docname: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        comment="PK of the referenced document",
    )

    def __repr__(self) -> str:
        return (
            f"<CallLog id={self.id} caller={self.caller!r} "
            f"receiver={self.receiver!r} status={self.status!r} tenant_id={self.tenant_id}>"
        )
