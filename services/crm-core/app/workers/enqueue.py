"""Enqueue helper — submit background jobs from application code.

Usage example (inside a FastAPI route or service)::

    from app.workers.enqueue import enqueue_task

    job_id = await enqueue_task(
        "process_incoming_message",
        tenant_id=str(tenant.id),
        contact_phone=message.from_,
        channel="WHATSAPP",
        message_data={...},
    )

The ``task_name`` must match the ``__name__`` of a function registered in
``WorkerSettings.functions``.  ARQ uses the function name as the routing
key; mismatches result in the job sitting in Redis forever without being
consumed.

All keyword arguments are serialised to JSON by ARQ and passed to the task
function as ``**kwargs`` when it runs.  Arguments must therefore be JSON-
serialisable (str, int, float, bool, list, dict, None).  Pass UUIDs as
``str(uuid_value)`` before enqueueing.
"""

from __future__ import annotations

import structlog

from app.workers.config import get_arq_pool

logger = structlog.get_logger()


async def enqueue_task(task_name: str, **kwargs) -> str:
    """Enqueue a background task and return the ARQ job ID.

    Parameters
    ----------
    task_name:
        Must match the ``__name__`` of a registered worker function
        (e.g. ``"process_incoming_message"``).
    **kwargs:
        Keyword arguments forwarded verbatim to the task function.
        All values must be JSON-serialisable.

    Returns
    -------
    str
        The ARQ job ID (a UUID string).  Can be used with the ARQ job
        status API to poll or cancel the job if needed.

    Raises
    ------
    RuntimeError
        If the Redis connection cannot be established.
    """
    pool = await get_arq_pool()
    job = await pool.enqueue_job(task_name, **kwargs)

    if job is None:
        # ARQ returns None if the job is a duplicate (same job ID already
        # queued).  This is a safety net; our tasks are idempotent, so
        # duplicate submission is harmless but we log it for observability.
        logger.warning(
            "worker_enqueue_duplicate",
            task_name=task_name,
        )
        return ""

    logger.debug(
        "worker_enqueued",
        task_name=task_name,
        job_id=job.job_id,
    )
    return job.job_id


async def enqueue_incoming_message(
    *,
    tenant_id: str,
    contact_phone: str | None = None,
    contact_external_id: str | None = None,
    contact_name: str | None = None,
    channel: str,
    message_data: dict,
) -> str:
    """Typed helper for enqueueing an inbound message processing job.

    Parameters
    ----------
    tenant_id:
        UUID string of the tenant that owns this conversation.
    contact_phone:
        E.164-formatted phone number (used for WhatsApp contacts).
    contact_external_id:
        Platform-specific user ID (used for Messenger/Instagram contacts).
    contact_name:
        Display name from the channel profile, if available.
    channel:
        One of: ``WHATSAPP``, ``MESSENGER``, ``INSTAGRAM``.
    message_data:
        Dict containing ``type``, ``content``, ``external_id``,
        ``timestamp``, and optional ``media`` sub-dict.
    """
    return await enqueue_task(
        "process_incoming_message",
        tenant_id=tenant_id,
        contact_phone=contact_phone,
        contact_external_id=contact_external_id,
        contact_name=contact_name,
        channel=channel,
        message_data=message_data,
    )


async def enqueue_outgoing_message(
    *,
    tenant_id: str,
    conversation_id: str,
    message_id: str,
    recipient_id: str,
    channel: str,
    content: str,
    type: str = "TEXT",
    metadata: dict | None = None,
) -> str:
    """Typed helper for enqueueing an outbound message send job."""
    return await enqueue_task(
        "process_outgoing_message",
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        message_id=message_id,
        recipient_id=recipient_id,
        channel=channel,
        content=content,
        type=type,
        metadata=metadata or {},
    )


async def enqueue_status_update(
    *,
    external_message_id: str,
    status: str,
    error_info: str | None = None,
    raw_payload: dict | None = None,
) -> str:
    """Typed helper for enqueueing a delivery-status update job."""
    return await enqueue_task(
        "process_status_update",
        external_message_id=external_message_id,
        status=status,
        error_info=error_info,
        raw_payload=raw_payload or {},
    )


async def enqueue_media_download(
    *,
    tenant_id: str,
    message_id: str,
    media_id: str,
    media_type: str,
    mime_type: str,
    channel: str = "WHATSAPP",
) -> str:
    """Typed helper for enqueueing a media download job."""
    return await enqueue_task(
        "process_media_download",
        tenant_id=tenant_id,
        message_id=message_id,
        media_id=media_id,
        media_type=media_type,
        mime_type=mime_type,
        channel=channel,
    )


async def enqueue_ia_reactivation(
    *,
    tenant_id: str,
    conversation_id: str,
    defer_seconds: int = 0,
) -> str:
    """Typed helper for enqueueing an IA reactivation job.

    Parameters
    ----------
    defer_seconds:
        If > 0, the job will be held in Redis and executed after this
        many seconds (ARQ deferred jobs).  Pass ``3600`` to reactivate
        the AI one hour after a follow-up, matching the BullMQ behaviour.
    """
    pool = await get_arq_pool()

    if defer_seconds > 0:
        import asyncio
        from datetime import datetime, timezone

        run_at = datetime.now(tz=timezone.utc).timestamp() + defer_seconds
        job = await pool.enqueue_job(
            "process_ia_reactivation",
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            _defer_until=datetime.fromtimestamp(run_at, tz=timezone.utc),
        )
    else:
        job = await pool.enqueue_job(
            "process_ia_reactivation",
            tenant_id=tenant_id,
            conversation_id=conversation_id,
        )

    if job is None:
        logger.warning(
            "worker_enqueue_duplicate",
            task_name="process_ia_reactivation",
            conversation_id=conversation_id,
        )
        return ""

    logger.debug(
        "worker_enqueued",
        task_name="process_ia_reactivation",
        job_id=job.job_id,
        conversation_id=conversation_id,
        defer_seconds=defer_seconds,
    )
    return job.job_id
