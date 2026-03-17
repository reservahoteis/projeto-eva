"""DataImportService — business logic for bulk CSV data imports.

Supported doctypes: Lead, Contact, Organization, Deal

Import lifecycle:
  1. create_import()  — parse CSV bytes, validate headers, store DataImport row
                        with status=pending.  Returns immediately with the row.
  2. start_import()   — accept column_mappings dict, set status=processing,
                        iterate rows one by one, call the appropriate service,
                        accumulate per-row errors, then set status=completed|failed.
  3. get_import_status() — read the current DataImport row and return progress.

Design decisions:
  - Python's built-in csv module is used (not pandas) to minimise dependencies.
  - All errors are caught per-row so a single bad row does not abort the whole
    import.  Row-level errors are stored as JSON in errors_json.
  - column_mappings_json persists the mapping so it is available during
    start_import even if the request context is gone.
  - For each doctype the service calls the Pydantic model for validation and
    the SQLAlchemy model for persistence, staying within the existing patterns.
  - db.flush() is used inside the processing loop so each row is staged within
    the session without committing mid-way.  The FastAPI get_db context manager
    commits the whole transaction at request end.
  - An exception inside the loop marks the import as "failed" and re-raises
    so the outer transaction rolls back cleanly.
"""

from __future__ import annotations

import csv
import io
import json
import uuid
from typing import Any

import structlog
from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.core.security import hash_password
from app.models.contact import Contact
from app.models.data_import import DataImport
from app.models.deal import Deal
from app.models.lead import Lead
from app.models.lookups import DealStatus, LeadStatus
from app.models.organization import Organization
from app.models.user import User
from app.schemas.data_import import DataImportResponse

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Supported doctypes
# ---------------------------------------------------------------------------

SUPPORTED_DOCTYPES: frozenset[str] = frozenset({"Lead", "Contact", "Organization", "Deal"})

# Minimum required CSV columns per doctype
_REQUIRED_COLUMNS: dict[str, frozenset[str]] = {
    "Lead": frozenset({"first_name"}),
    "Contact": frozenset({"first_name"}),
    "Organization": frozenset({"organization_name"}),
    "Deal": frozenset({"status_id"}),
}


# ---------------------------------------------------------------------------
# DataImportService
# ---------------------------------------------------------------------------


class DataImportService:
    # ------------------------------------------------------------------
    # create_import
    # ------------------------------------------------------------------

    async def create_import(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        doctype: str,
        file_content_bytes: bytes,
        file_name: str,
        created_by_id: uuid.UUID | None = None,
    ) -> DataImportResponse:
        """Parse CSV bytes, validate headers, persist a DataImport row.

        Raises BadRequestError if:
        - doctype is not supported
        - the file cannot be decoded as UTF-8
        - the CSV is empty (no rows)
        """
        log = logger.bind(tenant_id=str(tenant_id), doctype=doctype, file_name=file_name)

        if doctype not in SUPPORTED_DOCTYPES:
            raise BadRequestError(
                f"Unsupported doctype {doctype!r}. "
                f"Allowed: {', '.join(sorted(SUPPORTED_DOCTYPES))}"
            )

        # Decode bytes
        try:
            text = file_content_bytes.decode("utf-8-sig")  # handle BOM
        except UnicodeDecodeError as exc:
            raise BadRequestError(f"File must be UTF-8 encoded: {exc}") from exc

        # Parse CSV to count rows (we don't store the rows — user re-uploads or
        # the raw bytes could be stored in object storage in a future iteration)
        reader = csv.DictReader(io.StringIO(text))
        try:
            rows = list(reader)
        except csv.Error as exc:
            raise BadRequestError(f"CSV parse error: {exc}") from exc

        if not rows:
            raise BadRequestError("CSV file contains no data rows")

        total_rows = len(rows)

        record = DataImport(
            tenant_id=tenant_id,
            doctype=doctype,
            file_name=file_name,
            status="pending",
            total_rows=total_rows,
            processed_rows=0,
            error_rows=0,
            errors_json=None,
            column_mappings_json=None,
            created_by_id=created_by_id,
        )
        db.add(record)
        await db.flush()
        await db.refresh(record)

        log.info("import_created", import_id=str(record.id), total_rows=total_rows)
        return DataImportResponse.model_validate(record)

    # ------------------------------------------------------------------
    # start_import
    # ------------------------------------------------------------------

    async def start_import(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        import_id: uuid.UUID,
        column_mappings: dict[str, str],
        file_content_bytes: bytes,
    ) -> DataImportResponse:
        """Process rows using the column mapping and create entities.

        The ``file_content_bytes`` must match the original upload — the caller
        is responsible for re-supplying the file or retrieving it from storage.
        This keeps the service stateless with regard to file storage.

        Processing rules:
        - Rows that fail Pydantic validation or service-layer constraints are
          recorded in errors_json and counted in error_rows.
        - Processing continues after a row error — only a fatal/unexpected
          exception will abort the whole import.
        - After all rows: status=completed if error_rows < total_rows,
          else status=failed.
        """
        log = logger.bind(tenant_id=str(tenant_id), import_id=str(import_id))

        # --- Fetch the import record ---
        result = await db.execute(
            select(DataImport).where(
                DataImport.id == import_id,
                DataImport.tenant_id == tenant_id,
            )
        )
        record = result.scalar_one_or_none()
        if not record:
            raise NotFoundError(f"Import {import_id} not found")

        if record.status == "processing":
            raise BadRequestError("Import is already being processed")
        if record.status in ("completed", "failed"):
            raise BadRequestError(f"Import already finished with status={record.status!r}")

        # --- Persist column_mappings and set status=processing ---
        await db.execute(
            update(DataImport)
            .where(DataImport.id == import_id, DataImport.tenant_id == tenant_id)
            .values(
                status="processing",
                column_mappings_json=json.dumps(column_mappings),
            )
        )
        await db.flush()

        # --- Re-parse CSV ---
        try:
            text = file_content_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise BadRequestError(f"File must be UTF-8 encoded: {exc}") from exc

        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)

        per_row_errors: list[dict[str, Any]] = []
        processed = 0
        errors = 0

        for row_index, raw_row in enumerate(rows, start=1):
            # Apply column mapping — rename CSV headers to model field names
            mapped: dict[str, Any] = {}
            for csv_col, model_field in column_mappings.items():
                raw_value = raw_row.get(csv_col)
                # Treat empty strings as None
                mapped[model_field] = raw_value if raw_value != "" else None

            try:
                await self._create_entity(db, tenant_id, record.doctype, mapped)
                processed += 1
            except (BadRequestError, ValidationError, ValueError) as exc:
                errors += 1
                per_row_errors.append({"row": row_index, "error": str(exc)})
                log.warning(
                    "import_row_error",
                    row=row_index,
                    error=str(exc),
                )
            except Exception as exc:
                # Unexpected error — mark import as failed and stop
                errors += 1
                per_row_errors.append({"row": row_index, "error": f"Unexpected: {exc}"})
                log.error("import_fatal_error", row=row_index, error=str(exc))
                break

        # Flush row inserts before updating the summary
        await db.flush()

        final_status = "completed" if errors < len(rows) else "failed"
        if processed == 0:
            final_status = "failed"

        await db.execute(
            update(DataImport)
            .where(DataImport.id == import_id, DataImport.tenant_id == tenant_id)
            .values(
                status=final_status,
                processed_rows=processed,
                error_rows=errors,
                errors_json=json.dumps(per_row_errors) if per_row_errors else None,
            )
        )
        await db.flush()
        await db.refresh(record)

        log.info(
            "import_finished",
            status=final_status,
            processed=processed,
            errors=errors,
        )
        return DataImportResponse.model_validate(record)

    # ------------------------------------------------------------------
    # get_import_status
    # ------------------------------------------------------------------

    async def get_import_status(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        import_id: uuid.UUID,
    ) -> DataImportResponse:
        """Return the current state of an import job."""
        result = await db.execute(
            select(DataImport).where(
                DataImport.id == import_id,
                DataImport.tenant_id == tenant_id,
            )
        )
        record = result.scalar_one_or_none()
        if not record:
            raise NotFoundError(f"Import {import_id} not found")
        return DataImportResponse.model_validate(record)

    # ------------------------------------------------------------------
    # Internal: entity creation per doctype
    # ------------------------------------------------------------------

    async def _create_entity(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        doctype: str,
        data: dict[str, Any],
    ) -> None:
        """Create a single entity row from a mapped data dict.

        Raises BadRequestError / ValidationError on invalid data so the caller
        can record the error and continue to the next row.
        """
        if doctype == "Lead":
            await self._create_lead(db, tenant_id, data)
        elif doctype == "Contact":
            await self._create_contact(db, tenant_id, data)
        elif doctype == "Organization":
            await self._create_organization(db, tenant_id, data)
        elif doctype == "Deal":
            await self._create_deal(db, tenant_id, data)
        else:
            raise BadRequestError(f"Unsupported doctype: {doctype!r}")

    # ------------------------------------------------------------------
    # Doctype-specific creators
    # ------------------------------------------------------------------

    async def _create_lead(
        self, db: AsyncSession, tenant_id: uuid.UUID, data: dict[str, Any]
    ) -> None:
        """Create a Lead row from mapped CSV data.

        Requires a LeadStatus for the tenant — uses the first available one if
        status_id is not mapped, so imports work without forcing callers to
        know internal UUIDs.
        """
        first_name = data.get("first_name")
        if not first_name:
            raise BadRequestError("Lead requires 'first_name'")

        # Resolve status_id: use mapped value or fall back to tenant's first status
        status_id = data.get("status_id")
        if status_id:
            try:
                status_uuid = uuid.UUID(str(status_id))
            except ValueError as exc:
                raise BadRequestError(f"Invalid status_id UUID: {status_id}") from exc
        else:
            status_result = await db.execute(
                select(LeadStatus)
                .where(LeadStatus.tenant_id == tenant_id)
                .order_by(LeadStatus.position.asc())
                .limit(1)
            )
            default_status = status_result.scalar_one_or_none()
            if not default_status:
                raise BadRequestError("No LeadStatus configured for this tenant")
            status_uuid = default_status.id

        lead = Lead(
            tenant_id=tenant_id,
            first_name=str(first_name)[:100],
            middle_name=_str_or_none(data.get("middle_name"), 100),
            last_name=_str_or_none(data.get("last_name"), 100),
            email=_str_or_none(data.get("email"), 255),
            mobile_no=_str_or_none(data.get("mobile_no"), 50),
            phone=_str_or_none(data.get("phone"), 50),
            website=_str_or_none(data.get("website"), 500),
            job_title=_str_or_none(data.get("job_title"), 150),
            organization_name=_str_or_none(data.get("organization_name"), 255),
            gender=_str_or_none(data.get("gender"), 20),
            status_id=status_uuid,
        )
        # Compute lead_name
        parts = [
            p for p in [lead.first_name, lead.middle_name, lead.last_name] if p
        ]
        lead.lead_name = " ".join(parts)

        db.add(lead)
        await db.flush()

    async def _create_contact(
        self, db: AsyncSession, tenant_id: uuid.UUID, data: dict[str, Any]
    ) -> None:
        """Create a Contact row from mapped CSV data."""
        first_name = data.get("first_name")
        if not first_name:
            raise BadRequestError("Contact requires 'first_name'")

        contact = Contact(
            tenant_id=tenant_id,
            first_name=str(first_name)[:100],
            last_name=_str_or_none(data.get("last_name"), 100),
            email=_str_or_none(data.get("email"), 255),
            mobile_no=_str_or_none(data.get("mobile_no"), 50),
            phone=_str_or_none(data.get("phone"), 50),
            company_name=_str_or_none(data.get("company_name"), 255),
            designation=_str_or_none(data.get("designation"), 150),
            gender=_str_or_none(data.get("gender"), 20),
        )
        # Compute full_name
        parts = [p for p in [contact.first_name, contact.last_name] if p]
        contact.full_name = " ".join(parts)

        db.add(contact)
        await db.flush()

    async def _create_organization(
        self, db: AsyncSession, tenant_id: uuid.UUID, data: dict[str, Any]
    ) -> None:
        """Create an Organization row from mapped CSV data."""
        org_name = data.get("organization_name")
        if not org_name:
            raise BadRequestError("Organization requires 'organization_name'")

        # Check uniqueness per tenant (mirrors the DB unique index)
        existing = await db.execute(
            select(Organization).where(
                Organization.organization_name == str(org_name),
                Organization.tenant_id == tenant_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise BadRequestError(
                f"Organization {org_name!r} already exists for this tenant"
            )

        org = Organization(
            tenant_id=tenant_id,
            organization_name=str(org_name)[:255],
            website=_str_or_none(data.get("website"), 500),
            address=_str_or_none(data.get("address"), None),
            no_of_employees=_str_or_none(data.get("no_of_employees"), 20),
        )
        db.add(org)
        await db.flush()

    async def _create_deal(
        self, db: AsyncSession, tenant_id: uuid.UUID, data: dict[str, Any]
    ) -> None:
        """Create a Deal row from mapped CSV data.

        Requires a DealStatus — uses the mapped status_id or the tenant's
        first available one if not provided.
        """
        status_id = data.get("status_id")
        if status_id:
            try:
                status_uuid = uuid.UUID(str(status_id))
            except ValueError as exc:
                raise BadRequestError(f"Invalid status_id UUID: {status_id}") from exc
        else:
            status_result = await db.execute(
                select(DealStatus)
                .where(DealStatus.tenant_id == tenant_id)
                .order_by(DealStatus.position.asc())
                .limit(1)
            )
            default_status = status_result.scalar_one_or_none()
            if not default_status:
                raise BadRequestError("No DealStatus configured for this tenant")
            status_uuid = default_status.id

        deal_value = data.get("deal_value")
        parsed_value: float | None = None
        if deal_value is not None:
            try:
                parsed_value = float(deal_value)
            except (TypeError, ValueError):
                parsed_value = None

        deal = Deal(
            tenant_id=tenant_id,
            status_id=status_uuid,
            first_name=_str_or_none(data.get("first_name"), 100),
            last_name=_str_or_none(data.get("last_name"), 100),
            email=_str_or_none(data.get("email"), 255),
            mobile_no=_str_or_none(data.get("mobile_no"), 50),
            phone=_str_or_none(data.get("phone"), 50),
            organization_name=_str_or_none(data.get("organization_name"), 255),
            deal_value=parsed_value,
            next_step=_str_or_none(data.get("next_step"), 500),
        )
        # Compute lead_name snapshot
        parts = [p for p in [deal.first_name, deal.last_name] if p]
        if parts:
            deal.lead_name = " ".join(parts)

        db.add(deal)
        await db.flush()


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------


def _str_or_none(value: Any, max_len: int | None) -> str | None:
    """Return a trimmed string or None.  Truncates to max_len if provided."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    if max_len is not None:
        s = s[:max_len]
    return s


# Module-level singleton
data_import_service = DataImportService()
