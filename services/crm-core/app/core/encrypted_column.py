"""SQLAlchemy TypeDecorator for transparent column encryption.

Usage in models::

    from app.core.encrypted_column import EncryptedText

    class Tenant(Base):
        whatsapp_access_token: Mapped[str | None] = mapped_column(
            EncryptedText, nullable=True
        )

Values are encrypted on INSERT/UPDATE and decrypted on SELECT automatically.
See ``app.core.encryption`` for encryption details and graceful-degradation
behaviour when TOKEN_ENCRYPTION_KEY is not set.
"""

from __future__ import annotations

from sqlalchemy import Text
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator

from app.core.encryption import decrypt_token, encrypt_token


class EncryptedText(TypeDecorator):  # type: ignore[type-arg]
    """Transparent Fernet encryption for Text columns."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect: Dialect) -> str | None:
        """Encrypt before writing to the database."""
        if value is None:
            return None
        return encrypt_token(value)

    def process_result_value(self, value: str | None, dialect: Dialect) -> str | None:
        """Decrypt after reading from the database."""
        if value is None:
            return None
        return decrypt_token(value)
