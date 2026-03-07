"""Webhook handlers for Meta platforms: WhatsApp, Messenger, Instagram.

Each module exposes a FastAPI router that handles:
  GET  /<platform>  — challenge verification (Meta subscription handshake)
  POST /<platform>  — inbound event processing

Tenant resolution for webhooks bypasses JWT authentication:
  - WhatsApp:  phone_number_id in payload -> tenant.whatsapp_phone_number_id
  - Messenger: entry.id (page_id)         -> tenant.messenger_page_id
  - Instagram: entry.id (ig_account_id)   -> tenant.instagram_page_id
"""
