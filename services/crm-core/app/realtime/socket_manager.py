"""Socket.io server setup.

Creates the AsyncServer, wraps it in an ASGI application, and wires up
the authentication middleware and all client-originating event handlers.
The ASGI app is mounted on the FastAPI application in main.py.

Design decisions:
  - async_mode="asgi" integrates cleanly with uvicorn without a second thread.
  - engineio_logger / logger are kept off to avoid log pollution; structured
    events are emitted via structlog at the relevant handler sites.
  - CORS origins are sourced from settings.CORS_ORIGINS so there is a single
    source of truth for allowed origins across HTTP and WebSocket.
"""

import socketio
import structlog

from app.core.config import settings
from app.realtime.auth import authenticate_connection, join_rooms_for_user
from app.realtime.events import register_event_handlers

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Server instance — shared across the entire process
# ---------------------------------------------------------------------------

sio: socketio.AsyncServer = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.CORS_ORIGINS,
    logger=False,
    engineio_logger=False,
    # Keep-alive mirrors Express configuration (pingTimeout=60s, pingInterval=25s)
    ping_timeout=60,
    ping_interval=25,
)

# ---------------------------------------------------------------------------
# ASGI application — mounted at /ws in main.py
# ---------------------------------------------------------------------------

socket_app = socketio.ASGIApp(sio, socketio_path="socket.io")

# ---------------------------------------------------------------------------
# Connection lifecycle
# ---------------------------------------------------------------------------


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None) -> bool:
    """Authenticate and provision rooms for every new connection.

    Returns False to reject the connection; raises ConnectionRefusedError
    with a human-readable message on auth failure so the JS client receives
    a meaningful error in socket.on("connect_error").
    """
    try:
        user_data = await authenticate_connection(sid, environ, auth or {})
    except ValueError as exc:
        logger.warning(
            "socket_connect_rejected",
            sid=sid,
            reason=str(exc),
        )
        # python-socketio surfaces this string to the client as connect_error.data
        raise ConnectionRefusedError(str(exc))

    # Persist user context in the server-side session for this socket.
    async with sio.session(sid) as session:
        session.update(user_data)

    await join_rooms_for_user(sio, sid, user_data)

    logger.info(
        "socket_connected",
        sid=sid,
        user_id=user_data["user_id"],
        tenant_id=user_data.get("tenant_id"),
        role=user_data.get("role"),
        hotel_unit=user_data.get("hotel_unit"),
    )

    return True  # explicit True = accept


@sio.event
async def disconnect(sid: str) -> None:
    """Log disconnect; python-socketio cleans up rooms automatically."""
    async with sio.session(sid) as session:
        user_id = session.get("user_id", "<unknown>")
        tenant_id = session.get("tenant_id")
        role = session.get("role")

    logger.info(
        "socket_disconnected",
        sid=sid,
        user_id=user_id,
        tenant_id=tenant_id,
        role=role,
    )


# ---------------------------------------------------------------------------
# Register all client → server event handlers
# ---------------------------------------------------------------------------

register_event_handlers(sio)
