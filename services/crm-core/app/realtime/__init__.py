"""Realtime layer — python-socketio WebSocket server for the CRM Core service.

Public surface:
  - sio          : AsyncServer instance (register extra event handlers if needed)
  - socket_app   : ASGI application to mount on FastAPI
  - emit_*       : Emission helpers for services to broadcast events
"""

from app.realtime.socket_manager import sio, socket_app
from app.realtime.emitter import (
    emit_new_message,
    emit_message_status,
    emit_conversation_updated,
    emit_new_conversation,
    emit_conversation_typing,
    emit_notification,
    emit_contact_event,
)

__all__ = [
    "sio",
    "socket_app",
    "emit_new_message",
    "emit_message_status",
    "emit_conversation_updated",
    "emit_new_conversation",
    "emit_conversation_typing",
    "emit_notification",
    "emit_contact_event",
]
