"""N8N authentication dependency.

N8N authenticates via the X-API-Key header using the format:

    {tenantSlug}:{whatsappPhoneNumberId}

Example:
    X-API-Key: hoteis-reserva:123456789012345

This is intentionally separate from the standard JWT Bearer auth so that
N8N workflows can authenticate without issuing a user-scoped JWT.

The resolved Tenant ORM instance is injected into each route handler.
request.state.tenant_id is also set so downstream utilities that read
from request.state (e.g. logging middleware) work correctly.
"""

from __future__ import annotations

import structlog
from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.models.tenant import Tenant

logger = structlog.get_logger()


async def get_n8n_tenant(
    request: Request,
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> Tenant:
    """Authenticate N8N requests via X-API-Key header.

    Format: {tenantSlug}:{whatsappPhoneNumberId}

    Raises:
        UnauthorizedError: if the header is missing, malformed, or the
                           tenant slug does not exist.
        ForbiddenError:    if the tenant is inactive or the phone number ID
                           does not match.
    """
    if not x_api_key or ":" not in x_api_key:
        raise UnauthorizedError(
            "Missing or invalid X-API-Key. "
            "Expected format: {tenantSlug}:{whatsappPhoneNumberId}"
        )

    # Only split on the first colon — phone number IDs never contain colons
    slug, phone_id = x_api_key.split(":", 1)

    if not slug or not phone_id:
        raise UnauthorizedError(
            "Malformed X-API-Key. "
            "Expected format: {tenantSlug}:{whatsappPhoneNumberId}"
        )

    result = await db.execute(
        select(Tenant).where(Tenant.slug == slug)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        logger.warning(
            "N8N auth: tenant not found",
            slug=slug,
        )
        raise UnauthorizedError(f"Tenant with slug '{slug}' not found")

    if tenant.status != "ACTIVE":
        raise ForbiddenError("Tenant is not active")

    # Validate the secret portion against known channel identifiers.
    # Support WhatsApp phone_number_id, Messenger page_id, or Instagram account_id
    # so non-WhatsApp tenants can also authenticate with N8N.
    valid_ids = [
        getattr(tenant, "whatsapp_phone_number_id", None),
        getattr(tenant, "messenger_page_id", None),
        getattr(tenant, "instagram_page_id", None),
    ]
    valid_ids = [v for v in valid_ids if v]

    if not valid_ids:
        raise ForbiddenError(
            "Tenant does not have any channel configured (no phone_number_id, "
            "page_id, or instagram_account_id)"
        )

    if phone_id not in valid_ids:
        logger.warning(
            "N8N auth: invalid channel identifier",
            slug=slug,
        )
        raise UnauthorizedError("Invalid API key — channel identifier does not match")

    # Populate request.state so logging middleware and other utilities can
    # read the tenant without an extra argument.
    request.state.tenant_id = tenant.id

    logger.info(
        "N8N request authenticated",
        tenant_id=str(tenant.id),
        tenant_slug=tenant.slug,
    )

    return tenant
