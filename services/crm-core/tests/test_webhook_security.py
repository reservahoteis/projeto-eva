"""Tests for app/webhooks/security.py — HMAC-SHA256 webhook signature validation."""

from __future__ import annotations

import hashlib
import hmac
import os

os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests-must-be-32-chars-long")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.webhooks.security import validate_webhook_signature


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _compute_signature(payload: bytes, secret: str) -> str:
    """Compute a valid sha256=<hex> signature for testing."""
    digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_valid_signature_returns_true():
    payload = b'{"object":"page","entry":[]}'
    secret = "my-app-secret"
    sig = _compute_signature(payload, secret)
    assert validate_webhook_signature(payload, sig, secret) is True


def test_invalid_signature_returns_false():
    payload = b'{"object":"page","entry":[]}'
    secret = "my-app-secret"
    assert validate_webhook_signature(payload, "sha256=deadbeef", secret) is False


def test_signature_with_sha256_prefix():
    payload = b"test payload"
    secret = "secret123"
    sig = _compute_signature(payload, secret)
    assert sig.startswith("sha256=")
    assert validate_webhook_signature(payload, sig, secret) is True


def test_signature_without_prefix():
    payload = b"test payload"
    secret = "secret123"
    digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    # Pass raw hex without sha256= prefix
    assert validate_webhook_signature(payload, digest, secret) is True


def test_empty_secret_returns_false():
    payload = b"test"
    assert validate_webhook_signature(payload, "sha256=abc", "") is False


def test_empty_signature_returns_false():
    payload = b"test"
    assert validate_webhook_signature(payload, "", "my-secret") is False


def test_none_secret_returns_false():
    payload = b"test"
    assert validate_webhook_signature(payload, "sha256=abc", None) is False  # type: ignore[arg-type]


def test_none_signature_returns_false():
    payload = b"test"
    assert validate_webhook_signature(payload, None, "secret") is False  # type: ignore[arg-type]


def test_empty_payload_valid_signature():
    payload = b""
    secret = "secret"
    sig = _compute_signature(payload, secret)
    assert validate_webhook_signature(payload, sig, secret) is True


def test_tampered_payload_returns_false():
    secret = "secret"
    original = b'{"data":"original"}'
    sig = _compute_signature(original, secret)
    tampered = b'{"data":"tampered"}'
    assert validate_webhook_signature(tampered, sig, secret) is False
