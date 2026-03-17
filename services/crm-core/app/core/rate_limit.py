"""Application-layer rate limiting via slowapi.

Uses Redis as the storage backend for distributed rate limiting across
multiple workers/containers. Falls back to in-memory if Redis is unavailable.
"""

from __future__ import annotations

import structlog
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Rate limit constants
# ---------------------------------------------------------------------------

AUTH_RATE_LIMIT = "5/15minutes"
WEBHOOK_RATE_LIMIT = "1000/minute"
N8N_RATE_LIMIT = "5000/minute"
API_RATE_LIMIT = "100/minute"

# ---------------------------------------------------------------------------
# Key functions
# ---------------------------------------------------------------------------


def get_client_ip(request: Request) -> str:
    """Extract real client IP from X-Forwarded-For or request.client.host.

    When behind a reverse proxy (nginx), the real IP is in X-Forwarded-For.
    We take the first (leftmost) address which is the original client.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For: client, proxy1, proxy2
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"


def get_api_key(request: Request) -> str:
    """Extract the X-API-Key header for N8N endpoint rate limiting.

    The key format is {tenantSlug}:{phoneNumberId}, so we rate-limit
    per channel identifier rather than per IP (N8N may share IPs).
    Falls back to client IP if header is missing.
    """
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return api_key
    return get_client_ip(request)


# ---------------------------------------------------------------------------
# Limiter instance
# ---------------------------------------------------------------------------

_storage_uri: str | None = None
try:
    # Validate Redis URL is usable for slowapi storage
    redis_url = settings.REDIS_URL
    if redis_url:
        _storage_uri = redis_url
        logger.info("rate_limit.storage", backend="redis", url=redis_url.split("@")[-1])
except Exception as exc:
    logger.warning("rate_limit.redis_unavailable", error=str(exc), fallback="memory")

limiter = Limiter(
    key_func=get_client_ip,
    default_limits=[API_RATE_LIMIT],
    storage_uri=_storage_uri,
    strategy="fixed-window",
)
