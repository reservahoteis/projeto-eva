from uuid import UUID

import structlog
from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_token
from app.models.user import User

logger = structlog.get_logger()


async def get_current_user(
    request: Request,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError("Token not provided")

    token = authorization.split(" ")[1]

    try:
        payload = decode_token(token)
    except ValueError:
        raise UnauthorizedError("Invalid token")

    # Explicitly reject refresh tokens — they must only be used at /auth/refresh.
    # Accept tokens without "type" claim (Express backend doesn't set it).
    token_type = payload.get("type")
    if token_type == "refresh":
        raise UnauthorizedError("Refresh tokens cannot be used for API access")
    if token_type and token_type != "access":
        raise UnauthorizedError("Invalid token type")

    # Express uses "userId", CRM Core uses "sub" — accept both
    user_id = payload.get("sub") or payload.get("userId")
    if not user_id:
        raise UnauthorizedError("Invalid token payload")

    # Parse UUIDs safely — malformed values should not crash the server
    try:
        parsed_user_id = UUID(user_id)
    except (ValueError, AttributeError):
        raise UnauthorizedError("Invalid token payload")

    # Express uses "tenantId" (camelCase), CRM Core uses "tenant_id" — accept both
    token_tenant_id = payload.get("tenant_id") or payload.get("tenantId")
    if token_tenant_id:
        try:
            parsed_tenant_id = UUID(token_tenant_id)
        except (ValueError, AttributeError):
            raise UnauthorizedError("Invalid token payload")
        result = await db.execute(
            select(User).where(
                User.id == parsed_user_id,
                User.tenant_id == parsed_tenant_id,
            )
        )
    else:
        # Only SUPER_ADMIN users may have tenant_id=None
        result = await db.execute(
            select(User).where(
                User.id == parsed_user_id,
                User.tenant_id.is_(None),
            )
        )
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedError("User not found")

    if user.status != "ACTIVE":
        raise ForbiddenError("User account is not active")

    request.state.user = user
    request.state.tenant_id = user.tenant_id
    return user


def require_roles(*allowed_roles: str):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise ForbiddenError("Insufficient permissions")
        return current_user

    return role_checker


def get_tenant_id(
    request: Request,
    _current_user: User = Depends(get_current_user),
) -> UUID:
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise UnauthorizedError("Tenant not identified")
    return tenant_id
