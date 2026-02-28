# =============================================================================
# Stage 1: Builder
# Purpose: Install all Python dependencies into a virtual environment.
# Keeping this stage separate means the final image does not need gcc,
# pip cache, or any other build-time tool — reducing attack surface and
# final image size considerably.
# =============================================================================
FROM python:3.11-slim AS builder

# Prevent Python from writing .pyc files and enable unbuffered stdout/stderr
# so logs appear immediately in Docker log streams.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # Tell pip to install into the venv we create below
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Create an isolated virtual environment.
# Using a venv instead of system-site-packages makes copying to the runtime
# stage trivial and avoids polluting the system Python.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy only the dependency manifest first — this layer is cached as long as
# requirements.txt does not change, giving fast rebuilds on code-only changes.
COPY requirements.txt .

# Install dependencies.
# --no-deps is intentionally omitted so transitive deps are resolved.
# cryptography / bcrypt require gcc which is present in -slim via build-essential.
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# =============================================================================
# Stage 2: Runtime
# Purpose: Minimal image that only contains the application code and the
# pre-built virtual environment copied from Stage 1.
# =============================================================================
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # Activate the venv from stage 1
    PATH="/opt/venv/bin:$PATH" \
    # Default to port 8001; can be overridden via environment
    PORT=8001

# Create a non-root user/group.
# Running as root inside a container is a security anti-pattern; if the process
# is ever compromised, the attacker only gains the nobody-equivalent uid.
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

WORKDIR /app

# Copy the virtual environment from the builder stage.
COPY --from=builder /opt/venv /opt/venv

# Copy application source code.
# Ownership is set at copy time to avoid a separate RUN chown layer.
COPY --chown=appuser:appgroup app/ ./app/

# Drop to non-root user for all subsequent instructions and at runtime.
USER appuser

# Expose the port uvicorn will listen on.
EXPOSE 8001

# Health check — Docker (and Kubernetes liveness probes) will poll /health
# every 30s, waiting up to 5s per attempt, before marking the container
# unhealthy after 3 consecutive failures.
# start-period gives the app time to start before the first probe fires.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"

# Launch uvicorn in single-worker mode.
# --workers 1: process-level concurrency is handled by async I/O inside FastAPI;
#   multiple workers should be managed externally (e.g., Kubernetes replicas)
#   to keep container behaviour deterministic.
# --host 0.0.0.0: bind to all interfaces so traffic from other Docker containers
#   or from the host can reach the service.
# --forwarded-allow-ips: trust X-Forwarded-* headers from the nginx reverse proxy.
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8001", \
     "--workers", "1", \
     "--forwarded-allow-ips", "*"]
