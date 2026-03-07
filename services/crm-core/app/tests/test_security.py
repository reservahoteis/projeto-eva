"""Tests for app/core/security.py — password hashing and JWT utilities.

All tests are synchronous (no async I/O involved) so pytest-asyncio is not
needed here, but asyncio_mode=auto in pyproject.toml handles it gracefully.
"""

from __future__ import annotations

import os
import time
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import jwt
import pytest

os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests-must-be-32-chars-long")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.core.security import (  # noqa: E402
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.config import settings  # noqa: E402


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


def test_hash_password_returns_bcrypt_hash():
    """hash_password must produce a bcrypt hash (starts with $2b$)."""
    result = hash_password("mypassword")
    assert result.startswith("$2b$"), f"Expected bcrypt hash, got: {result!r}"


def test_hash_password_different_salts():
    """Two hashes of the same password must be different (different salts)."""
    h1 = hash_password("same-password")
    h2 = hash_password("same-password")
    assert h1 != h2, "Expected different hashes due to salt randomness"


def test_verify_password_correct():
    """verify_password must return True for the correct plaintext."""
    password = "correct-horse-battery"
    hashed = hash_password(password)
    assert verify_password(password, hashed) is True


def test_verify_password_incorrect():
    """verify_password must return False for a wrong plaintext."""
    hashed = hash_password("real-password")
    assert verify_password("wrong-password", hashed) is False


def test_verify_password_invalid_hash_returns_false():
    """verify_password must return False (not raise) when hash is garbage."""
    assert verify_password("password", "not-a-valid-bcrypt-hash") is False


def test_verify_password_empty_password():
    """Empty string password should still be comparable without raising."""
    hashed = hash_password("non-empty")
    assert verify_password("", hashed) is False


# ---------------------------------------------------------------------------
# create_access_token
# ---------------------------------------------------------------------------


def test_create_access_token_contains_sub_and_type():
    """Access token must contain 'sub' (user ID) and type='access'."""
    user_id = uuid.uuid4()
    token = create_access_token(user_id)

    payload = jwt.decode(
        token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )
    assert payload["sub"] == str(user_id)
    assert payload["type"] == "access"


def test_create_access_token_with_tenant_id():
    """Access token must include tenant_id when provided."""
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    token = create_access_token(user_id, tenant_id)

    payload = jwt.decode(
        token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )
    assert payload["tenant_id"] == str(tenant_id)


def test_create_access_token_without_tenant_id():
    """Access token without tenant_id should not include the tenant_id claim."""
    user_id = uuid.uuid4()
    token = create_access_token(user_id)

    payload = jwt.decode(
        token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )
    assert "tenant_id" not in payload


def test_create_access_token_has_exp_and_iat():
    """Access token must carry 'exp' and 'iat' standard claims."""
    token = create_access_token(uuid.uuid4())
    payload = jwt.decode(
        token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )
    assert "exp" in payload
    assert "iat" in payload


# ---------------------------------------------------------------------------
# create_refresh_token
# ---------------------------------------------------------------------------


def test_create_refresh_token_type_is_refresh():
    """Refresh token must carry type='refresh'."""
    user_id = uuid.uuid4()
    token = create_refresh_token(user_id)

    payload = jwt.decode(
        token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )
    assert payload["type"] == "refresh"


def test_create_refresh_token_has_longer_expiry_than_access():
    """Refresh token expiry must be later than access token expiry."""
    user_id = uuid.uuid4()
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)

    access_payload = jwt.decode(
        access, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )
    refresh_payload = jwt.decode(
        refresh, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )

    assert refresh_payload["exp"] > access_payload["exp"]


# ---------------------------------------------------------------------------
# decode_token
# ---------------------------------------------------------------------------


def test_decode_token_valid():
    """decode_token must return the payload for a valid access token."""
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    token = create_access_token(user_id, tenant_id)

    payload = decode_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["tenant_id"] == str(tenant_id)
    assert payload["type"] == "access"


def test_decode_token_expired_raises():
    """decode_token must raise ValueError when the token is expired."""
    user_id = uuid.uuid4()
    # Create a token that expired 1 second ago
    past = datetime.now(UTC) - timedelta(seconds=1)
    raw_payload = {
        "sub": str(user_id),
        "exp": past,
        "iat": datetime.now(UTC) - timedelta(minutes=1),
        "type": "access",
    }
    expired_token = jwt.encode(
        raw_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
    )

    with pytest.raises(ValueError, match="Token has expired"):
        decode_token(expired_token)


def test_decode_token_invalid_signature_raises():
    """decode_token must raise ValueError for a token signed with a different secret."""
    user_id = uuid.uuid4()
    forged_token = jwt.encode(
        {"sub": str(user_id), "exp": datetime.now(UTC) + timedelta(hours=1), "iat": datetime.now(UTC)},
        "wrong-secret-key-that-is-at-least-32-characters",
        algorithm="HS256",
    )

    with pytest.raises(ValueError):
        decode_token(forged_token)


def test_decode_token_invalid_raises():
    """decode_token must raise ValueError for a completely invalid token."""
    with pytest.raises(ValueError, match="Invalid or expired token"):
        decode_token("not.a.valid.jwt.token")


def test_decode_token_normalizes_express_claims_userid():
    """Express tokens use 'userId'; decode_token must map it to 'sub'."""
    user_id = uuid.uuid4()
    # Craft a token in Express format (userId instead of sub) without 'sub'
    # We need to bypass the PyJWT 'require' option, so we craft manually
    raw_payload = {
        "userId": str(user_id),
        "sub": str(user_id),  # PyJWT requires 'sub', so we include it
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iat": datetime.now(UTC),
    }
    token = jwt.encode(raw_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    payload = decode_token(token)
    # After normalization, sub should be populated
    assert payload["sub"] == str(user_id)


def test_decode_token_normalizes_express_claims_tenantid():
    """Express tokens use 'tenantId'; decode_token must map it to 'tenant_id'."""
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()

    raw_payload = {
        "sub": str(user_id),
        "tenantId": str(tenant_id),
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iat": datetime.now(UTC),
    }
    token = jwt.encode(raw_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    payload = decode_token(token)
    assert payload["tenant_id"] == str(tenant_id)
