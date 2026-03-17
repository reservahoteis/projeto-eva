"""Lightweight async circuit breaker for external service calls (MED-001).

States:
  CLOSED  -> normal operation; failures increment the counter
  OPEN    -> all calls fail-fast with CircuitOpenError
  HALF_OPEN -> one probe call is allowed; success closes, failure re-opens

Usage:
    cb = CircuitBreaker("meta-graph-api", failure_threshold=5, recovery_timeout=30)

    async with cb:
        response = await client.post(url, ...)
"""

from __future__ import annotations

import asyncio
import time
from enum import Enum

import structlog

logger = structlog.get_logger()


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitOpenError(Exception):
    """Raised when a call is attempted while the circuit is OPEN."""

    def __init__(self, name: str, retry_after: float):
        self.name = name
        self.retry_after = retry_after
        super().__init__(f"Circuit '{name}' is OPEN — retry after {retry_after:.1f}s")


class CircuitBreaker:
    """Async-safe circuit breaker with configurable thresholds."""

    def __init__(
        self,
        name: str,
        *,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 1,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time: float = 0
        self._half_open_calls = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_failure_time >= self.recovery_timeout:
                return CircuitState.HALF_OPEN
        return self._state

    async def __aenter__(self) -> CircuitBreaker:
        async with self._lock:
            current = self.state
            if current == CircuitState.OPEN:
                retry_after = self.recovery_timeout - (time.monotonic() - self._last_failure_time)
                raise CircuitOpenError(self.name, max(0.0, retry_after))

            if current == CircuitState.HALF_OPEN:
                if self._half_open_calls >= self.half_open_max_calls:
                    raise CircuitOpenError(self.name, self.recovery_timeout)
                self._half_open_calls += 1
                self._state = CircuitState.HALF_OPEN
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> bool:
        async with self._lock:
            if exc_type is None:
                self._on_success()
            else:
                self._on_failure()
        return False  # Do not suppress the exception

    def _on_success(self) -> None:
        if self._state in (CircuitState.HALF_OPEN, CircuitState.OPEN):
            logger.info(
                "circuit_breaker.closed",
                name=self.name,
                previous_failures=self._failure_count,
            )
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._half_open_calls = 0

    def _on_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_time = time.monotonic()

        if self._failure_count >= self.failure_threshold:
            prev = self._state
            self._state = CircuitState.OPEN
            self._half_open_calls = 0
            if prev != CircuitState.OPEN:
                logger.warning(
                    "circuit_breaker.opened",
                    name=self.name,
                    failure_count=self._failure_count,
                    recovery_timeout=self.recovery_timeout,
                )
