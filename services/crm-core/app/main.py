from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import AppException

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
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "crm-core"}


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
)

app.include_router(leads.router, prefix=f"{settings.API_PREFIX}/leads", tags=["Leads"])
app.include_router(deals.router, prefix=f"{settings.API_PREFIX}/deals", tags=["Deals"])
app.include_router(contacts.router, prefix=f"{settings.API_PREFIX}/contacts", tags=["Contacts"])
app.include_router(
    organizations.router, prefix=f"{settings.API_PREFIX}/organizations", tags=["Organizations"]
)
app.include_router(tasks.router, prefix=f"{settings.API_PREFIX}/tasks", tags=["Tasks"])
app.include_router(notes.router, prefix=f"{settings.API_PREFIX}/notes", tags=["Notes"])
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
