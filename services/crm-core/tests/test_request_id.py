"""Tests for Request ID middleware (MED-006)."""

from __future__ import annotations

import os

import pytest
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests-must-be-32-chars-long")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.main import app


@pytest.mark.asyncio
async def test_request_id_generated_when_absent():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        request_id = resp.headers.get("X-Request-ID")
        assert request_id is not None
        assert len(request_id) == 36  # UUID format


@pytest.mark.asyncio
async def test_request_id_reused_when_provided():
    custom_id = "my-custom-request-id-12345"
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        resp = await client.get("/health", headers={"X-Request-ID": custom_id})
        assert resp.status_code == 200
        assert resp.headers.get("X-Request-ID") == custom_id
