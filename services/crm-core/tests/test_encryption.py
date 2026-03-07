"""Tests for app/core/encryption.py — Fernet token encryption."""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests-must-be-32-chars-long")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")


def _reset_encryption():
    """Reset the encryption module's cached Fernet instance."""
    from app.core import encryption
    encryption._fernet = None


def test_encrypt_decrypt_roundtrip():
    """Encrypt then decrypt should return the original plaintext."""
    from cryptography.fernet import Fernet
    key = Fernet.generate_key().decode()
    with patch("app.core.encryption.settings") as mock_settings:
        mock_settings.TOKEN_ENCRYPTION_KEY = key
        _reset_encryption()
        from app.core.encryption import encrypt_token, decrypt_token
        original = "EAAxxxxxxxxx_my_access_token"
        encrypted = encrypt_token(original)
        assert encrypted.startswith("enc:")
        assert encrypted != original
        decrypted = decrypt_token(encrypted)
        assert decrypted == original


def test_decrypt_plaintext_passthrough():
    """decrypt_token should pass through plaintext (no 'enc:' prefix)."""
    from app.core.encryption import decrypt_token
    plaintext = "just-a-plain-token"
    assert decrypt_token(plaintext) == plaintext


def test_encrypt_with_no_key_returns_plaintext():
    """When TOKEN_ENCRYPTION_KEY is not set, encrypt returns plaintext."""
    with patch("app.core.encryption.settings") as mock_settings:
        mock_settings.TOKEN_ENCRYPTION_KEY = None
        _reset_encryption()
        from app.core.encryption import encrypt_token
        result = encrypt_token("my-token")
        assert result == "my-token"
        assert not result.startswith("enc:")


def test_encrypted_prefix():
    """Encrypted values must start with 'enc:' prefix."""
    from cryptography.fernet import Fernet
    key = Fernet.generate_key().decode()
    with patch("app.core.encryption.settings") as mock_settings:
        mock_settings.TOKEN_ENCRYPTION_KEY = key
        _reset_encryption()
        from app.core.encryption import encrypt_token, is_encrypted
        encrypted = encrypt_token("test")
        assert is_encrypted(encrypted) is True
        assert is_encrypted("plain-text") is False


def test_encrypt_empty_string():
    """Encrypting an empty string should still work."""
    from cryptography.fernet import Fernet
    key = Fernet.generate_key().decode()
    with patch("app.core.encryption.settings") as mock_settings:
        mock_settings.TOKEN_ENCRYPTION_KEY = key
        _reset_encryption()
        from app.core.encryption import encrypt_token, decrypt_token
        encrypted = encrypt_token("")
        assert encrypted.startswith("enc:")
        assert decrypt_token(encrypted) == ""
