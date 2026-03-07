"""Fernet symmetric encryption for sensitive tokens stored in the database.

Design decisions:
  - Uses Fernet (AES-128-CBC + HMAC-SHA256) from the cryptography package.
  - Encryption is optional: if TOKEN_ENCRYPTION_KEY is not set, tokens are
    stored/read as plaintext (graceful degradation for dev environments).
  - Encrypted values are prefixed with "enc:" to distinguish them from
    plaintext, enabling gradual migration without downtime.
  - The encrypt/decrypt functions are pure (no DB access) and can be used
    anywhere tokens are read or written.
"""

from __future__ import annotations

import logging

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

_PREFIX = "enc:"

# Lazy-initialised Fernet instance (None = encryption disabled).
_fernet: Fernet | None = None
_initialised = False


def _get_fernet() -> Fernet | None:
    """Return the Fernet instance, creating it on first call."""
    global _fernet, _initialised

    if _initialised:
        return _fernet

    _initialised = True

    # Import here to avoid circular imports at module load time.
    from app.core.config import settings

    key = settings.TOKEN_ENCRYPTION_KEY
    if not key:
        logger.warning(
            "TOKEN_ENCRYPTION_KEY is not set — tokens will be stored as plaintext. "
            "This is acceptable for local development but MUST be configured in production."
        )
        return None

    try:
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as exc:
        logger.error("Invalid TOKEN_ENCRYPTION_KEY: %s", exc)
        raise ValueError(
            "TOKEN_ENCRYPTION_KEY is invalid. Generate a valid key with: "
            'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        ) from exc

    return _fernet


def is_encrypted(value: str) -> bool:
    """Check if a value is encrypted (has 'enc:' prefix)."""
    return value.startswith(_PREFIX)


def encrypt_token(plaintext: str) -> str:
    """Encrypt a token.

    Returns ``enc:<base64>`` if TOKEN_ENCRYPTION_KEY is configured,
    otherwise returns the plaintext unchanged (dev/no-key mode).
    """
    if not plaintext:
        return plaintext

    # Already encrypted — do not double-encrypt.
    if is_encrypted(plaintext):
        return plaintext

    fernet = _get_fernet()
    if fernet is None:
        return plaintext

    encrypted = fernet.encrypt(plaintext.encode("utf-8"))
    return f"{_PREFIX}{encrypted.decode('utf-8')}"


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a token.

    Handles both ``enc:``-prefixed (encrypted) and plain values seamlessly,
    so old plaintext tokens keep working during gradual migration.
    """
    if not ciphertext:
        return ciphertext

    if not is_encrypted(ciphertext):
        # Plaintext value — return as-is (pre-migration compatibility).
        return ciphertext

    fernet = _get_fernet()
    if fernet is None:
        logger.error(
            "Found encrypted token but TOKEN_ENCRYPTION_KEY is not set — "
            "cannot decrypt. Set the key or re-encrypt tokens."
        )
        raise ValueError(
            "Cannot decrypt token: TOKEN_ENCRYPTION_KEY is not configured."
        )

    raw = ciphertext[len(_PREFIX) :]
    try:
        return fernet.decrypt(raw.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        logger.error("Failed to decrypt token — key mismatch or corrupted data.")
        raise ValueError("Token decryption failed — wrong key or corrupted ciphertext.") from exc
