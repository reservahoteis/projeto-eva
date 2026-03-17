from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.rate_limit import limiter

# Socket.io server must be imported before the FastAPI app is built so that
# the sio instance is created and event handlers are registered at startup.
from app.realtime.socket_manager import socket_app  # noqa: E402

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CRM Core starting", version=settings.APP_VERSION)
    yield
    # --- Graceful shutdown (HIGH-001) ---
    logger.info("CRM Core shutting down — cleaning up resources")
    try:
        from app.services.hbook_scraper import hbook_scraper_service
        await hbook_scraper_service.close_browser()
    except Exception:
        pass
    try:
        from app.core.database import engine
        await engine.dispose()
        logger.info("Database engine disposed")
    except Exception:
        pass
    logger.info("CRM Core shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    redirect_slashes=False,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-API-Key", "X-Request-ID", "X-Tenant-Slug"],
)

# ---------------------------------------------------------------------------
# Request ID middleware (MED-006) — must be added before rate limiting so
# that the request_id is available in structlog context for all downstream
# middleware and route handlers.
# ---------------------------------------------------------------------------
from app.core.request_id import RequestIDMiddleware  # noqa: E402
app.add_middleware(RequestIDMiddleware)

# ---------------------------------------------------------------------------
# Rate limiting middleware (after CORS so preflight requests are not limited)
# ---------------------------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Trailing-slash normalization middleware
# Nginx may forward requests with trailing slash (e.g. /api/v1/auth/login/).
# Routes are registered without trailing slash. This middleware strips it
# so both /path and /path/ resolve to the same handler.
# ---------------------------------------------------------------------------

@app.middleware("http")
async def strip_trailing_slash_middleware(request: Request, call_next):
    path = request.scope["path"]
    if path != "/" and path.endswith("/"):
        request.scope["path"] = path.rstrip("/")
    response = await call_next(request)
    return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ---------------------------------------------------------------------------
# Mount Socket.io ASGI application
# ---------------------------------------------------------------------------
# Must be mounted BEFORE any FastAPI route is registered so that uvicorn
# routes /ws/* to the Socket.io engine before FastAPI's routing runs.
# The client connects to wss://host/ws/socket.io/...
app.mount("/ws", socket_app)


# ---------------------------------------------------------------------------
# Prometheus metrics (MED-008) — /metrics endpoint for scraping
# ---------------------------------------------------------------------------
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        excluded_handlers=["/health", "/health/ready", "/metrics"],
    ).instrument(app).expose(app, include_in_schema=False)
except ImportError:
    pass  # prometheus-fastapi-instrumentator not installed (dev/test)


@app.get("/health")
async def health():
    """Liveness probe — always returns 200 if the process is running."""
    return {"status": "ok", "service": "crm-core"}


@app.get("/health/ready")
async def health_ready():
    """Readiness probe — verifies database connectivity."""
    from sqlalchemy import text
    from app.core.database import async_session
    try:
        async with async_session() as db:
            await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": str(exc)},
        )


# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------

from app.api.v1 import (  # noqa: E402
    leads,
    deals,
    contacts,
    organizations,
    tasks,
    notes,
    tags,
    call_logs,
    activities,
    comments,
    notifications,
    views,
    settings as settings_router,
    auth,
    users,
    sla,
    assignment_rules,
    data_import,
    quick_replies,
    dashboard,
    conversations,
    messages,
    escalations,
    reports,
    tenant_admin,
    audit_logs,
    usage_tracking,
    webhook_events,
    lgpd,
    media,
)
from app.webhooks import whatsapp as wa_webhook  # noqa: E402
from app.webhooks import messenger as msg_webhook  # noqa: E402
from app.webhooks import instagram as ig_webhook  # noqa: E402
from app.n8n import routes as n8n_routes  # noqa: E402

# ---------------------------------------------------------------------------
# Webhook routes (no JWT auth — tenant resolved from payload)
# ---------------------------------------------------------------------------

app.include_router(wa_webhook.router, prefix="/webhooks/whatsapp", tags=["Webhooks"])
app.include_router(msg_webhook.router, prefix="/webhooks/messenger", tags=["Webhooks"])
app.include_router(ig_webhook.router, prefix="/webhooks/instagram", tags=["Webhooks"])

app.include_router(leads.router, prefix=f"{settings.API_PREFIX}/leads", tags=["Leads"])
app.include_router(deals.router, prefix=f"{settings.API_PREFIX}/deals", tags=["Deals"])
app.include_router(contacts.router, prefix=f"{settings.API_PREFIX}/contacts", tags=["Contacts"])
app.include_router(
    organizations.router, prefix=f"{settings.API_PREFIX}/organizations", tags=["Organizations"]
)
app.include_router(tasks.router, prefix=f"{settings.API_PREFIX}/tasks", tags=["Tasks"])
app.include_router(notes.router, prefix=f"{settings.API_PREFIX}/notes", tags=["Notes"])
app.include_router(tags.router, prefix=f"{settings.API_PREFIX}/tags", tags=["Tags"])
app.include_router(
    call_logs.router, prefix=f"{settings.API_PREFIX}/call-logs", tags=["Call Logs"]
)
app.include_router(
    activities.router, prefix=f"{settings.API_PREFIX}/activities", tags=["Activities"]
)
app.include_router(
    comments.router, prefix=f"{settings.API_PREFIX}/comments", tags=["Comments"]
)
app.include_router(
    notifications.router, prefix=f"{settings.API_PREFIX}/notifications", tags=["Notifications"]
)
app.include_router(
    views.router, prefix=f"{settings.API_PREFIX}/views", tags=["Views"]
)
app.include_router(
    settings_router.router, prefix=f"{settings.API_PREFIX}/settings", tags=["Settings"]
)
app.include_router(
    auth.router, prefix=f"{settings.API_PREFIX}/auth", tags=["Auth"]
)
app.include_router(
    users.router, prefix=f"{settings.API_PREFIX}/users", tags=["Users"]
)
app.include_router(
    sla.router, prefix=f"{settings.API_PREFIX}/sla", tags=["SLA"]
)
app.include_router(
    assignment_rules.router, prefix=f"{settings.API_PREFIX}/assignment-rules", tags=["Assignment Rules"]
)
app.include_router(
    data_import.router, prefix=f"{settings.API_PREFIX}/import", tags=["Data Import"]
)
app.include_router(
    quick_replies.router, prefix=f"{settings.API_PREFIX}/quick-replies", tags=["Quick Replies"]
)
app.include_router(
    dashboard.router, prefix=f"{settings.API_PREFIX}/dashboard", tags=["Dashboard"]
)
app.include_router(
    conversations.router, prefix=f"{settings.API_PREFIX}/conversations", tags=["Conversations"]
)
app.include_router(
    messages.router, prefix=f"{settings.API_PREFIX}/messages", tags=["Messages"]
)
app.include_router(
    escalations.router, prefix=f"{settings.API_PREFIX}/escalations", tags=["Escalations"]
)
app.include_router(
    reports.router, prefix=f"{settings.API_PREFIX}/reports", tags=["Reports"]
)
app.include_router(
    tenant_admin.router, prefix=f"{settings.API_PREFIX}/tenants", tags=["Tenant Admin"]
)
app.include_router(
    audit_logs.router, prefix=f"{settings.API_PREFIX}/audit-logs", tags=["Audit Logs"]
)
app.include_router(
    usage_tracking.router, prefix=f"{settings.API_PREFIX}/usage-tracking", tags=["Usage Tracking"]
)
app.include_router(
    webhook_events.router, prefix=f"{settings.API_PREFIX}/webhook-events", tags=["Webhook Events"]
)
app.include_router(
    lgpd.router, prefix=f"{settings.API_PREFIX}/lgpd", tags=["LGPD"]
)
app.include_router(
    media.router, prefix=f"{settings.API_PREFIX}/media", tags=["Media"]
)

# ---------------------------------------------------------------------------
# N8N integration routes (X-API-Key auth — higher rate limit: 5000 req/min)
# ---------------------------------------------------------------------------

app.include_router(
    n8n_routes.router,
    prefix="/api/n8n",
    tags=["N8N Integration"],
)


# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
