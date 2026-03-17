"""Pydantic v2 schemas for CRM Settings endpoints."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Status configuration
# ---------------------------------------------------------------------------

class StatusItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    label: str
    color: str
    status_type: str | None = None
    position: int
    probability: float | None = None  # Deal only


class StatusCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    color: str = Field("#gray", max_length=30)
    status_type: str | None = Field(None, max_length=20)
    position: int = 0
    probability: float | None = None


class StatusUpdate(BaseModel):
    label: str | None = Field(None, max_length=100)
    color: str | None = Field(None, max_length=30)
    status_type: str | None = Field(None, max_length=20)
    position: int | None = None
    probability: float | None = None


class StatusReorderRequest(BaseModel):
    ordered_ids: list[uuid.UUID] = Field(
        ..., min_length=1, description="List of status IDs in desired order"
    )


# ---------------------------------------------------------------------------
# Lookup items (LeadSource, Industry, Territory, LostReason)
# ---------------------------------------------------------------------------

class LookupItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class TerritoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None = None


class LookupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class TerritoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    parent_id: uuid.UUID | None = None


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

class ProductItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str | None = None
    rate: float | None = None
    description: str | None = None


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: str | None = Field(None, max_length=100)
    rate: float | None = Field(None, ge=0)
    description: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    code: str | None = Field(None, max_length=100)
    rate: float | None = Field(None, ge=0)
    description: str | None = None
