"""SLAService — SLA management and business-hours deadline engine.

Design decisions:

1. MULTI-TENANT SAFETY
   Every query that touches ServiceLevelAgreement rows joins through tenant_id.
   ServiceLevelPriority and ServiceDay do not carry tenant_id themselves (see
   model comments), so they are always accessed through an SLA that is already
   scoped to the correct tenant.

2. BUSINESS-HOURS TIME CALCULATION
   _calculate_response_deadline() walks forward in time minute-by-minute using
   a logical "remaining budget" approach rather than a literal minute loop:
     - For each day segment it computes how many business-hours minutes are
       available from the current clock position to the end of the work window.
     - If the budget is satisfied within that segment, we return the deadline
       offset by the remaining minutes.
     - Otherwise the remaining budget is reduced by the available minutes and
       we advance to the next business day.
   This is O(days_needed) not O(minutes), so it stays fast even for large SLAs.

3. ENTITY PROTOCOL
   apply_sla / check_sla_breach / record_first_response accept plain SQLAlchemy
   ORM instances (Lead or Deal).  The service modifies them in-place and flushes
   so the caller can commit once at the end of a request.

4. CONDITION EVALUATION
   SLA conditions are stored as plain Python expressions evaluated with eval()
   against a restricted namespace containing only the entity dict.  This matches
   the Frappe CRM precedent.  NEVER allow user-supplied code in production without
   an additional sandboxing layer.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.sla import ServiceDay, ServiceLevelAgreement, ServiceLevelPriority
from app.schemas.sla import SLACreate, SLAUpdate

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Day ordering used for business-hour walking
# ---------------------------------------------------------------------------

_DAY_ORDER: dict[str, int] = {
    "Mon": 0,
    "Tue": 1,
    "Wed": 2,
    "Thu": 3,
    "Fri": 4,
    "Sat": 5,
    "Sun": 6,
}

_INT_TO_DAY: dict[int, str] = {v: k for k, v in _DAY_ORDER.items()}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _timedelta_to_minutes(td: Any) -> int:
    """Convert a timedelta (or PostgreSQL Interval) to whole minutes."""
    if isinstance(td, timedelta):
        return int(td.total_seconds() // 60)
    # Fallback for any interval-like object that exposes total_seconds
    if hasattr(td, "total_seconds"):
        return int(td.total_seconds() // 60)
    return 0


def _build_sla_query(tenant_id: uuid.UUID):
    """Base SELECT with eager-loaded child relationships."""
    return (
        select(ServiceLevelAgreement)
        .where(ServiceLevelAgreement.tenant_id == tenant_id)
        .options(
            selectinload(ServiceLevelAgreement.priorities),
            selectinload(ServiceLevelAgreement.service_days),
        )
    )


def _evaluate_condition(condition: str | None, entity: Any) -> bool:
    """Evaluate a Python condition expression against an entity.

    The entity is exposed as a dict under the name 'doc' inside the expression.
    Returns True when the condition is absent (always matches) or evaluates to a
    truthy value.
    """
    if not condition:
        return True
    try:
        entity_dict: dict[str, Any] = {}
        for col in entity.__table__.columns:
            entity_dict[col.name] = getattr(entity, col.name, None)
        # Restricted globals — no builtins exposed
        result = eval(condition, {"__builtins__": {}}, {"doc": entity_dict})  # noqa: S307
        return bool(result)
    except Exception as exc:
        logger.warning(
            "sla_condition_eval_error",
            condition=condition,
            error=str(exc),
        )
        return False


def _sorted_service_days(service_days: list[ServiceDay]) -> list[ServiceDay]:
    """Return service_days ordered Monday-to-Sunday."""
    return sorted(service_days, key=lambda d: _DAY_ORDER.get(d.day, 7))


# ---------------------------------------------------------------------------
# Business-hours deadline calculation
# ---------------------------------------------------------------------------


def _is_within_business_hours(service_days: list[ServiceDay], dt: datetime) -> bool:
    """Return True if `dt` falls inside any configured business-hours window."""
    weekday = dt.weekday()  # 0=Mon … 6=Sun
    day_abbr = _INT_TO_DAY.get(weekday)
    if not day_abbr:
        return False
    t = dt.time().replace(second=0, microsecond=0)
    for sd in service_days:
        if sd.day == day_abbr and sd.start_time <= t < sd.end_time:
            return True
    return False


def _calculate_response_deadline(
    sla_priority: ServiceLevelPriority,
    service_days: list[ServiceDay],
    from_time: datetime,
) -> datetime:
    """Compute the response deadline in business-hours.

    Algorithm:
      Given a starting datetime and a budget of N business-hours minutes,
      walk forward day by day (and within each day, window by window) until
      the budget is exhausted.

    Handles:
      - Entry point outside business hours (advance to next open window)
      - Multi-day SLAs
      - SLAs that span multiple windows per day (though the model stores one
        window per day, the code supports an extension to multiple via the
        sorted day list)

    Arguments:
        sla_priority  — ORM row; response_time is a timedelta/Interval
        service_days  — list of ServiceDay rows for the parent SLA
        from_time     — timezone-aware datetime (creation time of the entity)

    Returns a timezone-aware datetime representing the response deadline.
    Raises BadRequestError when no service days are configured.
    """
    if not service_days:
        raise BadRequestError(
            "SLA has no configured service days — cannot calculate response deadline"
        )

    budget_minutes = _timedelta_to_minutes(sla_priority.response_time)
    if budget_minutes <= 0:
        return from_time

    # Build a lookup: day_abbr -> ServiceDay
    day_map: dict[str, ServiceDay] = {sd.day: sd for sd in service_days}
    sorted_days_abbr = sorted(day_map.keys(), key=lambda d: _DAY_ORDER.get(d, 7))

    # Work with a tz-aware cursor
    cursor = from_time.astimezone(UTC)

    # We allow up to 365 calendar days to consume the budget before giving up
    # (prevents infinite loops when days are misconfigured).
    max_iterations = 365 * 24 * 60  # one minute per iteration worst case
    iterations = 0

    while budget_minutes > 0 and iterations < max_iterations:
        iterations += 1
        weekday = cursor.weekday()  # 0=Mon … 6=Sun
        day_abbr = _INT_TO_DAY.get(weekday)

        if day_abbr not in day_map:
            # This is not a business day — jump to the start of the next day
            cursor = datetime(
                cursor.year, cursor.month, cursor.day, tzinfo=cursor.tzinfo
            ) + timedelta(days=1)
            continue

        sd = day_map[day_abbr]
        # Build timezone-aware datetimes for the window boundaries today
        day_start = cursor.replace(
            hour=sd.start_time.hour,
            minute=sd.start_time.minute,
            second=0,
            microsecond=0,
        )
        day_end = cursor.replace(
            hour=sd.end_time.hour,
            minute=sd.end_time.minute,
            second=0,
            microsecond=0,
        )

        if cursor >= day_end:
            # We are past today's window — advance to next calendar day start
            cursor = datetime(
                cursor.year, cursor.month, cursor.day, tzinfo=cursor.tzinfo
            ) + timedelta(days=1)
            continue

        if cursor < day_start:
            # We arrived before the window opens — snap to window start
            cursor = day_start

        # How many minutes are available from cursor to end of this window?
        available_minutes = int((day_end - cursor).total_seconds() // 60)

        if available_minutes >= budget_minutes:
            # The deadline falls within this window
            return cursor + timedelta(minutes=budget_minutes)

        # Consume all available minutes today and advance to next day
        budget_minutes -= available_minutes
        cursor = datetime(
            cursor.year, cursor.month, cursor.day, tzinfo=cursor.tzinfo
        ) + timedelta(days=1)

    # Fallback: we ran out of iterations — return a far-future datetime
    logger.warning(
        "sla_deadline_calculation_overrun",
        sla_priority_id=str(sla_priority.id),
        from_time=from_time.isoformat(),
    )
    return from_time + timedelta(days=30)


# ---------------------------------------------------------------------------
# SLAService
# ---------------------------------------------------------------------------


class SLAService:
    """Business logic for SLA management and SLA engine operations."""

    # ------------------------------------------------------------------
    # list_slas
    # ------------------------------------------------------------------

    async def list_slas(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> list[ServiceLevelAgreement]:
        """Return all SLAs for the tenant ordered by name."""
        result = await db.execute(
            _build_sla_query(tenant_id).order_by(ServiceLevelAgreement.name.asc())
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # get_sla
    # ------------------------------------------------------------------

    async def get_sla(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        sla_id: uuid.UUID,
    ) -> ServiceLevelAgreement:
        """Fetch a single SLA by PK, scoped to tenant."""
        result = await db.execute(
            _build_sla_query(tenant_id).where(ServiceLevelAgreement.id == sla_id)
        )
        sla = result.scalar_one_or_none()
        if not sla:
            raise NotFoundError(f"ServiceLevelAgreement {sla_id} not found")
        return sla

    # ------------------------------------------------------------------
    # create_sla
    # ------------------------------------------------------------------

    async def create_sla(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: SLACreate,
    ) -> ServiceLevelAgreement:
        """Create an SLA with all priorities and service days in one transaction.

        Steps:
          1. Insert ServiceLevelAgreement row.
          2. Flush to obtain the sla.id (needed by child rows).
          3. Insert ServiceLevelPriority rows (converting minutes -> timedelta).
          4. Insert ServiceDay rows.
          5. Flush and reload with relationships.
        """
        sla = ServiceLevelAgreement(
            tenant_id=tenant_id,
            name=data.name,
            applies_to=data.applies_to,
            condition=data.condition,
            enabled=data.enabled,
        )
        db.add(sla)
        await db.flush()  # populate sla.id

        for p in data.priorities:
            priority_row = ServiceLevelPriority(
                sla_id=sla.id,
                priority=p.priority,
                response_time=timedelta(minutes=p.response_time_minutes),
                resolution_time=timedelta(minutes=p.resolution_time_minutes),
            )
            db.add(priority_row)

        for d in data.service_days:
            day_row = ServiceDay(
                sla_id=sla.id,
                day=d.day,
                start_time=d.start_time,
                end_time=d.end_time,
            )
            db.add(day_row)

        await db.flush()

        # Reload with relationships populated
        sla = await self.get_sla(db, tenant_id, sla.id)
        logger.info(
            "sla_created",
            sla_id=str(sla.id),
            tenant_id=str(tenant_id),
            name=data.name,
        )
        return sla

    # ------------------------------------------------------------------
    # update_sla
    # ------------------------------------------------------------------

    async def update_sla(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        sla_id: uuid.UUID,
        data: SLAUpdate,
    ) -> ServiceLevelAgreement:
        """Update an SLA.

        Scalar fields are updated in-place.  When priorities or service_days are
        provided in the payload they FULLY REPLACE the existing child rows (delete
        all old rows, insert new ones) — this matches Frappe CRM's behaviour of
        treating child tables as owned collections.
        """
        sla = await self.get_sla(db, tenant_id, sla_id)

        if data.name is not None:
            sla.name = data.name
        if data.applies_to is not None:
            sla.applies_to = data.applies_to
        if data.condition is not None:
            sla.condition = data.condition
        if data.enabled is not None:
            sla.enabled = data.enabled

        if data.priorities is not None:
            # Delete existing priorities (cascade=all handles ORM-side deletion)
            for p in list(sla.priorities):
                await db.delete(p)
            await db.flush()
            for p in data.priorities:
                priority_row = ServiceLevelPriority(
                    sla_id=sla.id,
                    priority=p.priority,
                    response_time=timedelta(minutes=p.response_time_minutes),
                    resolution_time=timedelta(minutes=p.resolution_time_minutes),
                )
                db.add(priority_row)

        if data.service_days is not None:
            for d in list(sla.service_days):
                await db.delete(d)
            await db.flush()
            for d in data.service_days:
                day_row = ServiceDay(
                    sla_id=sla.id,
                    day=d.day,
                    start_time=d.start_time,
                    end_time=d.end_time,
                )
                db.add(day_row)

        await db.flush()

        sla = await self.get_sla(db, tenant_id, sla_id)
        logger.info(
            "sla_updated",
            sla_id=str(sla_id),
            tenant_id=str(tenant_id),
        )
        return sla

    # ------------------------------------------------------------------
    # delete_sla
    # ------------------------------------------------------------------

    async def delete_sla(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        sla_id: uuid.UUID,
    ) -> None:
        """Hard-delete an SLA.  Cascades to priorities and service_days."""
        sla = await self.get_sla(db, tenant_id, sla_id)
        await db.delete(sla)
        await db.flush()
        logger.info(
            "sla_deleted",
            sla_id=str(sla_id),
            tenant_id=str(tenant_id),
        )

    # ------------------------------------------------------------------
    # apply_sla  (SLA engine — called at entity creation)
    # ------------------------------------------------------------------

    async def apply_sla(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        entity_type: str,
        entity: Any,
    ) -> None:
        """Match an entity against applicable SLAs and set SLA fields.

        Rules:
          - Only enabled SLAs with applies_to == entity_type are considered.
          - They are evaluated in alphabetical order (deterministic).
          - The first matching SLA wins.
          - If no SLA matches, SLA fields are left unchanged.

        The `entity` object is modified in-place (sla_id, sla_creation,
        response_by, sla_status).  The caller is responsible for flush/commit.

        Priority matching:
          The entity is expected to have a `priority` attribute.  If it does not,
          or if the SLA has no matching priority tier, the first priority tier
          (alphabetically) is used as a fallback.
        """
        # Fetch all enabled SLAs for this tenant + entity_type, ordered by name
        result = await db.execute(
            _build_sla_query(tenant_id)
            .where(
                ServiceLevelAgreement.enabled.is_(True),
                ServiceLevelAgreement.applies_to == entity_type,
            )
            .order_by(ServiceLevelAgreement.name.asc())
        )
        slas: list[ServiceLevelAgreement] = list(result.scalars().all())

        matching_sla: ServiceLevelAgreement | None = None
        for sla in slas:
            if _evaluate_condition(sla.condition, entity):
                matching_sla = sla
                break

        if not matching_sla:
            logger.debug(
                "no_sla_matched",
                entity_type=entity_type,
                entity_id=str(getattr(entity, "id", None)),
                tenant_id=str(tenant_id),
            )
            return

        # Determine the priority tier to use
        entity_priority: str | None = getattr(entity, "priority", None)
        priority_tier: ServiceLevelPriority | None = None

        if entity_priority:
            for p in matching_sla.priorities:
                if p.priority == entity_priority:
                    priority_tier = p
                    break

        if not priority_tier and matching_sla.priorities:
            # Fallback: pick the "highest" priority tier (High > Medium > Low)
            priority_order = {"High": 0, "Medium": 1, "Low": 2}
            priority_tier = sorted(
                matching_sla.priorities,
                key=lambda p: priority_order.get(p.priority, 99),
            )[0]

        if not priority_tier:
            logger.warning(
                "sla_no_priority_tier",
                sla_id=str(matching_sla.id),
                entity_type=entity_type,
            )
            return

        now = datetime.now(UTC)
        response_deadline = _calculate_response_deadline(
            sla_priority=priority_tier,
            service_days=matching_sla.service_days,
            from_time=now,
        )

        entity.sla_id = matching_sla.id
        entity.sla_creation = now
        entity.response_by = response_deadline
        entity.sla_status = "Open"

        logger.info(
            "sla_applied",
            sla_id=str(matching_sla.id),
            entity_type=entity_type,
            entity_id=str(getattr(entity, "id", None)),
            response_by=response_deadline.isoformat(),
            tenant_id=str(tenant_id),
        )

    # ------------------------------------------------------------------
    # check_sla_breach
    # ------------------------------------------------------------------

    async def check_sla_breach(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        entity: Any,
    ) -> bool:
        """Check whether the entity's response_by deadline has passed.

        If the deadline has passed and the entity has not yet responded
        (first_responded_on is None), sla_status is set to 'Breached'.

        Returns True if a breach was detected (and the entity was updated).
        The caller is responsible for flush/commit.
        """
        if not getattr(entity, "sla_id", None):
            return False

        response_by: datetime | None = getattr(entity, "response_by", None)
        if not response_by:
            return False

        # Already in a terminal state — do not re-evaluate
        current_status: str | None = getattr(entity, "sla_status", None)
        if current_status in ("Fulfilled", "Breached"):
            return False

        now = datetime.now(UTC)
        # Make response_by tz-aware if it isn't already
        if response_by.tzinfo is None:
            response_by = response_by.replace(tzinfo=UTC)

        if now > response_by and not getattr(entity, "first_responded_on", None):
            entity.sla_status = "Breached"
            logger.info(
                "sla_breached",
                entity_id=str(getattr(entity, "id", None)),
                response_by=response_by.isoformat(),
                tenant_id=str(tenant_id),
            )
            return True

        return False

    # ------------------------------------------------------------------
    # record_first_response
    # ------------------------------------------------------------------

    async def record_first_response(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        entity: Any,
    ) -> None:
        """Record the first human response on an entity.

        Sets:
          - first_responded_on = now
          - first_response_time = now - sla_creation  (interval)
          - sla_status = 'Fulfilled' if response_by has not passed, else 'Breached'

        Idempotent: does nothing if first_responded_on is already set.
        The caller is responsible for flush/commit.
        """
        if not getattr(entity, "sla_id", None):
            return
        if getattr(entity, "first_responded_on", None):
            return  # Already recorded

        now = datetime.now(UTC)
        entity.first_responded_on = now

        sla_creation: datetime | None = getattr(entity, "sla_creation", None)
        if sla_creation:
            if sla_creation.tzinfo is None:
                sla_creation = sla_creation.replace(tzinfo=UTC)
            entity.first_response_time = now - sla_creation

        response_by: datetime | None = getattr(entity, "response_by", None)
        if response_by:
            if response_by.tzinfo is None:
                response_by = response_by.replace(tzinfo=UTC)
            entity.sla_status = "Fulfilled" if now <= response_by else "Breached"
        else:
            entity.sla_status = "Fulfilled"

        logger.info(
            "sla_first_response_recorded",
            entity_id=str(getattr(entity, "id", None)),
            sla_status=entity.sla_status,
            tenant_id=str(tenant_id),
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

sla_service = SLAService()
