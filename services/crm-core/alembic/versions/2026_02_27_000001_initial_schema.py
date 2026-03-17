"""Initial CRM schema — all core tables.

Revision ID: 0001
Revises: (none)
Create Date: 2026-02-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # === TENANTS ===
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("plan", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("whatsapp_phone_number_id", sa.String(100), nullable=True),
        sa.Column("whatsapp_access_token", sa.Text, nullable=True),
        sa.Column("whatsapp_verify_token", sa.String(255), nullable=True),
        sa.Column("whatsapp_webhook_secret", sa.String(255), nullable=True),
        sa.Column("instagram_page_id", sa.String(100), nullable=True),
        sa.Column("instagram_access_token", sa.Text, nullable=True),
        sa.Column("messenger_page_id", sa.String(100), nullable=True),
        sa.Column("messenger_access_token", sa.Text, nullable=True),
        sa.Column("stripe_customer_id", sa.String(100), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(100), nullable=True),
        sa.Column("currency", sa.String(10), server_default="BRL"),
        sa.Column("timezone", sa.String(50), server_default="America/Sao_Paulo"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # === USERS ===
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(30), nullable=False, server_default="ATTENDANT"),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_tenant_id_email", "users", ["tenant_id", "email"], unique=True)
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"])

    # === LOOKUP TABLES ===
    for table_name, extra_cols in [
        ("lead_statuses", [
            sa.Column("label", sa.String(100), nullable=False),
            sa.Column("color", sa.String(30), nullable=False, server_default="#gray"),
            sa.Column("status_type", sa.String(20), nullable=True),
            sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        ]),
        ("deal_statuses", [
            sa.Column("label", sa.String(100), nullable=False),
            sa.Column("color", sa.String(30), nullable=False, server_default="#gray"),
            sa.Column("status_type", sa.String(20), nullable=True),
            sa.Column("position", sa.Integer, nullable=False, server_default="0"),
            sa.Column("probability", sa.Float, nullable=True),
        ]),
        ("lead_sources", [
            sa.Column("name", sa.String(150), nullable=False),
        ]),
        ("industries", [
            sa.Column("name", sa.String(150), nullable=False),
        ]),
        ("lost_reasons", [
            sa.Column("name", sa.String(255), nullable=False),
        ]),
    ]:
        cols = [
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
            *extra_cols,
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        ]
        op.create_table(table_name, *cols)

    # Territories (self-referential)
    op.create_table(
        "territories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("territories.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Products
    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(100), nullable=True),
        sa.Column("rate", sa.Numeric(18, 2), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # === ORGANIZATIONS ===
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("organization_name", sa.String(255), nullable=False),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("no_of_employees", sa.String(20), nullable=True),
        sa.Column("annual_revenue", sa.Numeric(18, 2), nullable=True),
        sa.Column("industry_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("industries.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("territory_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("territories.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_organizations_tenant_id_name", "organizations", ["tenant_id", "organization_name"], unique=True)

    # === CONTACTS ===
    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("salutation", sa.String(20), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("gender", sa.String(20), nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("mobile_no", sa.String(50), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("designation", sa.String(150), nullable=True),
        sa.Column("industry_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("industries.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("territory_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("territories.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_contacts_tenant_id_email", "contacts", ["tenant_id", "email"])

    # === LEADS ===
    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("naming_series", sa.String(50), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("salutation", sa.String(20), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("middle_name", sa.String(100), nullable=True),
        sa.Column("last_name", sa.String(100), nullable=True),
        sa.Column("lead_name", sa.String(255), nullable=True),
        sa.Column("gender", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("mobile_no", sa.String(50), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("job_title", sa.String(150), nullable=True),
        sa.Column("organization_name", sa.String(255), nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("status_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lead_statuses.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lead_sources.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("industry_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("industries.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("territory_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("territories.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("lead_owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("no_of_employees", sa.String(20), nullable=True),
        sa.Column("annual_revenue", sa.Numeric(18, 2), nullable=True),
        sa.Column("currency", sa.String(10), server_default="BRL"),
        sa.Column("converted", sa.Boolean, server_default="false", nullable=False),
        sa.Column("sla_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("sla_status", sa.String(20), nullable=True),
        sa.Column("sla_creation", sa.DateTime(timezone=True), nullable=True),
        sa.Column("response_by", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_response_time", sa.Interval, nullable=True),
        sa.Column("first_responded_on", sa.DateTime(timezone=True), nullable=True),
        sa.Column("communication_status", sa.String(50), nullable=True),
        sa.Column("facebook_lead_id", sa.String(255), nullable=True, unique=True),
        sa.Column("facebook_form_id", sa.String(255), nullable=True),
        sa.Column("lost_reason_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lost_reasons.id", ondelete="SET NULL"), nullable=True),
        sa.Column("lost_notes", sa.Text, nullable=True),
        sa.Column("total", sa.Numeric(18, 2), nullable=True),
        sa.Column("net_total", sa.Numeric(18, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_leads_tenant_id_status_id", "leads", ["tenant_id", "status_id"])
    op.create_index("ix_leads_tenant_id_email", "leads", ["tenant_id", "email"])
    op.create_index("ix_leads_tenant_id_converted", "leads", ["tenant_id", "converted"])

    # === DEALS ===
    op.create_table(
        "deals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("naming_series", sa.String(50), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("status_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deal_statuses.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("deal_owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("probability", sa.Float, nullable=True),
        sa.Column("deal_value", sa.Numeric(18, 2), nullable=True),
        sa.Column("currency", sa.String(10), server_default="BRL"),
        sa.Column("exchange_rate", sa.Float, nullable=True),
        sa.Column("expected_deal_value", sa.Numeric(18, 2), nullable=True),
        sa.Column("expected_closure_date", sa.Date, nullable=True),
        sa.Column("closed_date", sa.Date, nullable=True),
        sa.Column("next_step", sa.String(255), nullable=True),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lead_sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("territory_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("territories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("industry_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("industries.id", ondelete="SET NULL"), nullable=True),
        # Contact snapshot
        sa.Column("salutation", sa.String(20), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=True),
        sa.Column("last_name", sa.String(100), nullable=True),
        sa.Column("lead_name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("mobile_no", sa.String(50), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("job_title", sa.String(150), nullable=True),
        sa.Column("gender", sa.String(20), nullable=True),
        sa.Column("no_of_employees", sa.String(20), nullable=True),
        sa.Column("annual_revenue", sa.Numeric(18, 2), nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("organization_name", sa.String(255), nullable=True),
        # SLA
        sa.Column("sla_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("sla_status", sa.String(20), nullable=True),
        sa.Column("sla_creation", sa.DateTime(timezone=True), nullable=True),
        sa.Column("response_by", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_response_time", sa.Interval, nullable=True),
        sa.Column("first_responded_on", sa.DateTime(timezone=True), nullable=True),
        sa.Column("communication_status", sa.String(50), nullable=True),
        # Lost
        sa.Column("lost_reason_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lost_reasons.id", ondelete="SET NULL"), nullable=True),
        sa.Column("lost_notes", sa.Text, nullable=True),
        # Totals
        sa.Column("total", sa.Numeric(18, 2), nullable=True),
        sa.Column("net_total", sa.Numeric(18, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_deals_tenant_id_status_id", "deals", ["tenant_id", "status_id"])

    # === TASKS ===
    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="Low"),
        sa.Column("status", sa.String(30), nullable=False, server_default="Backlog"),
        sa.Column("assigned_to_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("reference_doctype", sa.String(50), nullable=True),
        sa.Column("reference_docname", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tasks_tenant_id_assigned_to_id", "tasks", ["tenant_id", "assigned_to_id"])
    op.create_index("ix_tasks_tenant_id_status", "tasks", ["tenant_id", "status"])

    # === NOTES ===
    op.create_table(
        "notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("reference_doctype", sa.String(50), nullable=True),
        sa.Column("reference_docname", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notes_tenant_id_reference", "notes", ["tenant_id", "reference_doctype", "reference_docname"])

    # === CALL LOGS ===
    op.create_table(
        "call_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("caller", sa.String(100), nullable=False),
        sa.Column("receiver", sa.String(100), nullable=False),
        sa.Column("type", sa.String(20), nullable=True),
        sa.Column("status", sa.String(30), nullable=True),
        sa.Column("duration", sa.Integer, nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recording_url", sa.String(500), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("telephony_medium", sa.String(30), nullable=False, server_default="Manual"),
        sa.Column("reference_doctype", sa.String(50), nullable=True),
        sa.Column("reference_docname", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_call_logs_tenant_id_caller", "call_logs", ["tenant_id", "caller"])
    op.create_index("ix_call_logs_tenant_id_reference", "call_logs", ["tenant_id", "reference_doctype", "reference_docname"])

    # === SLA ===
    op.create_table(
        "service_level_agreements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("enabled", sa.Boolean, server_default="true", nullable=False),
        sa.Column("applies_to", sa.String(20), nullable=False),
        sa.Column("condition", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "service_level_priorities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sla_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_level_agreements.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("priority", sa.String(20), nullable=False),
        sa.Column("response_time", sa.Interval, nullable=True),
        sa.Column("resolution_time", sa.Interval, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "service_days",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sla_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_level_agreements.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("day", sa.String(15), nullable=False),
        sa.Column("start_time", sa.Time, nullable=True),
        sa.Column("end_time", sa.Time, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # === COMMUNICATIONS ===
    op.create_table(
        "communications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("communication_type", sa.String(20), nullable=True),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("sender", sa.String(255), nullable=True),
        sa.Column("recipients", sa.Text, nullable=True),
        sa.Column("reference_doctype", sa.String(50), nullable=True),
        sa.Column("reference_docname", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # === COMMENTS ===
    op.create_table(
        "comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("reference_doctype", sa.String(50), nullable=True),
        sa.Column("reference_docname", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_comments_tenant_reference", "comments", ["tenant_id", "reference_doctype", "reference_docname"])

    # === NOTIFICATIONS ===
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("from_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("to_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("notification_type", sa.String(50), nullable=True),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("reference_doctype", sa.String(50), nullable=True),
        sa.Column("reference_docname", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("read", sa.Boolean, server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notifications_tenant_to_user_read", "notifications", ["tenant_id", "to_user_id", "read"])

    # === VIEW SETTINGS ===
    op.create_table(
        "view_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("doctype", sa.String(50), nullable=False),
        sa.Column("view_type", sa.String(20), nullable=False, server_default="list"),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("columns_json", sa.Text, nullable=True),
        sa.Column("rows_json", sa.Text, nullable=True),
        sa.Column("filters_json", sa.Text, nullable=True),
        sa.Column("order_by", sa.String(255), nullable=True),
        sa.Column("is_default", sa.Boolean, server_default="false", nullable=False),
        sa.Column("is_public", sa.Boolean, server_default="false", nullable=False),
        sa.Column("is_standard", sa.Boolean, server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_view_settings_tenant_doctype_user", "view_settings", ["tenant_id", "doctype", "user_id"])
    op.create_index("ix_view_settings_tenant_doctype_public", "view_settings", ["tenant_id", "doctype", "is_public", "is_default"])

    # === ASSIGNMENTS ===
    op.create_table(
        "assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("doctype", sa.String(50), nullable=False),
        sa.Column("docname", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_to_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("assigned_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="Open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_assignments_tenant_doctype_docname", "assignments", ["tenant_id", "doctype", "docname"])

    # === ASSIGNMENT RULES ===
    op.create_table(
        "assignment_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("doctype", sa.String(50), nullable=False),
        sa.Column("assign_condition", sa.Text, nullable=True),
        sa.Column("assignment_type", sa.String(30), nullable=False, server_default="round_robin"),
        sa.Column("users_json", sa.Text, nullable=True),
        sa.Column("enabled", sa.Boolean, server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # === STATUS CHANGE LOG ===
    op.create_table(
        "status_change_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_status", sa.String(100), nullable=True),
        sa.Column("to_status", sa.String(100), nullable=False),
        sa.Column("changed_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("duration", sa.Interval, nullable=True),
    )
    op.create_index("ix_status_change_logs_entity", "status_change_logs", ["entity_type", "entity_id"])

    # === DATA IMPORTS ===
    op.create_table(
        "data_imports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("doctype", sa.String(50), nullable=False),
        sa.Column("file_name", sa.String(500), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("total_rows", sa.Integer, server_default="0"),
        sa.Column("processed_rows", sa.Integer, server_default="0"),
        sa.Column("error_rows", sa.Integer, server_default="0"),
        sa.Column("errors_json", sa.Text, nullable=True),
        sa.Column("column_mappings_json", sa.Text, nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # === PIVOT TABLES ===
    op.create_table(
        "deal_contacts",
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("is_primary", sa.Boolean, server_default="false", nullable=False),
    )

    op.create_table(
        "lead_products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("qty", sa.Numeric(18, 4), server_default="1"),
        sa.Column("rate", sa.Numeric(18, 2), nullable=True),
        sa.Column("discount_percent", sa.Float, nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=True),
    )

    op.create_table(
        "deal_products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("qty", sa.Numeric(18, 4), server_default="1"),
        sa.Column("rate", sa.Numeric(18, 2), nullable=True),
        sa.Column("discount_percent", sa.Float, nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("deal_products")
    op.drop_table("lead_products")
    op.drop_table("deal_contacts")
    op.drop_table("data_imports")
    op.drop_table("status_change_logs")
    op.drop_table("assignment_rules")
    op.drop_table("assignments")
    op.drop_table("view_settings")
    op.drop_table("notifications")
    op.drop_table("comments")
    op.drop_table("communications")
    op.drop_table("service_days")
    op.drop_table("service_level_priorities")
    op.drop_table("service_level_agreements")
    op.drop_table("call_logs")
    op.drop_table("notes")
    op.drop_table("tasks")
    op.drop_table("deals")
    op.drop_table("leads")
    op.drop_table("contacts")
    op.drop_table("organizations")
    op.drop_table("products")
    op.drop_table("territories")
    op.drop_table("lost_reasons")
    op.drop_table("industries")
    op.drop_table("lead_sources")
    op.drop_table("deal_statuses")
    op.drop_table("lead_statuses")
    op.drop_table("users")
    op.drop_table("tenants")
