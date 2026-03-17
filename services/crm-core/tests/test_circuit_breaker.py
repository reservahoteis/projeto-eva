"""Tests for app/core/circuit_breaker.py — async circuit breaker pattern."""

import os

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests-must-be-32-chars-long")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.core.circuit_breaker import CircuitBreaker, CircuitOpenError, CircuitState


@pytest.mark.asyncio
async def test_circuit_starts_closed():
    cb = CircuitBreaker("test", failure_threshold=3, recovery_timeout=1.0)
    assert cb.state == CircuitState.CLOSED


@pytest.mark.asyncio
async def test_circuit_stays_closed_on_success():
    cb = CircuitBreaker("test", failure_threshold=3)
    async with cb:
        pass  # success
    assert cb.state == CircuitState.CLOSED
    assert cb._failure_count == 0


@pytest.mark.asyncio
async def test_circuit_opens_after_threshold_failures():
    cb = CircuitBreaker("test", failure_threshold=3, recovery_timeout=60.0)
    for _ in range(3):
        try:
            async with cb:
                raise ConnectionError("fail")
        except ConnectionError:
            pass
    assert cb.state == CircuitState.OPEN


@pytest.mark.asyncio
async def test_circuit_open_raises_error():
    cb = CircuitBreaker("test", failure_threshold=1, recovery_timeout=60.0)
    try:
        async with cb:
            raise ConnectionError("fail")
    except ConnectionError:
        pass

    with pytest.raises(CircuitOpenError) as exc_info:
        async with cb:
            pass  # should not reach here

    assert "OPEN" in str(exc_info.value)


@pytest.mark.asyncio
async def test_circuit_resets_on_success_after_failures():
    cb = CircuitBreaker("test", failure_threshold=5)
    # Add 4 failures (below threshold)
    for _ in range(4):
        try:
            async with cb:
                raise ConnectionError("fail")
        except ConnectionError:
            pass
    assert cb._failure_count == 4

    # One success resets
    async with cb:
        pass
    assert cb._failure_count == 0
    assert cb.state == CircuitState.CLOSED


@pytest.mark.asyncio
async def test_circuit_half_open_after_recovery_timeout():
    cb = CircuitBreaker("test", failure_threshold=1, recovery_timeout=0.0)
    try:
        async with cb:
            raise ConnectionError("fail")
    except ConnectionError:
        pass

    # recovery_timeout=0.0 means immediately half-open
    assert cb.state == CircuitState.HALF_OPEN


@pytest.mark.asyncio
async def test_circuit_closes_on_half_open_success():
    cb = CircuitBreaker("test", failure_threshold=1, recovery_timeout=0.0)
    try:
        async with cb:
            raise ConnectionError("fail")
    except ConnectionError:
        pass

    # Half-open probe succeeds
    async with cb:
        pass
    assert cb.state == CircuitState.CLOSED
