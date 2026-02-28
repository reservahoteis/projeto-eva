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

    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid token type")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Invalid token payload")

    # Validate tenant_id from JWT matches the DB — prevents cross-tenant token abuse
    token_tenant_id = payload.get("tenant_id")
    if token_tenant_id:
        result = await db.execute(
            select(User).where(
                User.id == UUID(user_id),
                User.tenant_id == UUID(token_tenant_id),
            )
        )
    else:
        # Only SUPER_ADMIN users may have tenant_id=None
        result = await db.execute(
            select(User).where(
                User.id == UUID(user_id),
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
            raise ForbiddenError(f"Role {current_user.role} not authorized")
        return current_user

    return role_checker


def get_tenant_id(request: Request) -> UUID:
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise UnauthorizedError("Tenant not identified")
    return tenant_id
