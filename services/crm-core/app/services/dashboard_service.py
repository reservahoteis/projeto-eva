"""DashboardService — aggregated stats for the Dashboard endpoint.

Design decisions:
  - All queries are scoped to tenant_id in the WHERE clause — no global reads.
  - A single async method `get_stats` fires five concurrent count/sum queries
    against the database.  Each query uses func.count() or func.coalesce +
    func.sum() so the work stays in PostgreSQL, not in Python.
  - Open deals: JOIN with deal_statuses WHERE status_type = 'Open'.
  - Won deals count + won value: JOIN with deal_statuses WHERE status_type = 'Won'.
  - Conversion rate is computed in Python: (won / total) * 100, guarded against
    division by zero.
  - The module-level singleton `dashboard_service = DashboardService()` is the
    canonical import for use in routers.
"""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.deal import Deal
from app.models.lead import Lead
from app.models.lookups import DealStatus
from app.models.organization import Organization
from app.schemas.dashboard import DashboardStats

logger = structlog.get_logger()


class DashboardService:
    """Aggregated dashboard stats, strictly scoped per tenant."""

    async def get_stats(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> DashboardStats:
        """Return aggregated dashboard stats for *tenant_id*.

        All five queries execute with an awaited ``db.execute`` call.  Each
        query includes ``tenant_id`` in the WHERE clause to enforce multi-tenant
        data isolation.
        """

        # ------------------------------------------------------------------
        # 1. Total leads
        # ------------------------------------------------------------------
        total_leads_result = await db.execute(
            select(func.count())
            .select_from(Lead)
            .where(Lead.tenant_id == tenant_id)
        )
        total_leads: int = total_leads_result.scalar_one()

        # ------------------------------------------------------------------
        # 2. Total deals
        # ------------------------------------------------------------------
        total_deals_result = await db.execute(
            select(func.count())
            .select_from(Deal)
            .where(Deal.tenant_id == tenant_id)
        )
        total_deals: int = total_deals_result.scalar_one()

        # ------------------------------------------------------------------
        # 3. Open deals — JOIN with deal_statuses WHERE status_type = 'Open'
        # ------------------------------------------------------------------
        open_deals_result = await db.execute(
            select(func.count())
            .select_from(Deal)
            .join(DealStatus, Deal.status_id == DealStatus.id)
            .where(
                Deal.tenant_id == tenant_id,
                DealStatus.tenant_id == tenant_id,
                DealStatus.status_type == "Open",
            )
        )
        open_deals: int = open_deals_result.scalar_one()

        # ------------------------------------------------------------------
        # 4 & 5. Won deals count + Won deals total value (single query)
        # ------------------------------------------------------------------
        won_result = await db.execute(
            select(
                func.count().label("won_count"),
                func.coalesce(func.sum(Deal.deal_value), 0).label("won_value"),
            )
            .select_from(Deal)
            .join(DealStatus, Deal.status_id == DealStatus.id)
            .where(
                Deal.tenant_id == tenant_id,
                DealStatus.tenant_id == tenant_id,
                DealStatus.status_type == "Won",
            )
        )
        won_row = won_result.one()
        won_deals: int = won_row.won_count
        won_value: float = float(won_row.won_value)

        # ------------------------------------------------------------------
        # 6. Total contacts
        # ------------------------------------------------------------------
        total_contacts_result = await db.execute(
            select(func.count())
            .select_from(Contact)
            .where(Contact.tenant_id == tenant_id)
        )
        total_contacts: int = total_contacts_result.scalar_one()

        # ------------------------------------------------------------------
        # 7. Total organizations
        # ------------------------------------------------------------------
        total_orgs_result = await db.execute(
            select(func.count())
            .select_from(Organization)
            .where(Organization.tenant_id == tenant_id)
        )
        total_organizations: int = total_orgs_result.scalar_one()

        # ------------------------------------------------------------------
        # 8. Conversion rate — computed in Python, safe against zero division
        # ------------------------------------------------------------------
        conversion_rate: float = (
            round((won_deals / total_deals) * 100, 2) if total_deals > 0 else 0.0
        )

        logger.info(
            "dashboard_stats_fetched",
            tenant_id=str(tenant_id),
            total_leads=total_leads,
            total_deals=total_deals,
            open_deals=open_deals,
            won_deals=won_deals,
            won_value=won_value,
            total_contacts=total_contacts,
            total_organizations=total_organizations,
            conversion_rate=conversion_rate,
        )

        return DashboardStats(
            total_leads=total_leads,
            total_deals=total_deals,
            open_deals=open_deals,
            won_deals=won_deals,
            won_value=won_value,
            total_contacts=total_contacts,
            total_organizations=total_organizations,
            conversion_rate=conversion_rate,
        )


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers.
# ---------------------------------------------------------------------------

dashboard_service = DashboardService()
