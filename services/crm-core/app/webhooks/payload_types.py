"""Pydantic models for incoming Meta webhook payloads.

These models are deliberately permissive (all non-critical fields are Optional)
because Meta's payload structure varies by message type and platform version.
Validation failures must never cause the endpoint to return non-200 — Meta will
suspend the webhook subscription if it receives repeated error responses.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------


class _PermissiveModel(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)


# ---------------------------------------------------------------------------
# WhatsApp payload types
# ---------------------------------------------------------------------------


class WhatsAppProfile(BaseModel):
    name: str | None = None
    model_config = ConfigDict(extra="allow")


class WhatsAppContact(BaseModel):
    wa_id: str | None = None
    profile: WhatsAppProfile | None = None
    model_config = ConfigDict(extra="allow")


class WhatsAppMediaInfo(BaseModel):
    id: str | None = None
    mime_type: str | None = None
    sha256: str | None = None
    caption: str | None = None
    filename: str | None = None
    model_config = ConfigDict(extra="allow")


class WhatsAppLocation(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    name: str | None = None
    address: str | None = None
    model_config = ConfigDict(extra="allow")


class WhatsAppButtonReply(BaseModel):
    id: str | None = None
    title: str | None = None
    model_config = ConfigDict(extra="allow")


class WhatsAppListReply(BaseModel):
    id: str | None = None
    title: str | None = None
    description: str | None = None
    model_config = ConfigDict(extra="allow")


class WhatsAppInteractive(BaseModel):
    type: str | None = None
    button_reply: WhatsAppButtonReply | None = None
    list_reply: WhatsAppListReply | None = None
    model_config = ConfigDict(extra="allow")


class WhatsAppText(BaseModel):
    body: str | None = None
    model_config = ConfigDict(extra="allow")


class WhatsAppMessage(_PermissiveModel):
    """A single inbound message inside entry.changes[].value.messages[]."""

    id: str
    from_: str = Field(alias="from")
    timestamp: str
    type: str  # text | image | video | audio | document | location | sticker | interactive | button

    # Type-specific payloads — at most one will be populated per message
    text: WhatsAppText | None = None
    image: WhatsAppMediaInfo | None = None
    video: WhatsAppMediaInfo | None = None
    audio: WhatsAppMediaInfo | None = None
    document: WhatsAppMediaInfo | None = None
    sticker: WhatsAppMediaInfo | None = None
    location: WhatsAppLocation | None = None
    interactive: WhatsAppInteractive | None = None
    button: dict[str, Any] | None = None
    errors: list[dict[str, Any]] | None = None


class WhatsAppStatus(_PermissiveModel):
    """A delivery/read status update inside entry.changes[].value.statuses[]."""

    id: str
    recipient_id: str
    status: str  # sent | delivered | read | failed
    timestamp: str
    errors: list[dict[str, Any]] | None = None
    conversation: dict[str, Any] | None = None
    pricing: dict[str, Any] | None = None


class WhatsAppMetadata(BaseModel):
    display_phone_number: str
    phone_number_id: str
    model_config = ConfigDict(extra="allow")


class WhatsAppValue(_PermissiveModel):
    """Content of entry.changes[].value for field='messages'."""

    messaging_product: str | None = None
    metadata: WhatsAppMetadata
    contacts: list[WhatsAppContact] | None = None
    messages: list[WhatsAppMessage] | None = None
    statuses: list[WhatsAppStatus] | None = None
    errors: list[dict[str, Any]] | None = None


class WhatsAppChange(_PermissiveModel):
    field: str  # messages | account_update | etc.
    value: WhatsAppValue


class WhatsAppEntry(_PermissiveModel):
    id: str
    changes: list[WhatsAppChange] = Field(default_factory=list)


class WhatsAppWebhookPayload(_PermissiveModel):
    """Top-level WhatsApp Cloud API webhook body."""

    object: str  # always "whatsapp_business_account"
    entry: list[WhatsAppEntry] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Messenger payload types
# ---------------------------------------------------------------------------


class MessengerSender(_PermissiveModel):
    id: str


class MessengerRecipient(_PermissiveModel):
    id: str


class MessengerAttachment(_PermissiveModel):
    type: str | None = None
    payload: dict[str, Any] | None = None


class MessengerQuickReply(_PermissiveModel):
    content_type: str | None = None
    payload: str | None = None


class MessengerMessage(_PermissiveModel):
    mid: str | None = None
    text: str | None = None
    is_echo: bool | None = None
    attachments: list[MessengerAttachment] | None = None
    quick_reply: MessengerQuickReply | None = None


class MessengerPostback(_PermissiveModel):
    payload: str | None = None
    title: str | None = None


class MessengerDelivery(_PermissiveModel):
    watermark: int | None = None
    mids: list[str] | None = None


class MessengerRead(_PermissiveModel):
    watermark: int | None = None


class MessengerEvent(_PermissiveModel):
    sender: MessengerSender
    recipient: MessengerRecipient
    timestamp: int | None = None
    message: MessengerMessage | None = None
    postback: MessengerPostback | None = None
    delivery: MessengerDelivery | None = None
    read: MessengerRead | None = None


class MessengerEntry(_PermissiveModel):
    id: str  # page_id
    time: int | None = None
    messaging: list[MessengerEvent] = Field(default_factory=list)


class MessengerWebhookPayload(_PermissiveModel):
    """Top-level Messenger webhook body."""

    object: str  # "page"
    entry: list[MessengerEntry] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Instagram payload types (same structure as Messenger)
# ---------------------------------------------------------------------------


class InstagramSender(_PermissiveModel):
    id: str


class InstagramRecipient(_PermissiveModel):
    id: str


class InstagramAttachment(_PermissiveModel):
    type: str | None = None
    payload: dict[str, Any] | None = None


class InstagramQuickReply(_PermissiveModel):
    payload: str | None = None


class InstagramMessage(_PermissiveModel):
    mid: str | None = None
    text: str | None = None
    is_echo: bool | None = None
    attachments: list[InstagramAttachment] | None = None
    quick_reply: InstagramQuickReply | None = None


class InstagramPostback(_PermissiveModel):
    payload: str | None = None
    title: str | None = None


class InstagramDelivery(_PermissiveModel):
    watermark: int | None = None
    mids: list[str] | None = None


class InstagramRead(_PermissiveModel):
    watermark: int | None = None


class InstagramEvent(_PermissiveModel):
    sender: InstagramSender
    recipient: InstagramRecipient
    timestamp: int | None = None
    message: InstagramMessage | None = None
    postback: InstagramPostback | None = None
    delivery: InstagramDelivery | None = None
    read: InstagramRead | None = None


class InstagramEntry(_PermissiveModel):
    id: str  # ig_account_id
    time: int | None = None
    messaging: list[InstagramEvent] = Field(default_factory=list)


class InstagramWebhookPayload(_PermissiveModel):
    """Top-level Instagram webhook body."""

    object: str  # "instagram"
    entry: list[InstagramEntry] = Field(default_factory=list)
