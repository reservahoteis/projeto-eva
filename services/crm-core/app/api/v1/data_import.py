"""FastAPI router for the Data Import resource — /api/v1/import.

Endpoint map:
  POST  /{doctype}              — Upload CSV file (multipart/form-data)
  POST  /{import_id}/start      — Start processing with column mappings
  GET   /{import_id}/status     — Poll current progress

All endpoints require a valid Bearer JWT (get_current_user).

The file upload endpoint accepts a single multipart field named ``file``.
The router reads the bytes and passes them to the service for parsing.
The same bytes must be re-supplied to the /start endpoint because the service
does not persist raw file content (no object storage in this iteration).
For /start, the ``file`` field is required again alongside the JSON body for
column_mappings.
"""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id
from app.models.user import User
from app.schemas.data_import import DataImportMappingRequest, DataImportResponse
from app.services.data_import_service import SUPPORTED_DOCTYPES, data_import_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]


# ---------------------------------------------------------------------------
# POST /{doctype}  — upload CSV and create import record
# ---------------------------------------------------------------------------


MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {"text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"}


@router.post(
    "/{doctype}",
    summary="Upload CSV for import",
    description=(
        "Upload a UTF-8 CSV file to create a new import job with status=pending. "
        f"Supported doctypes: {', '.join(sorted(SUPPORTED_DOCTYPES))}. "
        "Returns the DataImport record with total_rows and import id for use "
        "in subsequent calls."
    ),
    response_model=DataImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_csv(
    doctype: str,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    file: UploadFile = File(..., description="UTF-8 CSV file to import"),
) -> DataImportResponse:
    from app.core.exceptions import BadRequestError

    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise BadRequestError(f"Invalid file type '{file.content_type}'. Only CSV files are accepted.")
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise BadRequestError(f"File too large ({len(content)} bytes). Maximum is {MAX_UPLOAD_SIZE // (1024*1024)} MB.")
    return await data_import_service.create_import(
        db=db,
        tenant_id=tenant_id,
        doctype=doctype,
        file_content_bytes=content,
        file_name=file.filename or "upload.csv",
        created_by_id=current_user.id,
    )


# ---------------------------------------------------------------------------
# POST /{import_id}/start  — begin processing with column mappings
# ---------------------------------------------------------------------------


@router.post(
    "/{import_id}/start",
    summary="Start import processing",
    description=(
        "Submit the column mapping and the original CSV file to begin row-by-row "
        "processing.  ``column_mappings`` is a JSON object supplied as a form field, "
        "and ``file`` is the same CSV uploaded in the previous step. "
        "Processing is synchronous in this implementation — for large files "
        "consider offloading to a background task in a future iteration."
    ),
    response_model=DataImportResponse,
    status_code=status.HTTP_200_OK,
)
async def start_import(
    import_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    column_mappings: str = Form(
        ...,
        description='JSON object mapping CSV column names to model field names, e.g. {"Full Name": "first_name"}',
    ),
    file: UploadFile = File(..., description="The same CSV file supplied during upload"),
) -> DataImportResponse:
    import json as _json

    try:
        mappings_dict: dict[str, str] = _json.loads(column_mappings)
    except _json.JSONDecodeError as exc:
        from app.core.exceptions import BadRequestError

        raise BadRequestError(f"column_mappings must be valid JSON: {exc}") from exc

    if not isinstance(mappings_dict, dict):
        from app.core.exceptions import BadRequestError

        raise BadRequestError("column_mappings must be a JSON object")

    content = await file.read()
    mapping_req = DataImportMappingRequest(column_mappings=mappings_dict)

    return await data_import_service.start_import(
        db=db,
        tenant_id=tenant_id,
        import_id=import_id,
        column_mappings=mapping_req.column_mappings,
        file_content_bytes=content,
    )


# ---------------------------------------------------------------------------
# GET /{import_id}/status  — poll progress
# ---------------------------------------------------------------------------


@router.get(
    "/{import_id}/status",
    summary="Get import status",
    description=(
        "Return the current status, progress counters, and any per-row errors "
        "for the given import job."
    ),
    response_model=DataImportResponse,
    status_code=status.HTTP_200_OK,
)
async def get_import_status(
    import_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> DataImportResponse:
    return await data_import_service.get_import_status(
        db=db,
        tenant_id=tenant_id,
        import_id=import_id,
    )
