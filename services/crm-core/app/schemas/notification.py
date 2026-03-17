"""Pydantic v2 schemas for the Notification resource."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserEmbed(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    avatar_url: str | None = None


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    from_user: UserEmbed | None = None
    to_user_id: uuid.UUID
    notification_type: str | None = None
    message: str | None = None
    reference_doctype: str | None = None
    reference_docname: uuid.UUID | None = None
    read: bool
    created_at: datetime
    updated_at: datetime


class NotificationListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    from_user: UserEmbed | None = None
    notification_type: str | None = None
    message: str | None = None
    reference_doctype: str | None = None
    reference_docname: uuid.UUID | None = None
    read: bool
    created_at: datetime


class NotificationListParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    read: bool | None = Field(None, description="Filter by read status")


class NotificationCreate(BaseModel):
    to_user_id: uuid.UUID
    notification_type: str | None = Field(None, max_length=50)
    message: str | None = None
    reference_doctype: str | None = Field(None, max_length=50)
    reference_docname: uuid.UUID | None = None


class MarkReadResponse(BaseModel):
    updated_count: int


class UnreadCountResponse(BaseModel):
    count: int
