"""SQLAlchemy model for bulk data import jobs.

A DataImport row represents a single CSV upload + processing lifecycle.
Rows are created when the file is first uploaded (status=pending) and
updated in-place as the background processing progresses.

Design decisions:
  - Inherits TenantBase so every import is scoped to a tenant.
  - errors_json stores a JSON-encoded list of per-row error dicts so the
    caller can see exactly which rows failed and why, without needing a
    separate errors table.
  - column_mappings_json persists the caller-supplied CSV-to-model mapping
    so the processing step can read it back even if the request context is gone.
  - created_by_id is nullable to handle edge-cases where the creating user
    is later deleted (SET NULL on delete).
"""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantBase


class DataImport(TenantBase):
    __tablename__ = "data_imports"

    # What kind of entity this import creates (Lead, Contact, Organization, Deal)
    doctype: Mapped[str] = mapped_column(String(100), nullable=False)

    # Original file name uploaded by the user — purely informational
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Lifecycle state: pending -> processing -> completed | failed
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending | processing | completed | failed

    # Progress counters — updated row-by-row during processing
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    processed_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # JSON-encoded list[dict] of per-row errors:
    #   [{"row": 3, "error": "email already exists"}, ...]
    errors_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSON-encoded dict mapping CSV header -> model field name
    column_mappings_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # User who triggered the import
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    def __repr__(self) -> str:
        return (
            f"<DataImport id={self.id} doctype={self.doctype!r} "
            f"status={self.status!r} tenant_id={self.tenant_id}>"
        )
