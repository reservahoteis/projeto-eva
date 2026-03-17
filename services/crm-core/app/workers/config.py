"""ARQ worker configuration.

Run the worker process with::

    arq app.workers.config.WorkerSettings

The WorkerSettings class is the single contract between this codebase and
the ARQ CLI.  Every async task function that should be callable as a
background job MUST be listed in ``WorkerSettings.functions``.

Redis settings are parsed from ``settings.REDIS_URL`` which follows the
standard ``redis://[user:password@]host[:port]/[db]`` URL scheme.
"""

from __future__ import annotations

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.core.config import settings

# ---------------------------------------------------------------------------
# Task function imports — listed here for discoverability; also registered
# in WorkerSettings.functions below.
# ---------------------------------------------------------------------------

from app.workers.process_incoming_message import process_incoming_message  # noqa: E402
from app.workers.process_outgoing_message import process_outgoing_message  # noqa: E402
from app.workers.process_status_update import process_status_update  # noqa: E402
from app.workers.process_media_download import process_media_download  # noqa: E402
from app.workers.process_ia_reactivation import process_ia_reactivation  # noqa: E402


# ---------------------------------------------------------------------------
# Redis settings parser
# ---------------------------------------------------------------------------


def get_redis_settings() -> RedisSettings:
    """Parse ``settings.REDIS_URL`` into an ``arq.connections.RedisSettings``.

    Supports the full ``redis://[user:password@]host[:port]/[db]`` format.
    ARQ's RedisSettings does not accept a URL string directly so we parse
    the components manually.

    Examples::

        redis://localhost:6379/0        -> host=localhost, port=6379, database=0
        redis://:password@host:6380/1  -> host=host, port=6380, password="password", database=1
    """
    url = settings.REDIS_URL

    # Strip scheme
    if url.startswith("redis://"):
        url = url[len("redis://"):]
    elif url.startswith("rediss://"):
        url = url[len("rediss://"):]

    # Split user-info from host-info: "user:pass@host:port/db"
    password: str | None = None
    if "@" in url:
        user_info, url = url.rsplit("@", 1)
        # We only use the password portion (username not used by Redis)
        if ":" in user_info:
            _, password = user_info.split(":", 1)
        else:
            password = user_info or None

    # Split database path from host+port
    database: int = 0
    if "/" in url:
        host_port, db_str = url.split("/", 1)
        try:
            database = int(db_str)
        except ValueError:
            database = 0
    else:
        host_port = url

    # Split host from port
    host: str = "localhost"
    port: int = 6379
    if ":" in host_port:
        host, port_str = host_port.rsplit(":", 1)
        try:
            port = int(port_str)
        except ValueError:
            port = 6379
    else:
        host = host_port or "localhost"

    return RedisSettings(
        host=host,
        port=port,
        password=password,
        database=database,
    )


# ---------------------------------------------------------------------------
# ARQ worker settings class
# ---------------------------------------------------------------------------


class WorkerSettings:
    """ARQ worker settings consumed by ``arq app.workers.config.WorkerSettings``.

    Attributes
    ----------
    redis_settings:
        Connection parameters derived from ``settings.REDIS_URL``.
    functions:
        All async task callables that the worker process will execute.
        The function's ``__name__`` is the routing key used when enqueueing.
    max_jobs:
        Maximum number of concurrent coroutines.  I/O-bound tasks (DB +
        HTTP) handle concurrency well; keep this ≤ DB pool size to avoid
        exhausting the connection pool.
    job_timeout:
        Seconds before a running job is declared timed-out.  Media
        downloads can be slow on large files; 5 minutes is generous.
    poll_delay:
        Seconds between Redis polls when the queue is empty.  0.5 s gives
        responsive throughput without spinning the CPU.
    keep_result:
        How long (seconds) successful job results are retained in Redis.
        3600 s (1 hour) is enough for debugging without accumulating stale
        keys indefinitely.
    retry_jobs:
        Allow ARQ to retry failed jobs (uses the job's ``retry`` counter
        if set, otherwise no automatic retry).  Each task decides whether
        to raise (triggering a retry) or return silently (consuming the job
        without retry).
    """

    redis_settings: RedisSettings = get_redis_settings()

    functions: list = [
        process_incoming_message,
        process_outgoing_message,
        process_status_update,
        process_media_download,
        process_ia_reactivation,
    ]

    max_jobs: int = 10
    job_timeout: int = 300       # 5 minutes
    poll_delay: float = 0.5      # seconds
    keep_result: int = 3600      # 1 hour
    retry_jobs: bool = True


# ---------------------------------------------------------------------------
# Shared Redis pool for enqueueing from application code
# ---------------------------------------------------------------------------

_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    """Return (or lazily create) the shared ARQ Redis connection pool.

    This pool is used by ``enqueue.py`` to submit jobs from FastAPI
    request handlers or other services.  The worker process has its own
    connection managed by ARQ internally.
    """
    global _pool
    if _pool is None:
        _pool = await create_pool(get_redis_settings())
    return _pool
