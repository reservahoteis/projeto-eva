"""Facebook Messenger channel adapter.

Wraps the Meta Graph API v21.0 /me/messages endpoint.

Auth: ?access_token= query param (tenant's messenger_access_token).
Messenger supports Button Template (max 3 buttons), Generic Template
(carousel cards with image + title + buttons), and Quick Replies.

Differences from WhatsApp:
  - access_token is a query param, not a Bearer header
  - document media type maps to 'file'
  - Caption for media is sent as a separate text message
  - Buttons use postback or web_url (not WhatsApp's reply type)
  - Generic Template supports up to 10 elements (cards)
  - Quick Replies support up to 13 items (content_type=text)
  - No mark_as_read support — returns False silently
"""

from __future__ import annotations

import structlog

from app.channels._http import build_client, mask_token, retry_request
from app.channels.base import (
    ButtonPayload,
    ChannelAdapter,
    GenericTemplateElement,
    QuickReplyPayload,
    SendResult,
)
from app.core.exceptions import InternalServerError

logger = structlog.get_logger()

GRAPH_API_VERSION = "v21.0"
GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"
MESSAGES_ENDPOINT = f"{GRAPH_API_BASE}/me/messages"


class MessengerAdapter(ChannelAdapter):
    """Send messages via Facebook Messenger Send API for a single tenant."""

    channel = "MESSENGER"

    def __init__(
        self,
        *,
        access_token: str,
        tenant_id: str,
    ) -> None:
        self._access_token = access_token
        self._tenant_id = tenant_id
        self._log = logger.bind(
            tenant_id=tenant_id,
            channel="MESSENGER",
            token_preview=mask_token(access_token),
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _params(self) -> dict[str, str]:
        """access_token passed as query param per Messenger API convention."""
        return {"access_token": self._access_token}

    async def _post(self, body: dict) -> dict:
        """POST to /me/messages with retry."""
        async with build_client() as client:
            response = await retry_request(
                client,
                "POST",
                MESSAGES_ENDPOINT,
                params=self._params(),
                json=body,
                log_prefix="Messenger",
            )
            return response.json()

    @staticmethod
    def _extract_message_id(data: dict) -> str:
        return data.get("message_id") or ""

    def _build_button(self, btn: ButtonPayload) -> dict:
        """Convert ButtonPayload to Messenger button object."""
        if btn.url:
            return {
                "type": "web_url",
                "title": btn.title[:20],
                "url": btn.url,
            }
        return {
            "type": "postback",
            "title": btn.title[:20],
            "payload": btn.id,
        }

    # ------------------------------------------------------------------
    # ChannelAdapter interface
    # ------------------------------------------------------------------

    async def send_text(self, recipient_id: str, text: str, **kwargs) -> SendResult:
        """Send a plain-text message."""
        body = {
            "recipient": {"id": recipient_id},
            "message": {"text": text},
        }
        try:
            data = await self._post(body)
            external_id = self._extract_message_id(data)
            self._log.info(
                "[MESSENGER SEND] send_text OK",
                to=recipient_id,
                text_preview=text[:80],
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[MESSENGER SEND] send_text FAILED",
                to=recipient_id,
                text_preview=text[:80],
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar mensagem Messenger: {exc}") from exc

    async def send_media(
        self,
        recipient_id: str,
        media_type: str,
        media_url: str,
        caption: str | None = None,
        **kwargs,
    ) -> SendResult:
        """Send media attachment.

        document maps to 'file' (Messenger naming convention).
        If caption is provided, it is sent as a follow-up text message.
        """
        # Messenger uses 'file' for documents
        messenger_type = "file" if media_type == "document" else media_type

        body = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": messenger_type,
                    "payload": {"url": media_url, "is_reusable": True},
                }
            },
        }
        try:
            data = await self._post(body)
            external_id = self._extract_message_id(data)

            # Caption as separate message (Messenger has no native caption field)
            if caption:
                await self._post({
                    "recipient": {"id": recipient_id},
                    "message": {"text": caption},
                })

            self._log.info(
                "[MESSENGER SEND] send_media OK",
                to=recipient_id,
                media_type=messenger_type,
                has_caption=bool(caption),
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[MESSENGER SEND] send_media FAILED",
                to=recipient_id,
                media_type=media_type,
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar midia Messenger: {exc}") from exc

    async def send_buttons(
        self,
        recipient_id: str,
        body: str,
        buttons: list[ButtonPayload],
        header: str | None = None,
        footer: str | None = None,
        **kwargs,
    ) -> SendResult:
        """Send a Button Template (max 3 buttons).

        header and footer are accepted for interface compatibility but
        Messenger's Button Template only supports a text body field.
        """
        request_body = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "button",
                        "text": body,
                        "buttons": [self._build_button(btn) for btn in buttons[:3]],
                    },
                }
            },
        }
        try:
            data = await self._post(request_body)
            external_id = self._extract_message_id(data)
            self._log.info(
                "[MESSENGER SEND] send_buttons OK",
                to=recipient_id,
                button_count=len(buttons),
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[MESSENGER SEND] send_buttons FAILED",
                to=recipient_id,
                button_count=len(buttons),
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar botoes Messenger: {exc}") from exc

    async def send_generic_template(
        self,
        recipient_id: str,
        elements: list[GenericTemplateElement],
        **kwargs,
    ) -> SendResult:
        """Send a Generic Template carousel (max 10 cards).

        Each element can have a title (required), subtitle, image_url, and
        up to 3 buttons. Ideal for hotel room carousels.
        """
        request_body = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "generic",
                        "elements": [
                            {
                                "title": el.title[:80],
                                **({"subtitle": el.subtitle[:80]} if el.subtitle else {}),
                                **({"image_url": el.image_url} if el.image_url else {}),
                                **(
                                    {
                                        "buttons": [
                                            self._build_button(btn)
                                            for btn in (el.buttons or [])[:3]
                                        ]
                                    }
                                    if el.buttons
                                    else {}
                                ),
                            }
                            for el in elements[:10]
                        ],
                    },
                }
            },
        }
        try:
            data = await self._post(request_body)
            external_id = self._extract_message_id(data)
            self._log.info(
                "[MESSENGER SEND] send_generic_template OK",
                to=recipient_id,
                element_count=len(elements),
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[MESSENGER SEND] send_generic_template FAILED",
                to=recipient_id,
                element_count=len(elements),
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar Generic Template Messenger: {exc}") from exc

    async def send_quick_replies(
        self,
        recipient_id: str,
        text: str,
        quick_replies: list[QuickReplyPayload],
        **kwargs,
    ) -> SendResult:
        """Send Quick Replies (max 13, title max 20 chars)."""
        request_body = {
            "recipient": {"id": recipient_id},
            "message": {
                "text": text,
                "quick_replies": [
                    {
                        "content_type": "text",
                        "title": qr.title[:20],
                        "payload": qr.payload,
                    }
                    for qr in quick_replies[:13]
                ],
            },
        }
        try:
            data = await self._post(request_body)
            external_id = self._extract_message_id(data)
            self._log.info(
                "[MESSENGER SEND] send_quick_replies OK",
                to=recipient_id,
                quick_reply_count=len(quick_replies),
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[MESSENGER SEND] send_quick_replies FAILED",
                to=recipient_id,
                quick_reply_count=len(quick_replies),
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar Quick Replies Messenger: {exc}") from exc

    async def send_template(
        self,
        recipient_id: str,
        template_name: str,
        language: str = "pt_BR",
        components: list[dict] | None = None,
        **kwargs,
    ) -> SendResult:
        """Messenger does not have a pre-approved template system.

        Degrades to a plain-text representation for interface compatibility.
        """
        param_text = ""
        if components:
            params = [
                p.get("text", "")
                for c in components
                for p in c.get("parameters", [])
                if p.get("type") == "text"
            ]
            if params:
                param_text = f"\n\nParametros: {', '.join(params)}"

        text = f"[Template: {template_name}]{param_text}"
        self._log.info(
            "[MESSENGER SEND] send_template degraded to text",
            to=recipient_id,
            template_name=template_name,
        )
        return await self.send_text(recipient_id, text)

    async def mark_as_read(self, message_id: str, **kwargs) -> bool:
        """Messenger does not support mark-as-read via Send API — no-op."""
        self._log.debug(
            "[MESSENGER SEND] mark_as_read not supported, skipping",
            message_id=message_id,
        )
        return False
