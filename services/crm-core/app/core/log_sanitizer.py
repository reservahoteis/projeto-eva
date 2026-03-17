"""PII sanitization for structured logs (CRIT-002).

Provides utilities to mask phone numbers, emails, and personal names
before they reach log output.  This prevents PII leakage into Docker
logs, CloudWatch, or any centralized logging backend.

Usage in code:
    from app.core.log_sanitizer import mask_phone, mask_email, mask_name

    logger.info("event", phone=mask_phone("5511999881234"))
    # -> phone="5511****1234"
"""

from __future__ import annotations

import re


def mask_phone(phone: str | None) -> str:
    """Mask a phone number, keeping first 4 and last 4 digits visible.

    Example: "5511999881234" -> "5511****1234"
    """
    if not phone:
        return "<none>"
    digits = re.sub(r"\D", "", phone)
    if len(digits) <= 8:
        return "****"
    return f"{digits[:4]}****{digits[-4:]}"


def mask_email(email: str | None) -> str:
    """Mask an email address, keeping first 2 chars of local part and domain.

    Example: "john.doe@example.com" -> "jo***@example.com"
    """
    if not email:
        return "<none>"
    parts = email.split("@", 1)
    if len(parts) != 2:
        return "***"
    local, domain = parts
    visible = local[:2] if len(local) > 2 else local[0]
    return f"{visible}***@{domain}"


def mask_name(name: str | None) -> str:
    """Mask a personal name, keeping only the first initial.

    Example: "John Doe" -> "J***"
    """
    if not name:
        return "<none>"
    return f"{name[0]}***"


def mask_pii(value: str | None, field_type: str = "auto") -> str:
    """Auto-detect and mask PII based on field_type hint.

    field_type: "phone", "email", "name", or "auto" (heuristic detection).
    """
    if not value:
        return "<none>"

    if field_type == "phone":
        return mask_phone(value)
    if field_type == "email":
        return mask_email(value)
    if field_type == "name":
        return mask_name(value)

    # Auto-detect
    if "@" in value:
        return mask_email(value)
    if re.match(r"^\+?\d{8,15}$", re.sub(r"[\s\-()]", "", value)):
        return mask_phone(value)
    return mask_name(value)
