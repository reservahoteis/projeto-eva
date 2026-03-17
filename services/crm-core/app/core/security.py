"""Security utilities — JWT tokens and password hashing.

Security decisions:
  - PyJWT replaces abandoned python-jose (CVE-2024-33664 DoS via JWT bomb).
  - bcrypt used directly — passlib is abandoned and breaks with bcrypt 5.0+.
  - Algorithms restricted to HS256/384/512 via config validator.
  - Constant-time password verification via bcrypt.checkpw().
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import bcrypt
import jwt
import structlog

from app.core.config import settings

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Password hashing — bcrypt directly (no passlib dependency)
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt (cost factor 12)."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time password verification via bcrypt.checkpw."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# JWT tokens — PyJWT (actively maintained, no known CVEs)
# ---------------------------------------------------------------------------


def create_access_token(user_id: UUID, tenant_id: UUID | None = None) -> str:
    """Create a short-lived access token."""
    expire = datetime.now(UTC) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.now(UTC),
        "type": "access",
    }
    if tenant_id:
        payload["tenant_id"] = str(tenant_id)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: UUID, tenant_id: UUID | None = None) -> str:
    """Create a long-lived refresh token."""
    expire = datetime.now(UTC) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    payload: dict = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.now(UTC),
        "type": "refresh",
    }
    if tenant_id:
        payload["tenant_id"] = str(tenant_id)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token.

    Normalizes Express backend tokens (camelCase claims) to snake_case
    for backwards compatibility during migration.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )

        # Normalize Express tokens: Express uses "userId" instead of "sub"
        if "userId" in payload and "sub" not in payload:
            payload["sub"] = payload["userId"]

        # Normalize Express tokens: Express uses "tenantId" (camelCase)
        if "tenantId" in payload and "tenant_id" not in payload:
            payload["tenant_id"] = payload["tenantId"]

        return payload
    except jwt.ExpiredSignatureError as e:
        logger.debug("jwt_expired")
        raise ValueError("Token has expired") from e
    except jwt.InvalidTokenError as e:
        logger.debug("jwt_decode_failed", error=str(e))
        raise ValueError("Invalid or expired token") from e
