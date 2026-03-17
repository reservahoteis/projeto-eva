"""Pydantic v2 schemas for the ViewSettings resource."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserEmbed(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class ViewSettingsCreate(BaseModel):
    doctype: str = Field(..., max_length=50)
    view_type: str = Field("list", max_length=20, description="list | kanban | group_by")
    label: str | None = Field(None, max_length=255)
    columns_json: str | None = None
    rows_json: str | None = None
    filters_json: str | None = None
    order_by: str | None = Field(None, max_length=255)
    is_default: bool = False
    is_public: bool = False


class ViewSettingsUpdate(BaseModel):
    label: str | None = Field(None, max_length=255)
    view_type: str | None = Field(None, max_length=20)
    columns_json: str | None = None
    rows_json: str | None = None
    filters_json: str | None = None
    order_by: str | None = Field(None, max_length=255)
    is_default: bool | None = None
    is_public: bool | None = None


class ViewSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID | None = None
    doctype: str
    view_type: str
    label: str | None = None
    columns_json: str | None = None
    rows_json: str | None = None
    filters_json: str | None = None
    order_by: str | None = None
    is_default: bool
    is_public: bool
    is_standard: bool
    user: UserEmbed | None = None
    created_at: datetime
    updated_at: datetime
