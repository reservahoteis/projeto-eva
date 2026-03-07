"""Tests for app/core/log_sanitizer.py — PII masking utilities."""

from app.core.log_sanitizer import mask_email, mask_name, mask_phone, mask_pii


# ---------------------------------------------------------------------------
# mask_phone
# ---------------------------------------------------------------------------


def test_mask_phone_brazilian_13_digits():
    assert mask_phone("5511999881234") == "5511****1234"


def test_mask_phone_short():
    assert mask_phone("12345") == "****"


def test_mask_phone_none():
    assert mask_phone(None) == "<none>"


def test_mask_phone_empty():
    assert mask_phone("") == "<none>"


def test_mask_phone_international():
    assert mask_phone("+14155551234") == "1415****1234"


# ---------------------------------------------------------------------------
# mask_email
# ---------------------------------------------------------------------------


def test_mask_email_normal():
    assert mask_email("john.doe@example.com") == "jo***@example.com"


def test_mask_email_short_local():
    assert mask_email("a@b.com") == "a***@b.com"


def test_mask_email_none():
    assert mask_email(None) == "<none>"


def test_mask_email_no_at():
    assert mask_email("notanemail") == "***"


# ---------------------------------------------------------------------------
# mask_name
# ---------------------------------------------------------------------------


def test_mask_name_full():
    assert mask_name("John Doe") == "J***"


def test_mask_name_single():
    assert mask_name("A") == "A***"


def test_mask_name_none():
    assert mask_name(None) == "<none>"


# ---------------------------------------------------------------------------
# mask_pii (auto-detection)
# ---------------------------------------------------------------------------


def test_mask_pii_detects_email():
    assert mask_pii("user@example.com") == "us***@example.com"


def test_mask_pii_detects_phone():
    assert mask_pii("5511999881234") == "5511****1234"


def test_mask_pii_detects_name():
    assert mask_pii("Maria Silva") == "M***"


def test_mask_pii_none():
    assert mask_pii(None) == "<none>"


def test_mask_pii_explicit_type():
    assert mask_pii("5511999881234", field_type="phone") == "5511****1234"
    assert mask_pii("john@test.com", field_type="email") == "jo***@test.com"
    assert mask_pii("John", field_type="name") == "J***"
