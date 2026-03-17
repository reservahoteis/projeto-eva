"""Request ID middleware for request tracing (MED-006).

Generates a unique X-Request-ID for every incoming request and binds it
to structlog context so all log entries within a request share the same
correlation ID.  If the incoming request already carries an X-Request-ID
header (e.g. from nginx), it is reused.
"""

from __future__ import annotations

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

HEADER = "X-Request-ID"


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get(HEADER) or str(uuid.uuid4())

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)
        response.headers[HEADER] = request_id
        return response
