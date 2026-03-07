"""WhatsApp Cloud API channel adapter.

Wraps the Meta Graph API v21.0 /{phone_number_id}/messages endpoint.

Auth: Bearer {whatsapp_access_token} (per-tenant, stored encrypted in DB).
The token is decrypted by the caller (router.py) before the adapter is
instantiated — this adapter never touches the DB or encryption layer
directly, keeping it stateless and testable.

Limits enforced (Meta policy):
  - Buttons: max 3 per message, title max 20 chars
  - List rows: max 24 chars title, 72 chars description, 10 items total
  - List button text: max 20 chars
  - Carousel: implemented as sequential interactive-button messages (one per card)
"""

from __future__ import annotations

import structlog

from app.channels._http import build_client, mask_token, retry_request
from app.channels.base import (
    ButtonPayload,
    ChannelAdapter,
    GenericTemplateElement,
    ListSection,
    SendResult,
)
from app.core.exceptions import BadRequestError, InternalServerError

logger = structlog.get_logger()

GRAPH_API_VERSION = "v21.0"
GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


class WhatsAppAdapter(ChannelAdapter):
    """Send messages via WhatsApp Cloud API for a single tenant."""

    channel = "WHATSAPP"

    def __init__(
        self,
        *,
        phone_number_id: str,
        access_token: str,
        tenant_id: str,
    ) -> None:
        self._phone_number_id = phone_number_id
        self._access_token = access_token
        self._tenant_id = tenant_id
        self._base_url = f"{GRAPH_API_BASE}/{phone_number_id}/messages"
        self._log = logger.bind(
            tenant_id=tenant_id,
            channel="WHATSAPP",
            token_preview=mask_token(access_token),
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._access_token}"}

    async def _post(self, payload: dict) -> dict:
        """POST to the messages endpoint with retry."""
        async with build_client() as client:
            response = await retry_request(
                client,
                "POST",
                self._base_url,
                headers=self._auth_headers(),
                json=payload,
                log_prefix="WhatsApp",
            )
            return response.json()

    @staticmethod
    def _extract_message_id(data: dict) -> str:
        messages = data.get("messages") or []
        if messages:
            return messages[0].get("id", "")
        return ""

    # ------------------------------------------------------------------
    # ChannelAdapter interface
    # ------------------------------------------------------------------

    async def send_text(self, recipient_id: str, text: str, **kwargs) -> SendResult:
        """Send a plain-text message."""
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_id,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": text,
            },
        }
        try:
            data = await self._post(payload)
            external_id = self._extract_message_id(data)
            from app.core.log_sanitizer import mask_phone
            self._log.info(
                "[WHATSAPP SEND] send_text OK",
                to_masked=mask_phone(recipient_id),
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            from app.core.log_sanitizer import mask_phone
            self._log.error(
                "[WHATSAPP SEND] send_text FAILED",
                to_masked=mask_phone(recipient_id),
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar mensagem WhatsApp: {exc}") from exc

    async def send_media(
        self,
        recipient_id: str,
        media_type: str,
        media_url: str,
        caption: str | None = None,
        **kwargs,
    ) -> SendResult:
        """Send image, video, audio, or document.

        media_type must be one of: image, video, audio, document.
        """
        allowed_types = {"image", "video", "audio", "document"}
        if media_type not in allowed_types:
            raise BadRequestError(f"Unsupported media type for WhatsApp: {media_type!r}")

        media_payload: dict = {"link": media_url}
        if caption and media_type in {"image", "video", "document"}:
            media_payload["caption"] = caption

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_id,
            "type": media_type,
            media_type: media_payload,
        }
        try:
            data = await self._post(payload)
            external_id = self._extract_message_id(data)
            self._log.info(
                "[WHATSAPP SEND] send_media OK",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                media_type=media_type,
                has_caption=bool(caption),
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[WHATSAPP SEND] send_media FAILED",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                media_type=media_type,
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar midia WhatsApp: {exc}") from exc

    async def send_buttons(
        self,
        recipient_id: str,
        body: str,
        buttons: list[ButtonPayload],
        header: str | None = None,
        footer: str | None = None,
        **kwargs,
    ) -> SendResult:
        """Send an interactive button message (max 3 buttons, title max 20 chars)."""
        if len(buttons) > 3:
            raise BadRequestError("WhatsApp permite no maximo 3 botoes por mensagem")

        interactive: dict = {
            "type": "button",
            "body": {"text": body},
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": btn.id,
                            "title": btn.title[:20],
                        },
                    }
                    for btn in buttons
                ]
            },
        }
        if header:
            interactive["header"] = {"type": "text", "text": header}
        if footer:
            interactive["footer"] = {"text": footer}

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_id,
            "type": "interactive",
            "interactive": interactive,
        }
        try:
            data = await self._post(payload)
            external_id = self._extract_message_id(data)
            self._log.info(
                "[WHATSAPP SEND] send_buttons OK",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                button_count=len(buttons),
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[WHATSAPP SEND] send_buttons FAILED",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                button_count=len(buttons),
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar botoes WhatsApp: {exc}") from exc

    async def send_list(
        self,
        recipient_id: str,
        body: str,
        button_text: str,
        sections: list[ListSection],
        header: str | None = None,
        footer: str | None = None,
        **kwargs,
    ) -> SendResult:
        """Send an interactive list message (WhatsApp native, max 10 rows total)."""
        interactive: dict = {
            "type": "list",
            "body": {"text": body},
            "action": {
                "button": button_text[:20],
                "sections": [
                    {
                        **({"title": s.title} if s.title else {}),
                        "rows": [
                            {
                                "id": row.id,
                                "title": row.title[:24],
                                **({"description": row.description[:72]} if row.description else {}),
                            }
                            for row in s.rows
                        ],
                    }
                    for s in sections
                ],
            },
        }
        if header:
            interactive["header"] = {"type": "text", "text": header}
        if footer:
            interactive["footer"] = {"text": footer}

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_id,
            "type": "interactive",
            "interactive": interactive,
        }
        try:
            data = await self._post(payload)
            external_id = self._extract_message_id(data)
            total_rows = sum(len(s.rows) for s in sections)
            self._log.info(
                "[WHATSAPP SEND] send_list OK",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                total_rows=total_rows,
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[WHATSAPP SEND] send_list FAILED",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar lista WhatsApp: {exc}") from exc

    async def send_template(
        self,
        recipient_id: str,
        template_name: str,
        language: str = "pt_BR",
        components: list[dict] | None = None,
        **kwargs,
    ) -> SendResult:
        """Send a pre-approved Meta template message."""
        template: dict = {
            "name": template_name,
            "language": {"code": language},
        }
        if components:
            template["components"] = components

        payload = {
            "messaging_product": "whatsapp",
            "to": recipient_id,
            "type": "template",
            "template": template,
        }
        try:
            data = await self._post(payload)
            external_id = self._extract_message_id(data)
            self._log.info(
                "[WHATSAPP SEND] send_template OK",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                template_name=template_name,
                language=language,
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[WHATSAPP SEND] send_template FAILED",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                template_name=template_name,
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar template WhatsApp: {exc}") from exc

    async def send_carousel(
        self,
        recipient_id: str,
        body_text: str,
        cards: list[dict],
        **kwargs,
    ) -> list[SendResult]:
        """Send a carousel as sequential interactive-button messages.

        Each card is a dict with:
          - text (str): card body
          - image (str | None): header image URL
          - buttons (list[dict]): each with id, label, optional url
        """
        results: list[SendResult] = []

        # Introductory text message
        if body_text:
            result = await self.send_text(recipient_id, body_text)
            results.append(result)

        for card in cards:
            interactive: dict = {
                "type": "button",
                "body": {"text": card.get("text", "")},
                "action": {
                    "buttons": [
                        {
                            "type": "reply",
                            "reply": {
                                "id": btn.get("id", ""),
                                "title": btn.get("label", "")[:20],
                            },
                        }
                        for btn in card.get("buttons", [])[:3]
                    ]
                },
            }

            image_url = card.get("image")
            if image_url:
                interactive["header"] = {
                    "type": "image",
                    "image": {"link": image_url},
                }

            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": recipient_id,
                "type": "interactive",
                "interactive": interactive,
            }
            try:
                data = await self._post(payload)
                external_id = self._extract_message_id(data)
                self._log.info(
                    "[WHATSAPP SEND] send_carousel card OK",
                    recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                    has_image=bool(image_url),
                    external_message_id=external_id,
                )
                results.append(SendResult(external_message_id=external_id, success=True))
            except Exception as exc:
                self._log.error(
                    "[WHATSAPP SEND] send_carousel card FAILED",
                    recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                    error=str(exc),
                )
                results.append(SendResult(external_message_id="", success=False))

        return results

    async def mark_as_read(self, message_id: str, **kwargs) -> bool:
        """Mark an inbound message as read (best-effort — never raises)."""
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id,
        }
        try:
            await self._post(payload)
            self._log.debug(
                "[WHATSAPP SEND] mark_as_read OK",
                message_id=message_id,
            )
            return True
        except Exception as exc:
            # Non-critical — log and return False, never propagate
            self._log.error(
                "[WHATSAPP SEND] mark_as_read FAILED",
                message_id=message_id,
                error=str(exc),
            )
            return False
