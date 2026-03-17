"""N8N integration package.

Exposes the FastAPI router that handles all N8N automation endpoints.
Authentication uses X-API-Key (format: {tenantSlug}:{whatsappPhoneNumberId})
instead of the standard JWT Bearer token used by the rest of the API.
"""
