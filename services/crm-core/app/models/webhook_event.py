"""WebhookEvent model — raw inbound webhook payloads persisted before processing.

Storing the raw payload before processing provides an idempotency anchor:
if the worker crashes mid-flight the event can be reprocessed from here
rather than relying on the upstream platform to resend.

source values: whatsapp | messenger | instagram | stripe
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantBase


class WebhookEvent(TenantBase):
    """Persisted copy of every inbound webhook payload."""

    __tablename__ = "webhook_events"

    __table_args__ = (
        # Filter unprocessed events per source for worker polling
        Index("ix_webhook_events_tenant_id_source", "tenant_id", "source"),
        # Reprocessing queue query: find all unprocessed events for a tenant
        Index("ix_webhook_events_tenant_id_processed", "tenant_id", "processed"),
    )

    # --- Provenance ---

    source: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="whatsapp | messenger | instagram | stripe",
    )
    event: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Event type string as reported by the upstream platform",
    )

    # --- Raw payload ---

    payload: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="Full JSON body of the inbound webhook, stored verbatim",
    )

    # --- Processing state ---

    processed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True once a worker has successfully handled this event",
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Last error message if processing failed; null on success",
    )

    def __repr__(self) -> str:
        return (
            f"<WebhookEvent id={self.id} source={self.source!r} "
            f"event={self.event!r} processed={self.processed} "
            f"tenant_id={self.tenant_id}>"
        )
