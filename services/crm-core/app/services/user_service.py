"""UserService — business logic for the User resource.

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query that touches User rows MUST include tenant_id in the WHERE
    clause to enforce strict multi-tenant data isolation.
  - Email uniqueness is enforced per-tenant via a DB index
    (ix_users_tenant_id_email) and an explicit pre-insert check that raises
    ConflictError with a clear message before hitting the DB constraint.
  - update_user does NOT allow changing one's own role — the caller must pass
    current_user_id so the service can guard this at the service layer, keeping
    the router thin.
  - deactivate_user sets status=INACTIVE rather than deleting to preserve audit
    trail and foreign key references.
  - db.flush() is used (not commit) — the FastAPI get_db context manager owns
    the transaction lifecycle.
"""

from __future__ import annotations

import math
import uuid
from typing import Any

import structlog
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserListItem, UserResponse, UserUpdate

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_user_base_query(tenant_id: uuid.UUID):
    """Base SELECT scoped to tenant — used by list + get."""
    return select(User).where(User.tenant_id == tenant_id)


# ---------------------------------------------------------------------------
# UserService
# ---------------------------------------------------------------------------


class UserService:
    # ------------------------------------------------------------------
    # list_users
    # ------------------------------------------------------------------

    async def list_users(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
    ) -> dict[str, Any]:
        """Return a paginated list of users for the tenant.

        The ``search`` parameter performs a case-insensitive ILIKE across
        name and email columns.  Results are ordered by name ascending.
        """
        base = _build_user_base_query(tenant_id)

        if search:
            pattern = f"%{search}%"
            base = base.where(
                or_(
                    User.name.ilike(pattern),
                    User.email.ilike(pattern),
                )
            )

        # Count total matching rows for pagination metadata
        count_stmt = select(func.count()).select_from(base.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        # Fetch page
        offset = (page - 1) * page_size
        rows_result = await db.execute(
            base.order_by(User.name.asc()).offset(offset).limit(page_size)
        )
        users = rows_result.scalars().all()

        return {
            "items": [UserListItem.model_validate(u) for u in users],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, math.ceil(total / page_size)),
        }

    # ------------------------------------------------------------------
    # get_user
    # ------------------------------------------------------------------

    async def get_user(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> UserResponse:
        """Return a single user scoped to tenant.  Raises NotFoundError if absent."""
        result = await db.execute(
            select(User).where(User.id == user_id, User.tenant_id == tenant_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError(f"User {user_id} not found")
        return UserResponse.model_validate(user)

    # ------------------------------------------------------------------
    # create_user
    # ------------------------------------------------------------------

    async def create_user(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: UserCreate,
    ) -> UserResponse:
        """Create a new user for the tenant.

        Enforces email uniqueness per tenant before inserting.
        Password is hashed with bcrypt.
        """
        # Check email uniqueness within tenant
        existing = await db.execute(
            select(User).where(
                User.email == data.email,
                User.tenant_id == tenant_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise ConflictError(f"Email {data.email!r} is already in use for this tenant")

        user = User(
            tenant_id=tenant_id,
            name=data.name,
            email=data.email,
            password_hash=hash_password(data.password),
            role=data.role,
            phone=data.phone,
            avatar_url=data.avatar_url,
            status="ACTIVE",
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

        logger.info("user_created", user_id=str(user.id), tenant_id=str(tenant_id))
        return UserResponse.model_validate(user)

    # ------------------------------------------------------------------
    # update_user
    # ------------------------------------------------------------------

    async def update_user(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        data: UserUpdate,
        current_user_id: uuid.UUID,
    ) -> UserResponse:
        """Apply a partial update to a user.

        Guards:
        - Caller cannot change their own role to prevent self-escalation.
        - Email change is validated for uniqueness within the tenant.
        """
        result = await db.execute(
            select(User).where(User.id == user_id, User.tenant_id == tenant_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError(f"User {user_id} not found")

        # Guard: prevent self-role change
        if data.role is not None and user_id == current_user_id:
            raise ForbiddenError("Cannot change your own role")

        # Guard: email uniqueness if email is being changed
        if data.email is not None and data.email != user.email:
            conflict = await db.execute(
                select(User).where(
                    User.email == data.email,
                    User.tenant_id == tenant_id,
                    User.id != user_id,
                )
            )
            if conflict.scalar_one_or_none() is not None:
                raise ConflictError(f"Email {data.email!r} is already in use for this tenant")

        # Build values dict from non-None fields only
        values: dict[str, Any] = {}
        if data.name is not None:
            values["name"] = data.name
        if data.email is not None:
            values["email"] = data.email
        if data.role is not None:
            values["role"] = data.role
        if data.phone is not None:
            values["phone"] = data.phone
        if data.avatar_url is not None:
            values["avatar_url"] = data.avatar_url
        if data.status is not None:
            values["status"] = data.status

        if values:
            await db.execute(
                update(User)
                .where(User.id == user_id, User.tenant_id == tenant_id)
                .values(**values)
            )
            await db.flush()
            await db.refresh(user)

        logger.info("user_updated", user_id=str(user_id), tenant_id=str(tenant_id))
        return UserResponse.model_validate(user)

    # ------------------------------------------------------------------
    # deactivate_user
    # ------------------------------------------------------------------

    async def deactivate_user(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        current_user_id: uuid.UUID,
    ) -> None:
        """Set status=INACTIVE on the target user.

        Prevents self-deactivation to avoid accidental lockout.
        """
        if user_id == current_user_id:
            raise ForbiddenError("Cannot deactivate your own account")

        result = await db.execute(
            select(User).where(User.id == user_id, User.tenant_id == tenant_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError(f"User {user_id} not found")

        if user.status == "INACTIVE":
            # Already inactive — idempotent, no-op
            return

        await db.execute(
            update(User)
            .where(User.id == user_id, User.tenant_id == tenant_id)
            .values(status="INACTIVE")
        )
        await db.flush()
        logger.info("user_deactivated", user_id=str(user_id), tenant_id=str(tenant_id))


# Module-level singleton
user_service = UserService()
