"""Shared HTTP utilities for channel adapters.

Provides:
  - build_client()    — httpx.AsyncClient with timeout and retry
  - retry_request()   — exponential backoff wrapper (3 retries, base 1s, max 15s)
  - mask_token()      — sanitise Bearer / access_token values before logging

Retry logic mirrors the TypeScript axios-retry.ts:
  - Retries on 429, 502, 503, 504 and transient connection errors
  - Exponential backoff with full jitter: delay = random(0, min(base * 2^attempt, max))
"""

from __future__ import annotations

import asyncio
import random
from typing import Any

import httpx
import structlog

from app.core.circuit_breaker import CircuitBreaker, CircuitOpenError

logger = structlog.get_logger()

_MAX_RETRIES = 3
_BASE_DELAY = 1.0   # seconds
_MAX_DELAY = 15.0   # seconds

_RETRYABLE_STATUS = {429, 502, 503, 504}

# Per-service circuit breakers — shared across all adapter instances
_circuit_breakers: dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str) -> CircuitBreaker:
    """Return (or create) a named circuit breaker."""
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(
            name,
            failure_threshold=5,
            recovery_timeout=30.0,
        )
    return _circuit_breakers[name]


def mask_token(token: str) -> str:
    """Return a safe log representation: first 6 + last 4 chars only."""
    if len(token) <= 12:
        return "***"
    return f"{token[:6]}...{token[-4:]}"


def build_client(*, timeout: float = 30.0) -> httpx.AsyncClient:
    """Create a shared httpx.AsyncClient with a sensible timeout."""
    return httpx.AsyncClient(
        timeout=httpx.Timeout(timeout),
        headers={"Content-Type": "application/json"},
        follow_redirects=True,
    )


async def retry_request(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    log_prefix: str = "HTTP",
    **kwargs: Any,
) -> httpx.Response:
    """Execute an HTTP request with exponential backoff retry and circuit breaker.

    Raises httpx.HTTPStatusError for non-retryable 4xx/5xx on final attempt.
    Raises httpx.RequestError for network-level failures on final attempt.
    Raises CircuitOpenError if the circuit breaker is open.
    """
    cb = get_circuit_breaker(log_prefix)
    last_exc: Exception | None = None

    for attempt in range(_MAX_RETRIES + 1):
        try:
            async with cb:
                response = await client.request(method, url, **kwargs)

                if response.status_code in _RETRYABLE_STATUS and attempt < _MAX_RETRIES:
                    delay = _jitter_delay(attempt)
                    logger.warning(
                        f"[{log_prefix}] HTTP {response.status_code} — retrying in {delay:.1f}s",
                        attempt=attempt + 1,
                        max_retries=_MAX_RETRIES,
                    )
                    await asyncio.sleep(delay)
                    continue

                response.raise_for_status()
                return response

        except CircuitOpenError:
            raise

        except httpx.RequestError as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                delay = _jitter_delay(attempt)
                logger.warning(
                    f"[{log_prefix}] Network error ({exc.__class__.__name__}) — retrying in {delay:.1f}s",
                    attempt=attempt + 1,
                    max_retries=_MAX_RETRIES,
                )
                await asyncio.sleep(delay)
                continue
            raise

        except httpx.HTTPStatusError:
            raise

    # Should only be reached if all retries exhausted on RequestError
    raise last_exc  # type: ignore[misc]


def _jitter_delay(attempt: int) -> float:
    """Full-jitter exponential backoff: random(0, min(base * 2^attempt, max))."""
    cap = min(_BASE_DELAY * (2 ** attempt), _MAX_DELAY)
    return random.uniform(0, cap)
