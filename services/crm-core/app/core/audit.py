"""Audit trail helper — thin wrapper around AuditLogService for route handlers.

Usage in route handlers:

    from app.core.audit import emit_audit_log

    # Create
    result = await contact_service.create_contact(...)
    await emit_audit_log(
        db=db, tenant_id=tenant_id, action="CONTACT_CREATED",
        entity="Contact", entity_id=str(result.id),
        user_id=current_user.id, request=request,
        new_data=result.model_dump(mode="json"),
    )

    # Update (snapshot before the call)
    old = await contact_service.get_contact(...)
    old_snapshot = old.model_dump(mode="json")
    result = await contact_service.update_contact(...)
    await emit_audit_log(
        db=db, tenant_id=tenant_id, action="CONTACT_UPDATED",
        entity="Contact", entity_id=str(contact_id),
        user_id=current_user.id, request=request,
        old_data=old_snapshot, new_data=result.model_dump(mode="json"),
    )

    # Delete
    await contact_service.delete_contact(...)
    await emit_audit_log(
        db=db, tenant_id=tenant_id, action="CONTACT_DELETED",
        entity="Contact", entity_id=str(contact_id),
        user_id=current_user.id, request=request,
    )

Design decisions:
  - emit_audit_log is a coroutine but is fire-and-forget in practice: all errors
    are already caught silently by AuditLogService.log(), so no try/catch is needed
    here. If the inner log() fails it emits a structlog ERROR and returns None.
  - IP extraction prefers X-Forwarded-For (typical behind a reverse proxy) and
    falls back to request.client.host.
  - UUID values in old_data / new_data dicts are serialised to str so that the
    JSON column in PostgreSQL accepts them without a custom encoder.
  - snapshot_model is a utility for converting SQLAlchemy ORM instances to a
    plain dict suitable for old_data / new_data fields.
"""

from __future__ import annotations

import uuid
from typing import Any

import structlog
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.audit_log_service import audit_log_service

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# IP extraction
# ---------------------------------------------------------------------------


def _extract_ip(request: Request | None) -> str | None:
    """Return the caller's IP address from the request.

    Checks X-Forwarded-For first (set by nginx / load balancers), then falls
    back to the direct connection's remote address.
    """
    if request is None:
        return None
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For may contain a comma-separated chain — first entry is
        # the original client.
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


# ---------------------------------------------------------------------------
# UUID serialisation
# ---------------------------------------------------------------------------


def _serialize_uuids(data: dict[str, Any] | None) -> dict[str, Any] | None:
    """Return a copy of *data* with all uuid.UUID values converted to str.

    Operates only on the top level — nested dicts/lists are left as-is
    because Pydantic's model_dump(mode="json") already serialises nested UUIDs
    when called correctly.  This guard handles cases where a raw SQLAlchemy
    attribute dict is passed instead.
    """
    if data is None:
        return None
    result: dict[str, Any] = {}
    for key, value in data.items():
        if isinstance(value, uuid.UUID):
            result[key] = str(value)
        else:
            result[key] = value
    return result


# ---------------------------------------------------------------------------
# Model snapshot helper
# ---------------------------------------------------------------------------


def snapshot_model(instance: Any, exclude: set[str] | None = None) -> dict[str, Any]:
    """Convert a SQLAlchemy ORM instance to a JSON-safe dict for audit logging.

    Uses the instance's __table__.columns to enumerate column names and reads
    the corresponding Python-side attribute values.  UUID values are serialised
    to str; other scalar types are left as-is (they are JSON-serialisable by
    Python's standard json module).

    Args:
        instance: A SQLAlchemy mapped model instance.
        exclude: Optional set of column names to omit from the snapshot.

    Returns:
        A plain dict suitable for passing as old_data / new_data to
        emit_audit_log.
    """
    exclude = exclude or set()
    snapshot: dict[str, Any] = {}
    try:
        for column in instance.__table__.columns:
            if column.name in exclude:
                continue
            value = getattr(instance, column.name, None)
            if isinstance(value, uuid.UUID):
                snapshot[column.name] = str(value)
            else:
                snapshot[column.name] = value
    except Exception:  # noqa: BLE001
        # If anything goes wrong (e.g. detached instance), return empty dict
        # rather than crashing the caller.
        logger.warning("snapshot_model_failed", instance_type=type(instance).__name__)
    return snapshot


# ---------------------------------------------------------------------------
# emit_audit_log — the main helper used in route handlers
# ---------------------------------------------------------------------------


async def emit_audit_log(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    action: str,
    entity: str,
    entity_id: str | None = None,
    user_id: uuid.UUID | None = None,
    old_data: dict[str, Any] | None = None,
    new_data: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    """Emit a single audit log entry for a CUD operation.

    This is a thin wrapper around ``audit_log_service.log()`` that:
      - Extracts the caller IP from the FastAPI Request object.
      - Serialises any bare uuid.UUID values in old_data / new_data to str.
      - Delegates all error handling to AuditLogService (fire-and-forget).

    This coroutine itself never raises — any exception inside log() is caught
    and logged at ERROR level by AuditLogService.

    Args:
        db: The current async SQLAlchemy session (must be the same session as
            the surrounding request so it shares the transaction).
        tenant_id: The tenant scoping this audit entry.
        action: A string constant describing the operation, e.g. "CONTACT_CREATED".
        entity: The entity type name, e.g. "Contact".
        entity_id: The string PK of the entity (UUID as str is fine).
        user_id: The ID of the user who performed the action.  None for
            unauthenticated actions (e.g. LOGIN_FAILED).
        old_data: Snapshot of the entity state BEFORE the mutation (update/delete).
        new_data: Snapshot of the entity state AFTER the mutation (create/update).
        request: The FastAPI Request instance — used to extract the caller IP.
    """
    await audit_log_service.log(
        db=db,
        tenant_id=tenant_id,
        action=action,
        user_id=user_id,
        entity=entity,
        entity_id=entity_id,
        old_data=_serialize_uuids(old_data),
        new_data=_serialize_uuids(new_data),
        ip_address=_extract_ip(request),
    )
