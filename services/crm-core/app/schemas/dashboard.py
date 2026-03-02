"""Pydantic v2 schemas for the Dashboard resource.

Schema:
  DashboardStats — aggregated stats returned from GET /api/v1/dashboard/stats

All counts and sums default to zero so the endpoint is safe to call against
a freshly created tenant with no data yet.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class DashboardStats(BaseModel):
    """Aggregated stats for the authenticated user's tenant."""

    model_config = ConfigDict(from_attributes=True)

    total_leads: int = 0
    total_deals: int = 0
    open_deals: int = 0
    won_deals: int = 0
    won_value: float = 0.0
    total_contacts: int = 0
    total_organizations: int = 0
    conversion_rate: float = 0.0
