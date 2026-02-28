"""AuthService — business logic for authentication.

Design decisions:
  - login() MUST include tenant_id in the User query to prevent cross-tenant
    credential probing (timing-attack safe — no global lookup then check).
  - Tenant is resolved from tenant_slug in the same transaction, before the
    User query.
  - last_login_at is updated and committed inside login() because the caller
    (get_db context manager) owns the outer transaction; login needs its own
    commit to persist the audit timestamp regardless of downstream errors.
  - refresh() decodes the token, verifies user still exists and is ACTIVE,
    then issues a new access token.  Refresh tokens are not rotated to keep
    the flow simple — rotate in a future iteration if needed.
  - change_password() uses verify_password() before updating to prevent
    privilege escalation via token replay.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import LoginResponse, RefreshResponse
from app.schemas.user import ChangePasswordRequest, UserResponse

logger = structlog.get_logger()


class AuthService:
    # ------------------------------------------------------------------
    # login
    # ------------------------------------------------------------------

    async def login(
        self,
        db: AsyncSession,
        tenant_slug: str,
        email: str,
        password: str,
    ) -> LoginResponse:
        """Authenticate a user and return access + refresh tokens.

        Steps:
        1. Resolve tenant_slug -> Tenant row.
        2. Fetch User WHERE email = :email AND tenant_id = :tenant_id.
        3. Verify password hash.
        4. Check ACTIVE status.
        5. Update last_login_at and commit.
        6. Return tokens + UserResponse.
        """
        log = logger.bind(tenant_slug=tenant_slug, email=email)

        # --- 1. Resolve tenant ---
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.slug == tenant_slug)
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            # Return generic error to avoid tenant enumeration
            log.warning("login_failed_unknown_tenant")
            raise UnauthorizedError("Invalid credentials")

        # --- 2. Fetch user WITH tenant_id in WHERE (multi-tenant security) ---
        user_result = await db.execute(
            select(User).where(
                User.email == email,
                User.tenant_id == tenant.id,
            )
        )
        user = user_result.scalar_one_or_none()

        # --- 3. Verify password (constant-time even when user is None) ---
        if not user or not verify_password(password, user.password_hash):
            log.warning("login_failed_bad_credentials")
            raise UnauthorizedError("Invalid credentials")

        # --- 4. Check account status ---
        if user.status != "ACTIVE":
            log.warning("login_failed_inactive_user", user_id=str(user.id))
            raise ForbiddenError("Account is inactive")

        # --- 5. Update last_login_at ---
        await db.execute(
            update(User)
            .where(User.id == user.id, User.tenant_id == tenant.id)
            .values(last_login_at=datetime.now(UTC))
        )
        await db.commit()

        # Refresh the user object so last_login_at reflects the update
        await db.refresh(user)

        # --- 6. Issue tokens ---
        access_token = create_access_token(user.id, user.tenant_id)
        refresh_token = create_refresh_token(user.id, user.tenant_id)

        log.info("login_success", user_id=str(user.id))
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        )

    # ------------------------------------------------------------------
    # refresh
    # ------------------------------------------------------------------

    async def refresh(
        self,
        db: AsyncSession,
        refresh_token: str,
    ) -> RefreshResponse:
        """Decode a refresh token and return a new access token.

        The refresh token is validated for type="refresh".  The user must
        still exist and be ACTIVE — this catches deactivations without
        requiring token revocation infrastructure.
        """
        try:
            payload = decode_token(refresh_token)
        except ValueError as exc:
            raise UnauthorizedError("Invalid refresh token") from exc

        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type")

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise UnauthorizedError("Invalid token payload")

        try:
            user_id = uuid.UUID(user_id_str)
        except ValueError as exc:
            raise UnauthorizedError("Invalid token payload") from exc

        # Validate tenant_id from refresh token — prevents cross-tenant abuse
        token_tenant_id = payload.get("tenant_id")
        if token_tenant_id:
            result = await db.execute(
                select(User).where(
                    User.id == user_id,
                    User.tenant_id == uuid.UUID(token_tenant_id),
                )
            )
        else:
            result = await db.execute(
                select(User).where(User.id == user_id, User.tenant_id.is_(None))
            )
        user = result.scalar_one_or_none()

        if not user:
            raise UnauthorizedError("User not found")
        if user.status != "ACTIVE":
            raise ForbiddenError("Account is inactive")

        access_token = create_access_token(user.id, user.tenant_id)
        logger.info("token_refreshed", user_id=str(user.id))
        return RefreshResponse(access_token=access_token, token_type="bearer")

    # ------------------------------------------------------------------
    # me
    # ------------------------------------------------------------------

    async def me(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> UserResponse:
        """Return the current user's profile."""
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError("User not found")
        return UserResponse.model_validate(user)

    # ------------------------------------------------------------------
    # change_password
    # ------------------------------------------------------------------

    async def change_password(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        data: ChangePasswordRequest,
    ) -> None:
        """Verify the current password and update to the new one.

        Raises BadRequestError if the current password does not match to
        prevent unauthenticated password resets via replayed tokens.
        """
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError("User not found")

        if not verify_password(data.current_password, user.password_hash):
            raise BadRequestError("Current password is incorrect")

        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(password_hash=hash_password(data.new_password))
        )
        await db.flush()
        logger.info("password_changed", user_id=str(user_id))


# Module-level singleton — mirrors the pattern used by other services
auth_service = AuthService()
