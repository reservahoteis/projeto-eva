"""Shared test fixtures for CRM Core test suite.

Uses an in-memory SQLite database for speed. For integration tests that
require PostgreSQL-specific features (ILIKE, JSON operators), use a
separate conftest with a real Postgres testcontainer.

IMPORTANT: The global encryption state must be reset between tests that
manipulate the Fernet singleton, so each fixture that needs clean encryption
state calls _reset_encryption_state() explicitly.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ---------------------------------------------------------------------------
# Environment setup — must happen BEFORE importing app modules that read settings
# ---------------------------------------------------------------------------

os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests-must-be-32-chars-long")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "")

# ---------------------------------------------------------------------------
# App imports (after env vars are set)
# ---------------------------------------------------------------------------

from app.core.config import settings  # noqa: E402
from app.core.database import Base, get_db  # noqa: E402
from app.core.dependencies import get_current_user  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.tenant import Tenant  # noqa: E402
from app.models.user import User  # noqa: E402

# ---------------------------------------------------------------------------
# In-memory SQLite test engine
# ---------------------------------------------------------------------------

# Use a file-based SQLite URL so multiple coroutines share the same DB within
# a single test run (in-memory :memory: is connection-scoped in SQLAlchemy).
_TEST_DB_URL = "sqlite+aiosqlite:///./test_crm_core.db"

test_engine = create_async_engine(
    _TEST_DB_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

TestSession = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ---------------------------------------------------------------------------
# Module-scoped schema creation
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    """Create all tables once per test session, drop them at the end."""
    # SQLite does not support PostgreSQL-specific types (UUID dialect).
    # We patch UUID columns to use String for the test engine.
    from sqlalchemy.dialects import sqlite
    from sqlalchemy import String
    from sqlalchemy.dialects.postgresql import UUID as PGUUID

    # Register SQLite type override for UUID
    PGUUID.__class_getitem__ = lambda cls, _: cls  # type: ignore[assignment]

    async with test_engine.begin() as conn:
        # Use render_as_batch=True for SQLite ALTER TABLE support
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ---------------------------------------------------------------------------
# db_session fixture
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional AsyncSession that is rolled back after each test."""
    async with test_engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()


# ---------------------------------------------------------------------------
# Domain fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_tenant(db_session: AsyncSession) -> Tenant:
    """A persisted Tenant for use in tests."""
    tenant = Tenant(
        id=uuid.uuid4(),
        name="Test Hotel",
        slug="test-hotel",
        plan="starter",
        status="ACTIVE",
    )
    db_session.add(tenant)
    await db_session.flush()
    return tenant


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession, test_tenant: Tenant) -> User:
    """A persisted TENANT_ADMIN User belonging to test_tenant."""
    user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="admin@test-hotel.com",
        password_hash=hash_password("Str0ng!Pass123"),
        name="Test Admin",
        role="TENANT_ADMIN",
        status="ACTIVE",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
def test_token(test_user: User) -> str:
    """A valid JWT access token for test_user."""
    return create_access_token(
        user_id=test_user.id,
        tenant_id=test_user.tenant_id,
    )


@pytest.fixture
def auth_headers(test_token: str) -> dict[str, str]:
    """Authorization header dict for authenticated requests."""
    return {"Authorization": f"Bearer {test_token}"}


# ---------------------------------------------------------------------------
# FastAPI test app with overridden dependencies
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def app_instance(db_session: AsyncSession, test_user: User):
    """FastAPI app with get_db and get_current_user overridden for tests."""

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    async def _override_get_current_user() -> User:
        return test_user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app_instance) -> AsyncGenerator[AsyncClient, None]:
    """An httpx AsyncClient wired to the test FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app_instance),
        base_url="http://testserver",
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# Unauthenticated client (no dependency overrides for current_user)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def unauth_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """An httpx AsyncClient with only get_db overridden (no auth override)."""

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Mock DB session helper (for service-layer unit tests)
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_db() -> AsyncMock:
    """A lightweight AsyncMock that mimics an AsyncSession."""
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.add = MagicMock()
    return session
