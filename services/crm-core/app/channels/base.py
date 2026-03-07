"""Abstract base class for channel send adapters.

Every channel adapter (WhatsApp, Messenger, Instagram) must implement
this interface. Optional methods (send_list, send_template, mark_as_read)
return NotImplementedError by default — the router handles degradation.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Shared payload models
# ---------------------------------------------------------------------------


class SendResult(BaseModel):
    external_message_id: str
    success: bool


class MediaPayload(BaseModel):
    type: str  # image | video | audio | document
    url: str
    caption: str | None = None
    filename: str | None = None


class ButtonPayload(BaseModel):
    id: str
    title: str
    url: str | None = None  # If set, render as web_url instead of postback


class QuickReplyPayload(BaseModel):
    title: str   # max 20 chars
    payload: str  # callback data


class ListRow(BaseModel):
    id: str
    title: str
    description: str | None = None


class ListSection(BaseModel):
    title: str | None = None
    rows: list[ListRow]


class GenericTemplateElement(BaseModel):
    title: str
    subtitle: str | None = None
    image_url: str | None = None
    buttons: list[ButtonPayload] | None = None


# ---------------------------------------------------------------------------
# Abstract adapter
# ---------------------------------------------------------------------------


class ChannelAdapter(ABC):
    """Unified send interface that all channel adapters must satisfy."""

    channel: str  # WHATSAPP | MESSENGER | INSTAGRAM

    @abstractmethod
    async def send_text(self, recipient_id: str, text: str, **kwargs) -> SendResult:
        """Send a plain-text message."""
        ...

    @abstractmethod
    async def send_media(
        self,
        recipient_id: str,
        media_type: str,
        media_url: str,
        caption: str | None = None,
        **kwargs,
    ) -> SendResult:
        """Send an image, video, audio, or document attachment."""
        ...

    @abstractmethod
    async def send_buttons(
        self,
        recipient_id: str,
        body: str,
        buttons: list[ButtonPayload],
        header: str | None = None,
        footer: str | None = None,
        **kwargs,
    ) -> SendResult:
        """Send an interactive button message (max 3 buttons)."""
        ...

    @abstractmethod
    async def send_template(
        self,
        recipient_id: str,
        template_name: str,
        language: str,
        components: list[dict] | None = None,
        **kwargs,
    ) -> SendResult:
        """Send a pre-approved template message."""
        ...

    @abstractmethod
    async def mark_as_read(self, message_id: str, **kwargs) -> bool:
        """Mark an inbound message as read. Returns True on success."""
        ...
