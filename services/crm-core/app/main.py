from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import AppException

# Socket.io server must be imported before the FastAPI app is built so that
# the sio instance is created and event handlers are registered at startup.
from app.realtime.socket_manager import socket_app  # noqa: E402

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CRM Core starting", version=settings.APP_VERSION)
    yield
    logger.info("CRM Core shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-API-Key"],
)


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------

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
