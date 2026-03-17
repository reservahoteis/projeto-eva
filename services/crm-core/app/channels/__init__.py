"""Channel adapters for multi-channel messaging.

Exposes a unified interface for sending messages across WhatsApp,
Facebook Messenger, and Instagram DM via the Meta Graph API.

Usage:
    from app.channels.router import get_adapter, channel_router

    adapter = get_adapter("WHATSAPP", tenant)
    result = await adapter.send_text(recipient_id="5511999999999", text="Hello")
"""

from app.channels.base import ChannelAdapter
from app.channels.router import ChannelRouter, get_adapter

__all__ = [
    "ChannelAdapter",
    "ChannelRouter",
    "get_adapter",
]
