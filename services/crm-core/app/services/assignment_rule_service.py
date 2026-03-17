"""AssignmentRuleService — rule engine for automated document assignment.

Design decisions:

1. MULTI-TENANT SAFETY
   Every query on AssignmentRule and Assignment includes tenant_id in the WHERE
   clause.  user_ids supplied in rules are validated before being persisted, but
   the engine never fetches User rows from another tenant because the rule itself
   is already tenant-scoped.

2. ROUND-ROBIN STATE
   The current position in the rotation is stored as the index of the LAST
   assigned user inside a JSON metadata field embedded in users_json as:
     {"users": [...uuids...], "_rr_index": N}
   This avoids a separate state table while keeping the implementation
   self-contained in the rule row.  Concurrent requests could cause a
   skipped turn but the result is still balanced over time.

3. LOAD-BALANCING
   Counts open assignments per user across all doctypes for the tenant (not just
   for the current doctype) — this gives a more accurate picture of overall
   workload.  Change the WHERE clause if per-doctype balancing is preferred.

4. CONDITION EVALUATION
   Same eval()-based approach as SLAService.  See that module for the security
   caveat.

5. IDEMPOTENCY
   apply_rules() checks whether an open Assignment for the same doctype +
   docname + assigned_to_id already exists before inserting.  Calling apply_rules
   twice on the same entity will not create duplicate assignments.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.assignment import Assignment, AssignmentRule
from app.schemas.assignment_rule import AssignmentRuleCreate, AssignmentRuleUpdate

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _parse_users_json(raw: str | None) -> list[str]:
    """Parse users_json stored in the rule.

    Stored format (internal):
        {"users": ["uuid1", "uuid2", ...], "_rr_index": N}
    OR simple legacy format:
        ["uuid1", "uuid2", ...]

    Always returns a list of UUID strings.
    """
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(u) for u in parsed]
        if isinstance(parsed, dict):
            return [str(u) for u in parsed.get("users", [])]
    except (json.JSONDecodeError, TypeError):
        pass
    return []


def _get_rr_index(raw: str | None) -> int:
    """Extract the round-robin index from users_json, default 0."""
    if not raw:
        return 0
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return int(parsed.get("_rr_index", 0))
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    return 0


def _build_users_json(user_ids: list[uuid.UUID], rr_index: int = 0) -> str:
    """Serialize user list + round-robin index into the stored JSON format."""
    return json.dumps({"users": [str(u) for u in user_ids], "_rr_index": rr_index})


def _evaluate_condition(condition: str | None, entity: Any) -> bool:
    """Evaluate a Python condition expression against an ORM entity.

    Returns True when the condition is None (always matches) or evaluates truthy.
    """
    if not condition:
        return True
    try:
        entity_dict: dict[str, Any] = {}
        for col in entity.__table__.columns:
            entity_dict[col.name] = getattr(entity, col.name, None)
        result = eval(condition, {"__builtins__": {}}, {"doc": entity_dict})  # noqa: S307
        return bool(result)
    except Exception as exc:
        logger.warning(
            "assignment_condition_eval_error",
            condition=condition,
            error=str(exc),
        )
        return False


def _build_rule_query(tenant_id: uuid.UUID):
    """Base SELECT for AssignmentRule scoped to tenant."""
    return (
        select(AssignmentRule)
        .where(AssignmentRule.tenant_id == tenant_id)
    )


# ---------------------------------------------------------------------------
# AssignmentRuleService
# ---------------------------------------------------------------------------


class AssignmentRuleService:
    """Business logic for AssignmentRule management and assignment engine."""

    # ------------------------------------------------------------------
    # list_rules
    # ------------------------------------------------------------------

    async def list_rules(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> list[AssignmentRule]:
        """Return all assignment rules for the tenant ordered by name."""
        result = await db.execute(
            _build_rule_query(tenant_id).order_by(AssignmentRule.name.asc())
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # get_rule
    # ------------------------------------------------------------------

    async def get_rule(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        rule_id: uuid.UUID,
    ) -> AssignmentRule:
        """Fetch a single AssignmentRule by PK, scoped to tenant."""
        result = await db.execute(
            _build_rule_query(tenant_id).where(AssignmentRule.id == rule_id)
        )
        rule = result.scalar_one_or_none()
        if not rule:
            raise NotFoundError(f"AssignmentRule {rule_id} not found")
        return rule

    # ------------------------------------------------------------------
    # create_rule
    # ------------------------------------------------------------------

    async def create_rule(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        data: AssignmentRuleCreate,
    ) -> AssignmentRule:
        """Create an AssignmentRule.  user_ids are serialised to JSON."""
        rule = AssignmentRule(
            tenant_id=tenant_id,
            name=data.name,
            doctype=data.doctype,
            assign_condition=data.assign_condition,
            assignment_type=data.assignment_type,
            users_json=_build_users_json(data.user_ids, rr_index=0),
            enabled=data.enabled,
        )
        db.add(rule)
        await db.flush()

        logger.info(
            "assignment_rule_created",
            rule_id=str(rule.id),
            tenant_id=str(tenant_id),
            name=data.name,
        )
        return rule

    # ------------------------------------------------------------------
    # update_rule
    # ------------------------------------------------------------------

    async def update_rule(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        rule_id: uuid.UUID,
        data: AssignmentRuleUpdate,
    ) -> AssignmentRule:
        """Partial update of an AssignmentRule.

        When user_ids is provided the round-robin index is reset to 0 so that
        a changed pool starts fresh.
        """
        rule = await self.get_rule(db, tenant_id, rule_id)

        if data.name is not None:
            rule.name = data.name
        if data.doctype is not None:
            rule.doctype = data.doctype
        if data.assign_condition is not None:
            rule.assign_condition = data.assign_condition
        if data.assignment_type is not None:
            rule.assignment_type = data.assignment_type
        if data.enabled is not None:
            rule.enabled = data.enabled

        if data.user_ids is not None:
            # Reset round-robin index when pool changes
            rule.users_json = _build_users_json(data.user_ids, rr_index=0)

        await db.flush()

        logger.info(
            "assignment_rule_updated",
            rule_id=str(rule_id),
            tenant_id=str(tenant_id),
        )
        return rule

    # ------------------------------------------------------------------
    # delete_rule
    # ------------------------------------------------------------------

    async def delete_rule(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        rule_id: uuid.UUID,
    ) -> None:
        """Hard-delete an AssignmentRule."""
        rule = await self.get_rule(db, tenant_id, rule_id)
        await db.delete(rule)
        await db.flush()
        logger.info(
            "assignment_rule_deleted",
            rule_id=str(rule_id),
            tenant_id=str(tenant_id),
        )

    # ------------------------------------------------------------------
    # apply_rules  (assignment engine — called at entity creation/update)
    # ------------------------------------------------------------------

    async def apply_rules(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        doctype: str,
        entity: Any,
    ) -> list[Assignment]:
        """Evaluate all enabled rules for `doctype` and create assignments.

        Rules are evaluated in alphabetical order (by name).  Each matching rule
        creates one Assignment (via round_robin or load_balancing).  Multiple
        matching rules result in multiple assignments — this matches Frappe CRM's
        "all matching rules fire" behaviour.

        Returns the list of Assignment rows created (may be empty).
        """
        result = await db.execute(
            _build_rule_query(tenant_id)
            .where(
                AssignmentRule.enabled.is_(True),
                AssignmentRule.doctype == doctype,
            )
            .order_by(AssignmentRule.name.asc())
        )
        rules: list[AssignmentRule] = list(result.scalars().all())

        created_assignments: list[Assignment] = []

        for rule in rules:
            if not _evaluate_condition(rule.assign_condition, entity):
                continue

            assignment: Assignment | None = None

            if rule.assignment_type == "round_robin":
                assignment = await self._round_robin_assign(
                    db=db,
                    tenant_id=tenant_id,
                    rule=rule,
                    doctype=doctype,
                    entity_id=entity.id,
                )
            elif rule.assignment_type == "load_balancing":
                assignment = await self._load_balance_assign(
                    db=db,
                    tenant_id=tenant_id,
                    rule=rule,
                    doctype=doctype,
                    entity_id=entity.id,
                )
            else:
                logger.warning(
                    "unknown_assignment_type",
                    assignment_type=rule.assignment_type,
                    rule_id=str(rule.id),
                )

            if assignment:
                created_assignments.append(assignment)

        return created_assignments

    # ------------------------------------------------------------------
    # _round_robin_assign
    # ------------------------------------------------------------------

    async def _round_robin_assign(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        rule: AssignmentRule,
        doctype: str,
        entity_id: uuid.UUID,
    ) -> Assignment | None:
        """Pick the next user in rotation and create/return an Assignment.

        The rotation index is stored inside users_json and incremented atomically
        (within the same DB transaction).  Callers use db.flush() to make the
        state change visible before any concurrent request reads it.
        """
        user_ids = _parse_users_json(rule.users_json)
        if not user_ids:
            logger.warning(
                "round_robin_empty_pool",
                rule_id=str(rule.id),
                tenant_id=str(tenant_id),
            )
            return None

        current_index = _get_rr_index(rule.users_json)
        picked_user_id_str = user_ids[current_index % len(user_ids)]
        next_index = (current_index + 1) % len(user_ids)

        # Persist the new index
        rule.users_json = _build_users_json(
            [uuid.UUID(u) for u in user_ids], rr_index=next_index
        )

        picked_user_id = uuid.UUID(picked_user_id_str)
        return await self._create_assignment_if_not_exists(
            db=db,
            tenant_id=tenant_id,
            doctype=doctype,
            docname=entity_id,
            assigned_to_id=picked_user_id,
            assigned_by_id=None,
        )

    # ------------------------------------------------------------------
    # _load_balance_assign
    # ------------------------------------------------------------------

    async def _load_balance_assign(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        rule: AssignmentRule,
        doctype: str,
        entity_id: uuid.UUID,
    ) -> Assignment | None:
        """Pick the user with the fewest open assignments and assign.

        Open assignments are counted across ALL doctypes for the tenant so that
        the overall workload of each user is considered.
        """
        user_ids = _parse_users_json(rule.users_json)
        if not user_ids:
            logger.warning(
                "load_balance_empty_pool",
                rule_id=str(rule.id),
                tenant_id=str(tenant_id),
            )
            return None

        parsed_ids = [uuid.UUID(u) for u in user_ids]

        # Count open assignments per user in the pool
        counts_result = await db.execute(
            select(
                Assignment.assigned_to_id,
                func.count(Assignment.id).label("open_count"),
            )
            .where(
                Assignment.tenant_id == tenant_id,
                Assignment.assigned_to_id.in_(parsed_ids),
                Assignment.status == "Open",
            )
            .group_by(Assignment.assigned_to_id)
        )
        counts_map: dict[uuid.UUID, int] = {
            row.assigned_to_id: row.open_count for row in counts_result.all()
        }

        # Pick the user with the smallest count; break ties by pool order
        picked_user_id: uuid.UUID = min(
            parsed_ids, key=lambda uid: counts_map.get(uid, 0)
        )

        return await self._create_assignment_if_not_exists(
            db=db,
            tenant_id=tenant_id,
            doctype=doctype,
            docname=entity_id,
            assigned_to_id=picked_user_id,
            assigned_by_id=None,
        )

    # ------------------------------------------------------------------
    # _create_assignment_if_not_exists
    # ------------------------------------------------------------------

    async def _create_assignment_if_not_exists(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        doctype: str,
        docname: uuid.UUID,
        assigned_to_id: uuid.UUID,
        assigned_by_id: uuid.UUID | None,
    ) -> Assignment:
        """Return an existing open Assignment or create a new one.

        Idempotency guard: if an open Assignment for the same
        doctype+docname+assigned_to_id already exists, return it unchanged.
        """
        existing_result = await db.execute(
            select(Assignment)
            .where(
                Assignment.tenant_id == tenant_id,
                Assignment.doctype == doctype,
                Assignment.docname == docname,
                Assignment.assigned_to_id == assigned_to_id,
                Assignment.status == "Open",
            )
            .options(selectinload(Assignment.assigned_to))
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            return existing

        assignment = Assignment(
            tenant_id=tenant_id,
            doctype=doctype,
            docname=docname,
            assigned_to_id=assigned_to_id,
            assigned_by_id=assigned_by_id,
            status="Open",
        )
        db.add(assignment)
        await db.flush()

        logger.info(
            "assignment_created",
            assignment_id=str(assignment.id),
            doctype=doctype,
            docname=str(docname),
            assigned_to_id=str(assigned_to_id),
            tenant_id=str(tenant_id),
        )
        return assignment

    # ------------------------------------------------------------------
    # Helper: expose parsed user_ids from a rule (used by API layer)
    # ------------------------------------------------------------------

    @staticmethod
    def extract_user_ids(rule: AssignmentRule) -> list[uuid.UUID]:
        """Parse rule.users_json -> list of UUID for the response schema."""
        raw = _parse_users_json(rule.users_json)
        try:
            return [uuid.UUID(u) for u in raw]
        except (ValueError, AttributeError):
            return []


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

assignment_rule_service = AssignmentRuleService()
