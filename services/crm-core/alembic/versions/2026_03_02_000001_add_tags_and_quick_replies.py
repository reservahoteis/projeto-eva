"""Add tags and quick_replies tables.

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # === TAGS ===
    op.create_table(
        "tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("color", sa.String(7), nullable=False, server_default="#6B7280"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tags_tenant_id", "tags", ["tenant_id"])
    op.create_unique_constraint("uq_tags_tenant_name", "tags", ["tenant_id", "name"])

    # === QUICK REPLIES ===
    op.create_table(
        "quick_replies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("shortcut", sa.String(50), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_quick_replies_tenant_id", "quick_replies", ["tenant_id"])
    op.create_index("ix_quick_replies_created_by_id", "quick_replies", ["created_by_id"])
    op.create_unique_constraint("uq_quick_replies_tenant_shortcut", "quick_replies", ["tenant_id", "shortcut"])


def downgrade() -> None:
    op.drop_table("quick_replies")
    op.drop_table("tags")
