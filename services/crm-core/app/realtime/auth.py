"""Socket.io authentication middleware and room provisioning.

authenticate_connection() is called by the connect handler in socket_manager.py.
It extracts the JWT from the handshake, decodes it, loads the user from the DB,
and returns a plain dict that is stored in the socket session.

join_rooms_for_user() is called immediately after a successful auth to place the
socket into the correct rooms based on role and hotel_unit.

Room hierarchy (mirrors Express implementation in deploy-backend/src/config/socket.ts):

  tenant:{tenant_id}              — ALL authenticated users of this tenant
  tenant:{tenant_id}:admins       — TENANT_ADMIN and SUPER_ADMIN
  tenant:{tenant_id}:unit:{unit}  — ATTENDANT and HEAD for a specific hotel unit
  user:{user_id}                  — Personal / direct notifications
"""

from __future__ import annotations

import structlog
from sqlalchemy import select

from app.core.database import async_session
from app.core.security import decode_token
from app.models.user import User

logger = structlog.get_logger()

# Roles that are granted access to the :admins room
_ADMIN_ROLES = {"TENANT_ADMIN", "SUPER_ADMIN"}

# Roles that join the per-unit room when hotel_unit is set
_UNIT_ROLES = {"ATTENDANT", "HEAD"}


def _extract_token(environ: dict, auth: dict) -> str | None:
    """Pull the JWT from either the socket auth payload or the HTTP header.

    Client sends token in one of:
      - auth["token"]                          (preferred, socket handshake auth)
      - HTTP header "HTTP_AUTHORIZATION: Bearer <token>"
    """
    token: str | None = auth.get("token")
    if token:
        return token

    # WSGI environ key for the Authorization HTTP header
    raw_header: str = environ.get("HTTP_AUTHORIZATION", "")
    if raw_header.lower().startswith("bearer "):
        return raw_header.split(" ", 1)[1]

    return None


async def authenticate_connection(
    sid: str,
    environ: dict,
    auth: dict,
) -> dict:
    """Authenticate a new socket connection and return a session dict.

    Raises ValueError with a safe error message on any auth failure so
    the caller can surface it to the client without leaking internals.
    """
    token = _extract_token(environ, auth)
    if not token:
        raise ValueError("Authentication token required")

    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise ValueError("Authentication failed") from exc

    # Reject refresh tokens on socket connections
    token_type = payload.get("type")
    if token_type == "refresh":
        raise ValueError("Refresh tokens cannot be used for socket connections")

    user_id_raw: str | None = payload.get("sub") or payload.get("userId")
    if not user_id_raw:
        raise ValueError("Invalid token payload")

    # Both Express ("tenantId") and CRM Core ("tenant_id") claim names are
    # already normalised by decode_token(), so tenant_id is the canonical key.
    tenant_id_raw: str | None = payload.get("tenant_id") or payload.get("tenantId")

    async with async_session() as db:
        stmt = select(User).where(User.id == user_id_raw)
        if tenant_id_raw:
            stmt = stmt.where(User.tenant_id == tenant_id_raw)
        else:
            stmt = stmt.where(User.tenant_id.is_(None))

        result = await db.execute(stmt)
        user: User | None = result.scalar_one_or_none()

    if not user:
        raise ValueError("User not found")

    if user.status != "ACTIVE":
        raise ValueError("User account is not active")

    return {
        "user_id": str(user.id),
        "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        "name": user.name,
        "role": user.role,
        "hotel_unit": user.hotel_unit,
    }


async def join_rooms_for_user(
    sio: object,
    sid: str,
    user_data: dict,
) -> None:
    """Enter the socket into all rooms appropriate for this user's role.

    This function intentionally avoids any logging of personally-identifiable
    information beyond user_id and role.
    """
    user_id: str = user_data["user_id"]
    tenant_id: str | None = user_data.get("tenant_id")
    role: str = user_data.get("role", "")
    hotel_unit: str | None = user_data.get("hotel_unit")

    # 1. Personal room — direct notifications
    await sio.enter_room(sid, f"user:{user_id}")
    logger.debug("socket_joined_room", sid=sid, room=f"user:{user_id}")

    if not tenant_id:
        # SUPER_ADMIN without a fixed tenant gets personal room only;
        # they receive tenant-scoped data through the REST API.
        return

    # 2. Tenant-wide room
    tenant_room = f"tenant:{tenant_id}"
    await sio.enter_room(sid, tenant_room)
    logger.debug("socket_joined_room", sid=sid, room=tenant_room)

    # 3. Admins room
    if role in _ADMIN_ROLES:
        admins_room = f"tenant:{tenant_id}:admins"
        await sio.enter_room(sid, admins_room)
        logger.info(
            "socket_joined_admins_room",
            sid=sid,
            user_id=user_id,
            role=role,
            room=admins_room,
        )

    # 4. Hotel-unit room
    if role in _UNIT_ROLES and hotel_unit:
        unit_room = f"tenant:{tenant_id}:unit:{hotel_unit}"
        await sio.enter_room(sid, unit_room)
        logger.info(
            "socket_joined_unit_room",
            sid=sid,
            user_id=user_id,
            role=role,
            hotel_unit=hotel_unit,
            room=unit_room,
        )
