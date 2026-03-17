"""Pydantic schemas for all N8N integration endpoints.

All input schemas use strict validation via Pydantic v2.  Optional fields
default to None so N8N can omit them without triggering validation errors.

Naming conventions follow the Express backend exactly so that existing N8N
workflows work against this CRM Core endpoint without modification.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Shared primitives
# ---------------------------------------------------------------------------


class _N8NBase(BaseModel):
    """All N8N request bodies share the optional `channel` discriminator."""

    channel: str | None = Field(
        None,
        description=(
            "Explicit channel override: 'whatsapp' | 'messenger' | 'instagram'. "
            "When omitted the channel is auto-detected from the contact's record."
        ),
    )


# ---------------------------------------------------------------------------
# Send endpoints
# ---------------------------------------------------------------------------


class SendTextRequest(_N8NBase):
    """POST /api/n8n/send-text"""

    phone: str = Field(..., description="Recipient phone or external ID")
    message: str = Field(..., min_length=1, max_length=4096)
    # Z-API compatibility alias — ignored if `message` is present
    text: str | None = None

    @field_validator("message", mode="before")
    @classmethod
    def coerce_message(cls, v: Any, info: Any) -> Any:
        # Allow callers to pass `text` only (Z-API compatibility)
        return v


class ButtonItem(BaseModel):
    id: str | None = None
    button_id: str | None = Field(None, alias="buttonId")
    label: str | None = None
    title: str | None = None
    text: str | None = None

    model_config = {"populate_by_name": True}

    def resolved_id(self) -> str:
        return self.id or self.button_id or ""

    def resolved_title(self) -> str:
        return self.label or self.title or self.text or ""


class SendButtonsRequest(_N8NBase):
    """POST /api/n8n/send-buttons — max 3 buttons (WhatsApp limit)."""

    phone: str
    message: str = Field(..., min_length=1)
    buttons: list[ButtonItem] = Field(..., min_length=1, max_length=3)
    header: str | None = None
    footer: str | None = None
    # Z-API compatibility aliases
    title: str | None = None


class ListRow(BaseModel):
    id: str = ""
    row_id: str | None = Field(None, alias="rowId")
    title: str
    description: str | None = None

    model_config = {"populate_by_name": True}

    def resolved_id(self) -> str:
        return self.id or self.row_id or ""


class ListSection(BaseModel):
    title: str | None = None
    rows: list[ListRow]


class OptionListItem(BaseModel):
    id: str | None = None
    row_id: str | None = Field(None, alias="rowId")
    title: str
    description: str | None = None

    model_config = {"populate_by_name": True}


class OptionList(BaseModel):
    title: str | None = None
    button_label: str | None = Field(None, alias="buttonLabel")
    options: list[OptionListItem]

    model_config = {"populate_by_name": True}


class SendListRequest(_N8NBase):
    """POST /api/n8n/send-list

    Accepts both the Z-API format (optionList) and the Cloud API format
    (sections + buttonText) for backwards compatibility.
    """

    phone: str
    message: str = Field(..., min_length=1)
    # Cloud API format
    sections: list[ListSection] | None = None
    button_text: str | None = Field(None, alias="buttonText")
    # Z-API format
    option_list: OptionList | None = Field(None, alias="optionList")
    header: str | None = None
    footer: str | None = None

    model_config = {"populate_by_name": True}


class SendMediaRequest(_N8NBase):
    """POST /api/n8n/send-media"""

    phone: str
    type: Literal["image", "video", "audio", "document"] | None = None
    url: str | None = None
    caption: str | None = None
    # Convenience object shortcuts (Z-API style)
    image: dict | str | None = None
    video: dict | str | None = None
    audio: dict | str | None = None
    document: dict | str | None = None
    # Generic media URL when type is inferred from extension
    media_url: str | None = Field(None, alias="mediaUrl")

    model_config = {"populate_by_name": True}


class TemplateComponent(BaseModel):
    type: str
    parameters: list[dict] | None = None


class SendTemplateRequest(_N8NBase):
    """POST /api/n8n/send-template"""

    phone: str
    # Accept both `template` (Z-API) and `templateName` (Cloud API)
    template: str | None = None
    template_name: str | None = Field(None, alias="templateName")
    language: str | None = "pt_BR"
    language_code: str | None = Field(None, alias="languageCode")
    # Cloud API components OR simple parameters list
    components: list[TemplateComponent] | None = None
    parameters: list[str] | None = None

    model_config = {"populate_by_name": True}

    @property
    def resolved_template_name(self) -> str:
        return self.template or self.template_name or ""

    @property
    def resolved_language(self) -> str:
        return self.language_code or self.language or "pt_BR"


class CarouselTemplateCard(BaseModel):
    """Card for template-mode carousel (Mode 1)."""

    image_url: str = Field(..., alias="imageUrl")
    body_params: list[str] | None = Field(None, alias="bodyParams")
    button_payloads: list[str] = Field(..., alias="buttonPayloads")
    button_labels: list[str] | None = Field(None, alias="buttonLabels")
    button_urls: list[str | None] | None = Field(None, alias="buttonUrls")

    model_config = {"populate_by_name": True}


class CarouselInteractiveButton(BaseModel):
    """Button within an interactive-mode carousel card (Mode 2)."""

    id: str | None = None
    button_id: str | None = Field(None, alias="buttonId")
    label: str | None = None
    title: str | None = None
    text: str | None = None
    type: str | None = None
    url: str | None = None

    model_config = {"populate_by_name": True}

    def resolved_id(self) -> str:
        return self.id or self.button_id or ""

    def resolved_title(self) -> str:
        return self.label or self.title or self.text or ""


class CarouselInteractiveCard(BaseModel):
    """Card for interactive-mode carousel (Mode 2)."""

    text: str
    image: str | None = None
    buttons: list[CarouselInteractiveButton] = Field(..., min_length=1, max_length=3)


class SendCarouselRequest(_N8NBase):
    """POST /api/n8n/send-carousel

    Mode 1 — template carousel:   phone + template + cards (CarouselTemplateCard list)
    Mode 2 — interactive carousel: phone + carousel (CarouselInteractiveCard list)
    """

    phone: str
    # Mode 1
    template: str | None = None
    cards: list[CarouselTemplateCard] | None = None
    # Mode 2
    message: str | None = None
    carousel: list[CarouselInteractiveCard] | None = None


class QuickReplyItem(BaseModel):
    title: str = Field(..., max_length=20)
    payload: str
    content_type: str | None = Field(None, alias="contentType")

    model_config = {"populate_by_name": True}


class SendQuickRepliesRequest(_N8NBase):
    """POST /api/n8n/send-quick-replies — max 13 quick replies."""

    phone: str
    message: str = Field(..., min_length=1)
    quick_replies: list[QuickReplyItem] = Field(
        ..., alias="quickReplies", min_length=1, max_length=13
    )

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Conversation management endpoints
# ---------------------------------------------------------------------------

VALID_HOTEL_UNITS = (
    "Ilhabela",
    "Campos do Jordão",
    "Camburi",
    "Santo Antônio do Pinhal",
    "Santa Smart Hotel",
)

VALID_ESCALATION_REASONS = (
    "USER_REQUESTED",
    "AI_UNABLE",
    "COMPLEX_QUERY",
    "COMPLAINT",
    "SALES_OPPORTUNITY",
    "URGENCY",
    "OTHER",
)


class MessageHistoryItem(BaseModel):
    role: str
    content: str
    timestamp: str | None = None


class EscalateRequest(BaseModel):
    """POST /api/n8n/escalate — transfer conversation to a human attendant."""

    phone: str | None = None
    # Z-API compatibility alias
    contact_phone_number: str | None = Field(None, alias="contactPhoneNumber")
    reason: str = "OTHER"
    reason_detail: str | None = Field(None, alias="reasonDetail")
    hotel_unit: str | None = Field(None, alias="hotelUnit")
    message_history: list[MessageHistoryItem] | None = Field(
        None, alias="messageHistory"
    )
    ai_context: dict | None = Field(None, alias="aiContext")
    priority: str | None = "HIGH"

    model_config = {"populate_by_name": True}

    @property
    def resolved_phone(self) -> str:
        return self.phone or self.contact_phone_number or ""

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if v not in VALID_ESCALATION_REASONS:
            return "OTHER"
        return v


class CheckIaLockRequest(BaseModel):
    """POST /api/n8n/check-ia-lock"""

    phone: str | None = None
    phone_number: str | None = Field(None, alias="phoneNumber")
    channel: str | None = None

    model_config = {"populate_by_name": True}

    @property
    def resolved_phone(self) -> str:
        return self.phone or self.phone_number or ""


class SetHotelUnitRequest(BaseModel):
    """POST /api/n8n/set-hotel-unit"""

    phone: str | None = None
    phone_number: str | None = Field(None, alias="phoneNumber")
    hotel_unit: str = Field(..., alias="hotelUnit")

    model_config = {"populate_by_name": True}

    @property
    def resolved_phone(self) -> str:
        return self.phone or self.phone_number or ""

    @field_validator("hotel_unit", mode="before")
    @classmethod
    def validate_hotel_unit(cls, v: str) -> str:
        if v not in VALID_HOTEL_UNITS:
            valid = ", ".join(VALID_HOTEL_UNITS)
            raise ValueError(f"Invalid hotelUnit. Valid values: {valid}")
        return v


class MarkFollowupRequest(BaseModel):
    """POST /api/n8n/mark-followup-sent"""

    phone: str | None = None
    phone_number: str | None = Field(None, alias="phoneNumber")

    model_config = {"populate_by_name": True}

    @property
    def resolved_phone(self) -> str:
        return self.phone or self.phone_number or ""


class MarkOpportunityRequest(BaseModel):
    """POST /api/n8n/mark-opportunity"""

    phone: str | None = None
    phone_number: str | None = Field(None, alias="phoneNumber")
    reason: str | None = None
    followup_response: str | None = Field(None, alias="followupResponse")

    model_config = {"populate_by_name": True}

    @property
    def resolved_phone(self) -> str:
        return self.phone or self.phone_number or ""


class MarkReadRequest(BaseModel):
    """POST /api/n8n/mark-read"""

    phone: str | None = None
    phone_number: str | None = Field(None, alias="phoneNumber")
    channel: str | None = None

    model_config = {"populate_by_name": True}

    @property
    def resolved_phone(self) -> str:
        return self.phone or self.phone_number or ""


# ---------------------------------------------------------------------------
# Availability check
# ---------------------------------------------------------------------------


class CheckAvailabilityRequest(BaseModel):
    """POST /api/n8n/check-availability"""

    unidade: str
    checkin: str = Field(..., description="DD/MM/YYYY")
    checkout: str = Field(..., description="DD/MM/YYYY")
    adults: int = Field(..., ge=1, le=10)
    children: int | None = Field(None, ge=0)
    children_ages: list[int] | str | None = Field(None, alias="childrenAges")

    model_config = {"populate_by_name": True}

    def resolved_children_ages(self) -> list[int] | None:
        """Normalise childrenAges: accept list[int] or CSV string."""
        if self.children_ages is None:
            return None
        if isinstance(self.children_ages, str):
            parts = [p.strip() for p in self.children_ages.split(",") if p.strip()]
            return [int(p) for p in parts if p.isdigit()]
        return self.children_ages


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class SendResponse(BaseModel):
    success: bool = True
    message_id: str | None = Field(None, alias="messageId")

    model_config = {"populate_by_name": True}


class IaLockResponse(BaseModel):
    locked: bool
    conversation_id: str | None = Field(None, alias="conversationId")

    model_config = {"populate_by_name": True}
