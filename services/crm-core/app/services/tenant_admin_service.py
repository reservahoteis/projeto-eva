"""TenantAdminService — SUPER_ADMIN-only tenant lifecycle management.

Design decisions:
  - Methods have no tenant_id scope — SUPER_ADMIN operates across all tenants.
    The caller (router + auth dependency) is responsible for enforcing the
    SUPER_ADMIN role before invoking any method here.
  - Slug uniqueness and email uniqueness are checked with explicit pre-insert
    queries that raise ConflictError before touching DB constraints.  This gives
    callers a clear, machine-readable error rather than a raw IntegrityError.
  - A temporary TENANT_ADMIN user is created alongside the tenant so the new
    customer has immediate login access.  The temporary password is returned
    once (in plain text) and must be communicated to the customer securely.
  - WhatsApp config fields (access_token, app_secret) are stored on the Tenant
    row; get_whatsapp_config() strips sensitive fields before returning.
  - Use db.flush() not db.commit() — caller owns transaction.
"""

from __future__ import annotations

import secrets
import string
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.lead import PaginatedResponse
from app.schemas.tenant_admin import TenantCreate, TenantResponse, TenantUpdate

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_TRIAL_DAYS: int = 14
_TEMP_PASSWORD_LENGTH: int = 16
_TEMP_PASSWORD_ALPHABET: str = (
    string.ascii_letters + string.digits + "!@#$%^&*"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _generate_temp_password() -> str:
    """Generate a cryptographically-secure temporary password."""
    return "".join(
        secrets.choice(_TEMP_PASSWORD_ALPHABET)
        for _ in range(_TEMP_PASSWORD_LENGTH)
    )


def _tenant_to_dict(tenant: Tenant) -> dict[str, Any]:
    """Serialise a Tenant ORM object to a plain dict for response building.

    Sensitive token fields are replaced with boolean presence flags (LOW-004)
    to prevent accidental exposure in API responses or error messages.
    """
    return {
        "id": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
        "plan": tenant.plan,
        "status": tenant.status,
        "logo_url": tenant.logo_url,
        "whatsapp_phone_number_id": tenant.whatsapp_phone_number_id,
        "whatsapp_access_token_configured": bool(tenant.whatsapp_access_token),
        "instagram_page_id": tenant.instagram_page_id,
        "instagram_access_token_configured": bool(tenant.instagram_access_token),
        "messenger_page_id": tenant.messenger_page_id,
        "messenger_access_token_configured": bool(tenant.messenger_access_token),
        "stripe_customer_id": tenant.stripe_customer_id,
        "stripe_subscription_id": tenant.stripe_subscription_id,
        "currency": tenant.currency,
        "timezone": tenant.timezone,
        "created_at": tenant.created_at,
        "updated_at": tenant.updated_at,
    }


# ---------------------------------------------------------------------------
# TenantAdminService
# ---------------------------------------------------------------------------


class TenantAdminService:
    """Tenant lifecycle management — SUPER_ADMIN only."""

    # ------------------------------------------------------------------
    # create_tenant
    # ------------------------------------------------------------------

    async def create_tenant(
        self,
        db: AsyncSession,
        data: TenantCreate,
    ) -> dict[str, Any]:
        """Provision a new tenant and its first TENANT_ADMIN user.

        Returns a dict with:
          tenant        — TenantResponse-compatible mapping
          admin_user    — {id, email, name, role}
          temp_password — plain-text one-time password (return once only)
        """
        # ------------------------------------------------------------------
        # 1. Validate slug uniqueness
        # ------------------------------------------------------------------
        slug_exists = await db.execute(
            select(func.count())
            .select_from(Tenant)
            .where(Tenant.slug == data.slug)
        )
        if slug_exists.scalar_one() > 0:
            raise ConflictError(f"Slug {data.slug!r} is already taken")

        # ------------------------------------------------------------------
        # 2. Validate email uniqueness across tenants
        # ------------------------------------------------------------------
        # The Tenant model stores email implicitly via the admin user; we check
        # the user table across all tenants for the same email.
        email_exists = await db.execute(
            select(func.count())
            .select_from(User)
            .where(User.email == str(data.email))
        )
        if email_exists.scalar_one() > 0:
            raise ConflictError(
                f"A user with email {data.email!r} already exists"
            )

        # ------------------------------------------------------------------
        # 3. Create Tenant row
        # ------------------------------------------------------------------
        tenant = Tenant(
            name=data.name,
            slug=data.slug,
            plan=data.plan,
            status="TRIAL",
            # WhatsApp optional
            whatsapp_phone_number_id=data.whatsapp_phone_number_id,
            whatsapp_access_token=data.whatsapp_access_token,
        )
        db.add(tenant)
        await db.flush()  # populate tenant.id

        # ------------------------------------------------------------------
        # 4. Create TENANT_ADMIN user with a temporary password
        # ------------------------------------------------------------------
        temp_password = _generate_temp_password()
        admin_user = User(
            tenant_id=tenant.id,
            email=str(data.email),
            name=data.name,
            role="TENANT_ADMIN",
            status="ACTIVE",
            password_hash=hash_password(temp_password),
        )
        db.add(admin_user)
        await db.flush()

        logger.info(
            "tenant_created",
            tenant_id=str(tenant.id),
            slug=tenant.slug,
            admin_user_id=str(admin_user.id),
        )

        # ------------------------------------------------------------------
        # 5. Enviar email de boas-vindas com credenciais (não-bloqueante)
        # ------------------------------------------------------------------
        # Importação tardia para evitar circular import no nível de módulo.
        # Se o envio falhar, logamos o erro mas NÃO revertemos a criação do
        # tenant — o banco já foi flushado e a resposta contém a senha.
        email_sent = False
        try:
            from app.services.email_service import email_service  # noqa: PLC0415

            email_sent = await email_service.send_welcome_email(
                to_email=admin_user.email,
                tenant_name=tenant.name,
                admin_name=admin_user.name or tenant.name,
                login_url=f"{settings.FRONTEND_URL}/login",
                temp_password=temp_password,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "tenant_welcome_email_error",
                tenant_id=str(tenant.id),
                admin_email=admin_user.email,
                error=str(exc),
            )

        return {
            "tenant": _tenant_to_dict(tenant),
            "admin_user": {
                "id": admin_user.id,
                "email": admin_user.email,
                "name": admin_user.name,
                "role": admin_user.role,
            },
            "temp_password": temp_password,
            "email_sent": email_sent,
        }

    # ------------------------------------------------------------------
    # list_tenants
    # ------------------------------------------------------------------

    async def list_tenants(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
        search: str | None = None,
    ) -> PaginatedResponse[dict[str, Any]]:
        """Return a paginated list of all tenants.

        Optionally filter by status (exact match) and search across
        name / slug via ILIKE (SQL injection prevented by parameterisation).
        """
        # ------------------------------------------------------------------
        # Base query — no tenant_id scope (SUPER_ADMIN sees all)
        # ------------------------------------------------------------------
        base_q = select(Tenant)

        if status:
            base_q = base_q.where(Tenant.status == status.upper())

        if search:
            escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{escaped}%"
            base_q = base_q.where(
                or_(
                    Tenant.name.ilike(pattern),
                    Tenant.slug.ilike(pattern),
                )
            )

        # ------------------------------------------------------------------
        # Count
        # ------------------------------------------------------------------
        count_q = select(func.count()).select_from(base_q.subquery())
        total_result = await db.execute(count_q)
        total_count: int = total_result.scalar_one()

        # ------------------------------------------------------------------
        # Paginated data
        # ------------------------------------------------------------------
        offset = (page - 1) * page_size
        rows_result = await db.execute(
            base_q.order_by(Tenant.created_at.desc()).offset(offset).limit(page_size)
        )
        tenants = rows_result.scalars().all()

        # Include user count per tenant (separate query per tenant — acceptable
        # for SUPER_ADMIN list which is low-frequency and small result sets)
        items: list[dict[str, Any]] = []
        for tenant in tenants:
            user_count_result = await db.execute(
                select(func.count())
                .select_from(User)
                .where(User.tenant_id == tenant.id)
            )
            user_count: int = user_count_result.scalar_one()
            d = _tenant_to_dict(tenant)
            d["user_count"] = user_count
            items.append(d)

        return PaginatedResponse[dict[str, Any]](
            data=items,
            total_count=total_count,
            page=page,
            page_size=page_size,
        )

    # ------------------------------------------------------------------
    # get_tenant
    # ------------------------------------------------------------------

    async def get_tenant(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Fetch a single tenant by PK with user and conversation counts."""
        result = await db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise NotFoundError(f"Tenant {tenant_id} not found")

        # User count
        user_count_result = await db.execute(
            select(func.count())
            .select_from(User)
            .where(User.tenant_id == tenant_id)
        )
        user_count: int = user_count_result.scalar_one()

        # Conversation count — import here to avoid circular imports at module level
        from app.models.conversation import Conversation  # noqa: PLC0415

        conv_count_result = await db.execute(
            select(func.count())
            .select_from(Conversation)
            .where(Conversation.tenant_id == tenant_id)
        )
        conv_count: int = conv_count_result.scalar_one()

        d = _tenant_to_dict(tenant)
        d["user_count"] = user_count
        d["conversation_count"] = conv_count
        return d

    # ------------------------------------------------------------------
    # update_tenant
    # ------------------------------------------------------------------

    async def update_tenant(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: TenantUpdate,
    ) -> dict[str, Any]:
        """Partial update of a tenant.

        Validates email uniqueness if the email field changes.
        Validates status and plan values via the schema validator.
        """
        result = await db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise NotFoundError(f"Tenant {tenant_id} not found")

        update_data = data.model_dump(exclude_none=True)

        # ------------------------------------------------------------------
        # Email uniqueness check if email is being changed
        # ------------------------------------------------------------------
        if "email" in update_data:
            new_email = str(update_data["email"])
            email_conflict = await db.execute(
                select(func.count())
                .select_from(User)
                .where(
                    User.email == new_email,
                    User.tenant_id != tenant_id,
                )
            )
            if email_conflict.scalar_one() > 0:
                raise ConflictError(
                    f"Email {new_email!r} is already in use by another tenant"
                )
            # Email is stored on the admin User, not the Tenant row — update
            # the TENANT_ADMIN user's email instead
            admin_result = await db.execute(
                select(User).where(
                    User.tenant_id == tenant_id,
                    User.role == "TENANT_ADMIN",
                )
            )
            admin_user = admin_result.scalar_one_or_none()
            if admin_user:
                admin_user.email = new_email
            # Remove from tenant update dict (not a Tenant column)
            del update_data["email"]

        # Apply remaining fields to Tenant row
        for field, value in update_data.items():
            setattr(tenant, field, value)

        await db.flush()

        logger.info(
            "tenant_updated",
            tenant_id=str(tenant_id),
            fields=list(update_data.keys()),
        )
        return _tenant_to_dict(tenant)

    # ------------------------------------------------------------------
    # configure_whatsapp
    # ------------------------------------------------------------------

    async def configure_whatsapp(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        phone_number_id: str,
        access_token: str,
        business_account_id: str | None = None,
        webhook_verify_token: str | None = None,
        app_secret: str | None = None,
    ) -> dict[str, Any]:
        """Store WhatsApp Cloud API credentials on the tenant row.

        Returns non-sensitive config only (no access_token / app_secret).
        """
        result = await db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise NotFoundError(f"Tenant {tenant_id} not found")

        tenant.whatsapp_phone_number_id = phone_number_id
        tenant.whatsapp_access_token = access_token
        if webhook_verify_token is not None:
            tenant.whatsapp_verify_token = webhook_verify_token
        if app_secret is not None:
            tenant.whatsapp_webhook_secret = app_secret

        await db.flush()

        logger.info(
            "tenant_whatsapp_configured",
            tenant_id=str(tenant_id),
            phone_number_id=phone_number_id,
        )

        return self._safe_whatsapp_config(tenant)

    # ------------------------------------------------------------------
    # get_whatsapp_config
    # ------------------------------------------------------------------

    async def get_whatsapp_config(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return WhatsApp config without sensitive token fields."""
        result = await db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise NotFoundError(f"Tenant {tenant_id} not found")

        return self._safe_whatsapp_config(tenant)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _safe_whatsapp_config(tenant: Tenant) -> dict[str, Any]:
        """Return WhatsApp config dict with sensitive fields redacted."""
        return {
            "tenant_id": tenant.id,
            "whatsapp_phone_number_id": tenant.whatsapp_phone_number_id,
            # Redact — return boolean indicating whether token is configured
            "whatsapp_access_token_configured": bool(
                tenant.whatsapp_access_token
            ),
            "whatsapp_verify_token": tenant.whatsapp_verify_token,
            # Redact app_secret entirely
            "whatsapp_webhook_secret_configured": bool(
                tenant.whatsapp_webhook_secret
            ),
        }


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

tenant_admin_service = TenantAdminService()
