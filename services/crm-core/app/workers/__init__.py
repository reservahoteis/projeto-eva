"""ARQ async task workers for CRM Core.

All long-running or I/O-bound work that originates from inbound webhooks
is processed here so that the HTTP request-response cycle stays fast.

Worker process entrypoint
-------------------------
Run the worker with::

    arq app.workers.config.WorkerSettings

The worker connects to Redis (REDIS_URL in settings), picks up jobs from
the queues registered in WorkerSettings.functions, and runs them with
asyncio concurrency.

Queue names follow ARQ conventions: each enqueued job carries the
function name as its routing key.  No explicit queue-name configuration
is required — ARQ uses a single default queue backed by Redis sorted sets.
"""
