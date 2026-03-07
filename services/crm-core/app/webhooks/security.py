"""Webhook HMAC signature validation.

Meta signs every POST webhook payload with the app secret using HMAC-SHA256
and includes the digest in the X-Hub-Signature-256 header in the format:
  sha256=<hex-digest>

Reference:
  https://developers.facebook.com/docs/messenger-platform/webhooks#validate-payloads
"""

import hashlib
import hmac


def validate_webhook_signature(
    payload: bytes,
    signature: str,
    app_secret: str,
) -> bool:
    """Validate a Meta webhook HMAC-SHA256 signature.

    Uses ``hmac.compare_digest`` for constant-time comparison to prevent
    timing-based side-channel attacks.

    Args:
        payload:    The raw request body bytes (must not be JSON-decoded first).
        signature:  Value of the X-Hub-Signature-256 header, with or without
                    the ``sha256=`` prefix.
        app_secret: The plaintext Meta App Secret for this tenant.

    Returns:
        True if the computed digest matches the received digest; False otherwise.
    """
    # Guard: reject empty secrets and signatures to prevent trivial bypass
    if not app_secret or not signature:
        return False

    expected = hmac.new(
        app_secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    received = (
        signature[7:]           # strip "sha256=" prefix
        if signature.startswith("sha256=")
        else signature
    )

    return hmac.compare_digest(expected, received)
