"""Instagram DM channel adapter.

Wraps the Meta Graph API v21.0 /me/messages endpoint (same base as Messenger).

Auth: ?access_token= query param (tenant's instagram_access_token — a Page
Access Token starting with EAA..., NOT a User Access Token).

Key limitations vs Messenger:
  - Only 'image' media type is natively supported; video, audio, and document
    degrade to text + URL.
  - Button Template is attempted first; falls back to numbered text if the
    API rejects it (some Instagram accounts are not enrolled).
  - Generic Template (carousel) works if the account supports it.
  - Quick Replies are fully supported.
  - No mark_as_read support — returns False silently.
  - No pre-approved template system — send_template degrades to text.
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


class InstagramAdapter(ChannelAdapter):
    """Send messages via Instagram Messaging API for a single tenant."""

    channel = "INSTAGRAM"

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
            channel="INSTAGRAM",
            token_preview=mask_token(access_token),
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _params(self) -> dict[str, str]:
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
                log_prefix="Instagram",
            )
            return response.json()

    @staticmethod
    def _extract_message_id(data: dict) -> str:
        return data.get("message_id") or ""

    def _build_button(self, btn: ButtonPayload) -> dict:
        if btn.url:
            return {"type": "web_url", "title": btn.title[:20], "url": btn.url}
        return {"type": "postback", "title": btn.title[:20], "payload": btn.id}

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
                "[INSTAGRAM SEND] send_text OK",
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[INSTAGRAM SEND] send_text FAILED",
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar mensagem Instagram: {exc}") from exc

    async def send_media(
        self,
        recipient_id: str,
        media_type: str,
        media_url: str,
        caption: str | None = None,
        **kwargs,
    ) -> SendResult:
        """Send media.

        Instagram only supports image natively. video, audio, and document
        degrade to a text message containing the URL (and caption if provided).
        """
        if media_type != "image":
            self._log.info(
                "[INSTAGRAM SEND] send_media degrading to text (unsupported type)",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                media_type=media_type,
                degraded_to="text+url",
            )
            link_text = f"{caption}\n{media_url}" if caption else media_url
            return await self.send_text(recipient_id, link_text)

        body = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "image",
                    "payload": {"url": media_url},
                }
            },
        }
        try:
            data = await self._post(body)
            external_id = self._extract_message_id(data)

            if caption:
                await self._post({
                    "recipient": {"id": recipient_id},
                    "message": {"text": caption},
                })

            self._log.info(
                "[INSTAGRAM SEND] send_media OK",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                media_type="image",
                has_caption=bool(caption),
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[INSTAGRAM SEND] send_media FAILED",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                media_type=media_type,
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar midia Instagram: {exc}") from exc

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

        Falls back to numbered text if the Instagram account does not
        support Button Template (API returns an error).
        """
        request_body = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "button",
                        "text": body[:640],
                        "buttons": [self._build_button(btn) for btn in buttons[:3]],
                    },
                }
            },
        }
        try:
            data = await self._post(request_body)
            external_id = self._extract_message_id(data)
            self._log.info(
                "[INSTAGRAM SEND] send_buttons OK (Button Template)",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                button_count=len(buttons),
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            # Fallback: numbered text when Button Template is rejected
            self._log.warning(
                "[INSTAGRAM SEND] send_buttons Button Template failed — degrading to text",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                button_count=len(buttons),
                error=str(exc),
            )
            numbered = "\n".join(
                f"{i + 1}. {btn.title}" + (f"\n   {btn.url}" if btn.url else "")
                for i, btn in enumerate(buttons)
            )
            return await self.send_text(recipient_id, f"{body}\n\n{numbered}")

    async def send_generic_template(
        self,
        recipient_id: str,
        elements: list[GenericTemplateElement],
        **kwargs,
    ) -> SendResult:
        """Send a Generic Template carousel (max 10 cards).

        Mirrors MessengerAdapter.send_generic_template — same API endpoint.
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
                "[INSTAGRAM SEND] send_generic_template OK",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                element_count=len(elements),
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[INSTAGRAM SEND] send_generic_template FAILED",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                element_count=len(elements),
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar Generic Template Instagram: {exc}") from exc

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
                "[INSTAGRAM SEND] send_quick_replies OK",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                quick_reply_count=len(quick_replies),
                external_message_id=external_id,
            )
            return SendResult(external_message_id=external_id, success=True)
        except Exception as exc:
            self._log.error(
                "[INSTAGRAM SEND] send_quick_replies FAILED",
                recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
                quick_reply_count=len(quick_replies),
                error=str(exc),
            )
            raise InternalServerError(f"Falha ao enviar Quick Replies Instagram: {exc}") from exc

    async def send_template(
        self,
        recipient_id: str,
        template_name: str,
        language: str = "pt_BR",
        components: list[dict] | None = None,
        **kwargs,
    ) -> SendResult:
        """Instagram has no pre-approved template system — degrades to text."""
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
            "[INSTAGRAM SEND] send_template degraded to text",
            recipient_masked=recipient_id[:6] + "***" if len(recipient_id) > 6 else "***",
            template_name=template_name,
        )
        return await self.send_text(recipient_id, text)

    async def mark_as_read(self, message_id: str, **kwargs) -> bool:
        """Instagram DM API does not expose mark-as-read — no-op."""
        self._log.debug(
            "[INSTAGRAM SEND] mark_as_read not supported, skipping",
            message_id=message_id,
        )
        return False
