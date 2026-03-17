"""Pydantic v2 schemas for the Data Import resource.

Schema hierarchy:
  DataImportCreate          — metadata captured when the CSV is first uploaded
  DataImportResponse        — status / progress of an import job
  DataImportMappingRequest  — column mapping submitted to start processing
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Status literal
# ---------------------------------------------------------------------------

ImportStatus = Literal["pending", "processing", "completed", "failed"]


# ---------------------------------------------------------------------------
# DataImportCreate
# ---------------------------------------------------------------------------


class DataImportCreate(BaseModel):
    """Internal DTO used by the service after uploading and parsing the CSV.

    Callers of the HTTP endpoint do not post this body directly; they upload
    a multipart/form-data file.  The router constructs this object after
    reading the uploaded bytes.
    """

    doctype: str = Field(..., min_length=1, max_length=100)
    file_name: str = Field(..., min_length=1, max_length=255)


# ---------------------------------------------------------------------------
# DataImportResponse
# ---------------------------------------------------------------------------


class DataImportResponse(BaseModel):
    """Full import job record returned from every import endpoint."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    doctype: str
    file_name: str
    status: str
    total_rows: int
    processed_rows: int
    error_rows: int
    errors_json: str | None = None
    created_at: datetime


# ---------------------------------------------------------------------------
# DataImportMappingRequest
# ---------------------------------------------------------------------------


class DataImportMappingRequest(BaseModel):
    """Column mapping submitted to POST /{import_id}/start.

    ``column_mappings`` maps each CSV header name to the corresponding model
    field name, e.g.::

        {
            "Full Name":   "first_name",
            "E-mail":      "email",
            "Company":     "company_name"
        }

    Any CSV column not present in the mapping is silently ignored during
    row processing.
    """

    column_mappings: dict[str, str] = Field(
        ...,
        description="Maps CSV column names to model field names",
        min_length=1,
    )
