"""Channel router — factory and unified dispatch layer.

get_adapter(channel, tenant) resolves the correct adapter for a given
channel string and Tenant ORM instance, handling token decryption,
env-var fallback, and raising BadRequestError for missing config.

channel_router is a convenience singleton that exposes high-level send
methods with automatic channel-appropriate degradation:

  - send_quick_replies:
      Messenger/Instagram -> native Quick Replies
      WhatsApp            -> interactive buttons (max 3), then numbered text
      others              -> numbered text

  - send_list:
      WhatsApp            -> native interactive list
      Messenger/Instagram -> Quick Replies (<=13 rows), then numbered text
      others              -> numbered text

  - send_template:
      WhatsApp            -> native template
      Messenger/Instagram -> plain text representation

  - mark_as_read:
      WhatsApp            -> marks read via API
      Messenger/Instagram -> silently ignored (no-op)

Token decryption:
  The Express backend stores access tokens encrypted (AES via the
  encrypt/decrypt utils).  In crm-core, the Tenant model fields
  (whatsapp_access_token, messenger_access_token, instagram_access_token)
  hold the **encrypted** value.  decrypt_token() mirrors the JS decrypt()
  utility using the ENCRYPTION_KEY env var.  If decryption fails, the
  plaintext value is used as-is (dev / single-tenant convenience).
"""

from __future__ import annotations

import base64
import os

import structlog

from app.channels.base import (
    ButtonPayload,
    ChannelAdapter,
    GenericTemplateElement,
    ListSection,
    QuickReplyPayload,
    SendResult,
)
from app.channels.instagram import InstagramAdapter
from app.channels.messenger import MessengerAdapter
from app.channels.whatsapp import WhatsAppAdapter
from app.core.exceptions import BadRequestError
from app.models.tenant import Tenant

logger = structlog.get_logger()

_SUPPORTED_CHANNELS = {"WHATSAPP", "MESSENGER", "INSTAGRAM"}


# ---------------------------------------------------------------------------
# Token decryption
# ---------------------------------------------------------------------------

def _decrypt_token(encrypted: str) -> str:
    """Decrypt an AES-256-CBC token stored by the Express backend.

    The Express encrypt() util uses Node's crypto module with:
      - Algorithm: aes-256-cbc
      - Key: sha256(ENCRYPTION_KEY) as 32-byte buffer
      - IV: first 16 bytes of the ciphertext (prepended before base64)
      - Ciphertext: base64(iv + encrypted_bytes)

    If ENCRYPTION_KEY is not set or decryption fails, returns the raw value
    (useful in dev when tokens are stored as plaintext).
    """
    encryption_key = os.getenv("ENCRYPTION_KEY", "")
    if not encryption_key:
        return encrypted

    try:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.backends import default_backend

        import hashlib
        key = hashlib.sha256(encryption_key.encode()).digest()  # 32 bytes

        raw = base64.b64decode(encrypted)
        iv = raw[:16]
        ciphertext = raw[16:]

        cipher = Cipher(
            algorithms.AES(key),
            modes.CBC(iv),
            backend=default_backend(),
        )
        decryptor = cipher.decryptor()
        padded = decryptor.update(ciphertext) + decryptor.finalize()

        # Remove PKCS7 padding
        pad_len = padded[-1]
        return padded[:-pad_len].decode("utf-8")
    except Exception as exc:
        logger.warning(
            "Token decryption failed — using raw value (expected in dev)",
            error=str(exc),
        )
        return encrypted


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_adapter(channel: str, tenant: Tenant) -> ChannelAdapter:
    """Return a ready-to-use ChannelAdapter for the given channel and tenant.

    Raises:
        BadRequestError: if the channel is unsupported or the tenant has no
                         credentials configured for the requested channel.
    """
    channel_upper = channel.upper()
    if channel_upper not in _SUPPORTED_CHANNELS:
        raise BadRequestError(
            f"Canal nao suportado: {channel!r}. "
            f"Canais validos: {sorted(_SUPPORTED_CHANNELS)}"
        )

    if channel_upper == "WHATSAPP":
        phone_id = tenant.whatsapp_phone_number_id
        raw_token = tenant.whatsapp_access_token
        env_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")

        if phone_id and raw_token:
            access_token = _decrypt_token(raw_token)
        elif env_token:
            access_token = env_token
            phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
            logger.info(
                "WhatsApp: using WHATSAPP_ACCESS_TOKEN env var (fallback)",
                tenant_id=str(tenant.id),
            )
        else:
            raise BadRequestError(
                "Tenant nao tem WhatsApp configurado (sem token no DB nem env var)"
            )

        if not phone_id:
            raise BadRequestError(
                "Tenant nao tem WHATSAPP_PHONE_NUMBER_ID configurado"
            )

        return WhatsAppAdapter(
            phone_number_id=phone_id,
            access_token=access_token,
            tenant_id=str(tenant.id),
        )

    if channel_upper == "MESSENGER":
        raw_token = tenant.messenger_access_token
        env_token = os.getenv("MESSENGER_PAGE_ACCESS_TOKEN", "")

        if raw_token:
            access_token = _decrypt_token(raw_token)
        elif env_token:
            access_token = env_token
            logger.info(
                "Messenger: using MESSENGER_PAGE_ACCESS_TOKEN env var (fallback)",
                tenant_id=str(tenant.id),
            )
        else:
            raise BadRequestError(
                "Tenant nao tem Messenger configurado (sem token no DB nem env var)"
            )

        return MessengerAdapter(
            access_token=access_token,
            tenant_id=str(tenant.id),
        )

    # INSTAGRAM
    raw_token = tenant.instagram_access_token
    env_token = os.getenv("INSTAGRAM_ACCESS_TOKEN", "")

    if raw_token:
        access_token = _decrypt_token(raw_token)
    elif env_token:
        access_token = env_token
        logger.info(
            "Instagram: using INSTAGRAM_ACCESS_TOKEN env var (fallback)",
            tenant_id=str(tenant.id),
        )
    else:
        raise BadRequestError(
            "Tenant nao tem Instagram configurado (sem token no DB nem env var)"
        )

    return InstagramAdapter(
        access_token=access_token,
        tenant_id=str(tenant.id),
    )


# ---------------------------------------------------------------------------
# High-level router with degradation
# ---------------------------------------------------------------------------

class ChannelRouter:
    """Unified send interface with per-channel degradation logic."""

    async def send_text(
        self,
        channel: str,
        tenant: Tenant,
        recipient_id: str,
        text: str,
    ) -> SendResult:
        adapter = get_adapter(channel, tenant)
        return await adapter.send_text(recipient_id, text)

    async def send_media(
        self,
        channel: str,
        tenant: Tenant,
        recipient_id: str,
        media_type: str,
        media_url: str,
        caption: str | None = None,
    ) -> SendResult:
        adapter = get_adapter(channel, tenant)
        return await adapter.send_media(recipient_id, media_type, media_url, caption)

    async def send_buttons(
        self,
        channel: str,
        tenant: Tenant,
        recipient_id: str,
        body: str,
        buttons: list[ButtonPayload],
        header: str | None = None,
        footer: str | None = None,
    ) -> SendResult:
        adapter = get_adapter(channel, tenant)
        return await adapter.send_buttons(recipient_id, body, buttons, header, footer)

    async def send_quick_replies(
        self,
        channel: str,
        tenant: Tenant,
        recipient_id: str,
        text: str,
        quick_replies: list[QuickReplyPayload],
    ) -> SendResult:
        """Send quick replies with automatic degradation.

        Messenger/Instagram: native Quick Replies
        WhatsApp: interactive buttons (max 3), then numbered text
        """
        channel_upper = channel.upper()
        adapter = get_adapter(channel, tenant)

        # Messenger and Instagram support Quick Replies natively
        if channel_upper in {"MESSENGER", "INSTAGRAM"}:
            if hasattr(adapter, "send_quick_replies"):
                try:
                    return await adapter.send_quick_replies(  # type: ignore[attr-defined]
                        recipient_id, text, quick_replies
                    )
                except Exception as exc:
                    logger.warning(
                        "Quick Replies failed — falling back",
                        channel=channel_upper,
                        tenant_id=str(tenant.id),
                        error=str(exc),
                    )

        # WhatsApp: degrade to interactive buttons (max 3)
        if channel_upper == "WHATSAPP":
            btn_slice = quick_replies[:3]
            buttons = [
                ButtonPayload(id=qr.payload, title=qr.title[:20])
                for qr in btn_slice
            ]
            logger.info(
                "Quick Replies degraded to buttons for WhatsApp",
                original_count=len(quick_replies),
                degraded_count=len(buttons),
                tenant_id=str(tenant.id),
            )
            return await adapter.send_buttons(recipient_id, text, buttons)

        # Generic fallback: numbered text
        numbered = "\n".join(
            f"{i + 1}. {qr.title}" for i, qr in enumerate(quick_replies)
        )
        full_text = f"{text}\n\n{numbered}"
        logger.info(
            "Quick Replies degraded to numbered text",
            channel=channel_upper,
            tenant_id=str(tenant.id),
        )
        return await adapter.send_text(recipient_id, full_text)

    async def send_list(
        self,
        channel: str,
        tenant: Tenant,
        recipient_id: str,
        body: str,
        button_text: str,
        sections: list[ListSection],
        header: str | None = None,
        footer: str | None = None,
    ) -> SendResult:
        """Send an interactive list with automatic degradation.

        WhatsApp: native interactive list
        Messenger/Instagram: Quick Replies (<=13 rows), then numbered text
        Others: numbered text
        """
        channel_upper = channel.upper()
        adapter = get_adapter(channel, tenant)

        # WhatsApp: native list
        if channel_upper == "WHATSAPP":
            if hasattr(adapter, "send_list"):
                return await adapter.send_list(  # type: ignore[attr-defined]
                    recipient_id, body, button_text, sections, header, footer
                )

        # Messenger/Instagram: Quick Replies (if <=13 rows), else numbered text
        if channel_upper in {"MESSENGER", "INSTAGRAM"}:
            all_rows = [row for section in sections for row in section.rows]

            if len(all_rows) <= 13 and hasattr(adapter, "send_quick_replies"):
                quick_replies = [
                    QuickReplyPayload(title=row.title[:20], payload=row.id)
                    for row in all_rows
                ]
                try:
                    logger.info(
                        "List degraded to Quick Replies",
                        channel=channel_upper,
                        original_rows=len(all_rows),
                        tenant_id=str(tenant.id),
                    )
                    return await adapter.send_quick_replies(  # type: ignore[attr-defined]
                        recipient_id, body, quick_replies
                    )
                except Exception as exc:
                    logger.warning(
                        "Quick Replies failed — falling back to numbered text",
                        channel=channel_upper,
                        error=str(exc),
                        tenant_id=str(tenant.id),
                    )

            # Numbered text fallback
            lines: list[str] = []
            for i, row in enumerate(all_rows):
                desc = f" - {row.description}" if row.description else ""
                lines.append(f"{i + 1}. {row.title}{desc}")
            full_text = f"{body}\n\n" + "\n".join(lines)
            logger.info(
                "List degraded to numbered text",
                channel=channel_upper,
                original_rows=len(all_rows),
                tenant_id=str(tenant.id),
            )
            return await adapter.send_text(recipient_id, full_text)

        # Generic fallback for any other channel
        lines = []
        for section in sections:
            if section.title:
                lines.append(f"*{section.title}*")
            for i, row in enumerate(section.rows):
                desc = f" - {row.description}" if row.description else ""
                lines.append(f"{i + 1}. {row.title}{desc}")
        full_text = f"{body}\n\n" + "\n".join(lines)
        return await adapter.send_text(recipient_id, full_text)

    async def send_template(
        self,
        channel: str,
        tenant: Tenant,
        recipient_id: str,
        template_name: str,
        language: str = "pt_BR",
        components: list[dict] | None = None,
    ) -> SendResult:
        """Send template with degradation.

        WhatsApp: native template.
        Messenger/Instagram: degraded to text (handled inside each adapter).
        """
        adapter = get_adapter(channel, tenant)
        return await adapter.send_template(
            recipient_id, template_name, language, components
        )

    async def mark_as_read(
        self,
        channel: str,
        tenant: Tenant,
        message_id: str,
    ) -> bool:
        """Mark message as read (WhatsApp only — silently skipped elsewhere)."""
        adapter = get_adapter(channel, tenant)
        return await adapter.mark_as_read(message_id)


# Singleton instance — import this in services/controllers
channel_router = ChannelRouter()
