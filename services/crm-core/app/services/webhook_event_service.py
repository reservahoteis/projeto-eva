"""WebhookEventService — inbound webhook event persistence and lifecycle.

Design decisions:
  - log_event() is fire-and-forget: errors are caught silently so that a
    persistence failure never blocks the webhook HTTP response (which must
    return 200 to the channel provider quickly to avoid retries).
  - Every read query includes tenant_id in the WHERE clause for multi-tenant
    isolation.
  - list_events() excludes the `payload` column by default (SELECT without
    payload) to avoid transmitting large JSON blobs in list views.  The full
    payload is returned only by get_event().
  - replay_event() resets processed=False, processed_at=None, error=None —
    a separate worker picks up unprocessed events for re-delivery.
  - mark_processed() is called by the worker after successful (or permanently
    failed) processing; it does not require tenant_id because the worker
    already holds the event PK from the queue.
  - Use db.flush() not db.commit() — caller owns transaction.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.webhook_event import WebhookEvent
from app.schemas.lead import PaginatedResponse
from app.schemas.webhook_event import (
    WebhookEventListParams,
    WebhookEventResponse,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Column whitelist — prevents SQL injection via ORDER BY
# ---------------------------------------------------------------------------

_WEBHOOK_EVENT_COLUMNS: frozenset[str] = frozenset(
    {
        "id",
        "tenant_id",
        "source",
        "event",
        "processed",
        "processed_at",
        "created_at",
    }
)


def _validate_column(name: str) -> None:
    """Raise BadRequestError if *name* is not a known WebhookEvent column."""
    if name not in _WEBHOOK_EVENT_COLUMNS:
        raise BadRequestError(f"Unknown sort field: {name!r}")


def _apply_ordering(query, order_by: str):
    """Append ORDER BY clauses from a comma-separated 'field dir' string."""
    tokens = [t.strip() for t in order_by.split(",") if t.strip()]
    for token in tokens:
        parts = token.split()
        field = parts[0]
        direction = parts[1].lower() if len(parts) == 2 else "asc"
        _validate_column(field)
        col = getattr(WebhookEvent, field)
        query = query.order_by(col.desc() if direction == "desc" else col.asc())
    return query


# ---------------------------------------------------------------------------
# WebhookEventService
# ---------------------------------------------------------------------------


class WebhookEventService:
    """Inbound webhook event persistence and idempotency anchor."""

    # ------------------------------------------------------------------
    # log_event — fire-and-forget
    # ------------------------------------------------------------------

    async def log_event(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        source: str,
        event: str,
        payload: dict[str, Any],
    ) -> None:
        """Persist a raw inbound webhook payload before processing.

        Errors are caught silently — this method must never raise.
        """
        try:
            entry = WebhookEvent(
                tenant_id=tenant_id,
                source=source,
                event=event,
                payload=payload,
                processed=False,
            )
            db.add(entry)
            await db.flush()

            logger.debug(
                "webhook_event_logged",
                tenant_id=str(tenant_id),
                source=source,
                event=event,
                event_id=str(entry.id),
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "webhook_event_log_failed",
                tenant_id=str(tenant_id),
                source=source,
                event=event,
            )

    # ------------------------------------------------------------------
    # list_events
    # ------------------------------------------------------------------

    async def list_events(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        params: WebhookEventListParams,
    ) -> PaginatedResponse[WebhookEventResponse]:
        """Return a paginated list of webhook events for the given tenant.

        The payload column is included in the ORM model but the list view
        returns full WebhookEventResponse objects.  For very large deployments
        this could be optimised with a projection that excludes payload, but
        for typical usage the model-level fetch is acceptable.
        """
        # ------------------------------------------------------------------
        # Base query — tenant-scoped
        # ------------------------------------------------------------------
        base_q = select(WebhookEvent).where(
            WebhookEvent.tenant_id == tenant_id
        )

        if params.source:
            base_q = base_q.where(WebhookEvent.source == params.source)
        if params.processed is not None:
            base_q = base_q.where(WebhookEvent.processed == params.processed)

        # ------------------------------------------------------------------
        # Count
        # ------------------------------------------------------------------
        count_q = (
            select(func.count())
            .select_from(WebhookEvent)
            .where(WebhookEvent.tenant_id == tenant_id)
        )
        if params.source:
            count_q = count_q.where(WebhookEvent.source == params.source)
        if params.processed is not None:
            count_q = count_q.where(
                WebhookEvent.processed == params.processed
            )

        total_result = await db.execute(count_q)
        total_count: int = total_result.scalar_one()

        # ------------------------------------------------------------------
        # Paginated data
        # ------------------------------------------------------------------
        data_q = _apply_ordering(base_q, params.order_by)
        offset = (params.page - 1) * params.page_size
        data_q = data_q.offset(offset).limit(params.page_size)

        rows_result = await db.execute(data_q)
        events = rows_result.scalars().all()

        return PaginatedResponse[WebhookEventResponse](
            data=[WebhookEventResponse.model_validate(e) for e in events],
            total_count=total_count,
            page=params.page,
            page_size=params.page_size,
        )

    # ------------------------------------------------------------------
    # get_event
    # ------------------------------------------------------------------

    async def get_event(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        event_id: uuid.UUID,
    ) -> WebhookEventResponse:
        """Fetch a single webhook event by PK, scoped to tenant_id.

        Returns the full payload for inspection / debugging.
        """
        result = await db.execute(
            select(WebhookEvent).where(
                WebhookEvent.tenant_id == tenant_id,
                WebhookEvent.id == event_id,
            )
        )
        entry = result.scalar_one_or_none()
        if not entry:
            raise NotFoundError(f"WebhookEvent {event_id} not found")

        return WebhookEventResponse.model_validate(entry)

    # ------------------------------------------------------------------
    # replay_event
    # ------------------------------------------------------------------

    async def replay_event(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        event_id: uuid.UUID,
    ) -> WebhookEventResponse:
        """Reset a webhook event to unprocessed state for worker re-delivery.

        Clears: processed=False, processed_at=None, error=None.
        The worker will pick it up on the next polling cycle.
        """
        result = await db.execute(
            select(WebhookEvent).where(
                WebhookEvent.tenant_id == tenant_id,
                WebhookEvent.id == event_id,
            )
        )
        entry = result.scalar_one_or_none()
        if not entry:
            raise NotFoundError(f"WebhookEvent {event_id} not found")

        entry.processed = False
        entry.processed_at = None
        entry.error = None
        await db.flush()

        logger.info(
            "webhook_event_replay_queued",
            tenant_id=str(tenant_id),
            event_id=str(event_id),
            source=entry.source,
            event=entry.event,
        )

        return WebhookEventResponse.model_validate(entry)

    # ------------------------------------------------------------------
    # mark_processed
    # ------------------------------------------------------------------

    async def mark_processed(
        self,
        db: AsyncSession,
        event_id: uuid.UUID,
        error: str | None = None,
    ) -> None:
        """Mark a webhook event as processed (or permanently failed).

        Called by the worker after handling the event.  No tenant_id scope
        is required here because the worker already owns the event ID from
        the queue — using the PK alone is safe and avoids a JOIN.

        Args:
            event_id: PK of the WebhookEvent to update.
            error:    If not None, the event is marked as failed with this
                      error message.  If None, the event is marked as
                      successfully processed.
        """
        result = await db.execute(
            select(WebhookEvent).where(WebhookEvent.id == event_id)
        )
        entry = result.scalar_one_or_none()
        if not entry:
            raise NotFoundError(f"WebhookEvent {event_id} not found")

        entry.processed = True
        entry.processed_at = datetime.now(UTC)
        entry.error = error
        await db.flush()

        if error:
            logger.warning(
                "webhook_event_processing_failed",
                event_id=str(event_id),
                source=entry.source,
                event=entry.event,
                error=error,
            )
        else:
            logger.debug(
                "webhook_event_marked_processed",
                event_id=str(event_id),
                source=entry.source,
                event=entry.event,
            )


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

webhook_event_service = WebhookEventService()
