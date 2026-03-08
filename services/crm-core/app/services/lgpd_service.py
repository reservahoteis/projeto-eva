"""LGPDService -- Lei Geral de Protecao de Dados compliance operations.

Implements the data-subject rights mandated by the Brazilian LGPD:
  - Consent management (grant / revoke)
  - Data portability (export)
  - Right to erasure (anonymisation, not hard-delete)
  - Automated retention cleanup

Design decisions:
  - All methods are async and accept an AsyncSession injected by the caller.
  - Every query MUST include tenant_id in the WHERE clause.
  - Erasure anonymises PII fields instead of hard-deleting rows so that
    referential integrity and audit trail are preserved.
  - Message content is replaced with a LGPD redaction notice.
  - All operations are logged to the audit trail via audit_log_service.
  - Use db.flush() not db.commit() -- caller owns the transaction.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.deal import Deal
from app.models.lead import Lead
from app.models.message import Message
from app.models.tenant import Tenant
from app.schemas.contact import ContactResponse
from app.services.audit_log_service import audit_log_service

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_REDACTED_CONTENT = "[CONTEUDO REMOVIDO - LGPD]"

_PII_ANONYMISATION: dict[str, Any] = {
    "first_name": "REDACTED",
    "last_name": None,
    "full_name": "REDACTED",
    "mobile_no": None,
    "phone": None,
    "company_name": None,
    "image_url": None,
    "consent_status": "ERASED",
}


# ---------------------------------------------------------------------------
# LGPDService
# ---------------------------------------------------------------------------


class LGPDService:
    """LGPD compliance operations scoped to a single tenant per call."""

    # ------------------------------------------------------------------
    # grant_consent
    # ------------------------------------------------------------------

    async def grant_consent(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        contact_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> ContactResponse:
        """Record explicit consent from a data subject."""
        contact = await self._get_contact(db, tenant_id, contact_id)
        now = datetime.now(UTC)

        contact.consent_status = "GRANTED"
        contact.consent_granted_at = now
        contact.consent_revoked_at = None
        contact.consent_ip_address = ip_address

        await db.flush()

        await audit_log_service.log(
            db=db,
            tenant_id=tenant_id,
            action="LGPD_CONSENT_GRANTED",
            entity="Contact",
            entity_id=str(contact_id),
            new_data={
                "consent_status": "GRANTED",
                "consent_granted_at": now.isoformat(),
                "ip_address": ip_address,
            },
            ip_address=ip_address,
        )

        logger.info(
            "lgpd_consent_granted",
            contact_id=str(contact_id),
            tenant_id=str(tenant_id),
        )
        return ContactResponse.model_validate(contact)

    # ------------------------------------------------------------------
    # revoke_consent
    # ------------------------------------------------------------------

    async def revoke_consent(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        contact_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> ContactResponse:
        """Record consent revocation from a data subject."""
        contact = await self._get_contact(db, tenant_id, contact_id)
        now = datetime.now(UTC)

        contact.consent_status = "REVOKED"
        contact.consent_revoked_at = now
        contact.consent_ip_address = ip_address

        await db.flush()

        await audit_log_service.log(
            db=db,
            tenant_id=tenant_id,
            action="LGPD_CONSENT_REVOKED",
            entity="Contact",
            entity_id=str(contact_id),
            new_data={
                "consent_status": "REVOKED",
                "consent_revoked_at": now.isoformat(),
                "ip_address": ip_address,
            },
            ip_address=ip_address,
        )

        logger.info(
            "lgpd_consent_revoked",
            contact_id=str(contact_id),
            tenant_id=str(tenant_id),
        )
        return ContactResponse.model_validate(contact)

    # ------------------------------------------------------------------
    # export_contact_data
    # ------------------------------------------------------------------

    async def export_contact_data(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        contact_id: uuid.UUID,
    ) -> dict:
        """Export all data related to a contact (LGPD data portability)."""
        contact = await self._get_contact(db, tenant_id, contact_id)

        # Conversations
        conv_result = await db.execute(
            select(Conversation).where(
                Conversation.tenant_id == tenant_id,
                Conversation.contact_id == contact_id,
            )
        )
        conversations = conv_result.scalars().all()

        # Messages from those conversations
        conversation_ids = [c.id for c in conversations]
        messages: list[Any] = []
        if conversation_ids:
            msg_result = await db.execute(
                select(Message).where(
                    Message.tenant_id == tenant_id,
                    Message.conversation_id.in_(conversation_ids),
                )
            )
            messages = msg_result.scalars().all()

        # Leads (via email or mobile_no match within tenant)
        leads: list[Any] = []
        if contact.email or contact.mobile_no:
            lead_filters = [Lead.tenant_id == tenant_id]
            from sqlalchemy import or_

            or_conditions = []
            if contact.email:
                or_conditions.append(Lead.email == contact.email)
            if contact.mobile_no:
                or_conditions.append(Lead.mobile_no == contact.mobile_no)
            lead_filters.append(or_(*or_conditions))
            lead_result = await db.execute(select(Lead).where(*lead_filters))
            leads = lead_result.scalars().all()

        # Deals linked to this contact
        deal_result = await db.execute(
            select(Deal).where(
                Deal.tenant_id == tenant_id,
                Deal.contact_id == contact_id,
            )
        )
        deals = deal_result.scalars().all()

        # Build export payload
        export = {
            "contact": {
                "id": str(contact.id),
                "first_name": contact.first_name,
                "last_name": contact.last_name,
                "full_name": contact.full_name,
                "email": contact.email,
                "mobile_no": contact.mobile_no,
                "phone": contact.phone,
                "company_name": contact.company_name,
                "designation": contact.designation,
                "gender": contact.gender,
                "image_url": contact.image_url,
                "consent_status": contact.consent_status,
                "consent_granted_at": (
                    contact.consent_granted_at.isoformat()
                    if contact.consent_granted_at
                    else None
                ),
                "consent_revoked_at": (
                    contact.consent_revoked_at.isoformat()
                    if contact.consent_revoked_at
                    else None
                ),
                "created_at": contact.created_at.isoformat(),
                "updated_at": contact.updated_at.isoformat(),
            },
            "conversations": [
                {
                    "id": str(c.id),
                    "status": c.status,
                    "channel": c.channel,
                    "created_at": c.created_at.isoformat(),
                    "last_message_at": (
                        c.last_message_at.isoformat()
                        if c.last_message_at
                        else None
                    ),
                }
                for c in conversations
            ],
            "messages": [
                {
                    "id": str(m.id),
                    "conversation_id": str(m.conversation_id),
                    "direction": m.direction,
                    "type": m.type,
                    "content": m.content,
                    "timestamp": m.timestamp.isoformat(),
                }
                for m in messages
            ],
            "related_entities": {
                "leads": [
                    {
                        "id": str(lead.id),
                        "first_name": lead.first_name,
                        "last_name": getattr(lead, "last_name", None),
                        "email": getattr(lead, "email", None),
                        "mobile_no": getattr(lead, "mobile_no", None),
                        "created_at": lead.created_at.isoformat(),
                    }
                    for lead in leads
                ],
                "deals": [
                    {
                        "id": str(deal.id),
                        "deal_name": getattr(deal, "deal_name", None),
                        "amount": float(deal.amount) if getattr(deal, "amount", None) else None,
                        "created_at": deal.created_at.isoformat(),
                    }
                    for deal in deals
                ],
            },
        }

        await audit_log_service.log(
            db=db,
            tenant_id=tenant_id,
            action="LGPD_DATA_EXPORT",
            entity="Contact",
            entity_id=str(contact_id),
            metadata={
                "conversations_count": len(conversations),
                "messages_count": len(messages),
                "leads_count": len(leads),
                "deals_count": len(deals),
            },
        )

        logger.info(
            "lgpd_data_exported",
            contact_id=str(contact_id),
            tenant_id=str(tenant_id),
        )
        return export

    # ------------------------------------------------------------------
    # erase_contact_data
    # ------------------------------------------------------------------

    async def erase_contact_data(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        contact_id: uuid.UUID,
        user_id: uuid.UUID | None = None,
    ) -> dict:
        """Anonymise all PII for a contact (LGPD right to erasure).

        Does NOT hard-delete rows -- replaces PII with redaction markers
        so that referential integrity and the audit trail are preserved.
        """
        contact = await self._get_contact(db, tenant_id, contact_id)
        now = datetime.now(UTC)

        # Capture old data for audit before anonymisation
        old_data = {
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "full_name": contact.full_name,
            "email": contact.email,
            "mobile_no": contact.mobile_no,
            "phone": contact.phone,
            "company_name": contact.company_name,
            "image_url": contact.image_url,
            "consent_status": contact.consent_status,
        }

        # Anonymise contact PII
        erased_fields: list[str] = []
        for field, redacted_value in _PII_ANONYMISATION.items():
            setattr(contact, field, redacted_value)
            erased_fields.append(field)

        # Set email to a unique redacted address
        contact.email = f"redacted-{contact_id}@erased.local"
        erased_fields.append("email")

        contact.consent_revoked_at = now

        await db.flush()

        # Redact message content in related conversations
        conv_result = await db.execute(
            select(Conversation.id).where(
                Conversation.tenant_id == tenant_id,
                Conversation.contact_id == contact_id,
            )
        )
        conversation_ids = [row[0] for row in conv_result.fetchall()]

        messages_redacted = 0
        if conversation_ids:
            result = await db.execute(
                update(Message)
                .where(
                    Message.tenant_id == tenant_id,
                    Message.conversation_id.in_(conversation_ids),
                )
                .values(content=_REDACTED_CONTENT)
            )
            messages_redacted = result.rowcount  # type: ignore[assignment]
            await db.flush()

        await audit_log_service.log(
            db=db,
            tenant_id=tenant_id,
            action="LGPD_DATA_ERASURE",
            user_id=user_id,
            entity="Contact",
            entity_id=str(contact_id),
            old_data=old_data,
            new_data={
                "erased_fields": erased_fields,
                "messages_redacted": messages_redacted,
                "erased_at": now.isoformat(),
            },
        )

        logger.info(
            "lgpd_data_erased",
            contact_id=str(contact_id),
            tenant_id=str(tenant_id),
            erased_fields=erased_fields,
            messages_redacted=messages_redacted,
        )

        return {
            "contact_id": str(contact_id),
            "erased_fields": erased_fields,
            "messages_redacted": messages_redacted,
            "erased_at": now,
        }

    # ------------------------------------------------------------------
    # cleanup_expired_data
    # ------------------------------------------------------------------

    async def cleanup_expired_data(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> dict:
        """Anonymise contacts whose last activity exceeds the tenant retention period.

        Last activity is determined by the contact's updated_at timestamp
        or the most recent conversation last_message_at, whichever is later.
        """
        # Fetch tenant retention setting
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            raise NotFoundError(f"Tenant {tenant_id} not found")

        retention_days = getattr(tenant, "data_retention_days", None) or 365
        cutoff = datetime.now(UTC) - timedelta(days=retention_days)

        # Find contacts with no activity since the cutoff.
        # Exclude already-erased contacts.
        expired_result = await db.execute(
            select(Contact).where(
                Contact.tenant_id == tenant_id,
                Contact.updated_at < cutoff,
                Contact.consent_status != "ERASED",
            )
        )
        expired_contacts = expired_result.scalars().all()

        # Further filter: check if any conversation has recent activity
        contacts_to_erase: list[Contact] = []
        for contact in expired_contacts:
            latest_conv = await db.execute(
                select(func.max(Conversation.last_message_at)).where(
                    Conversation.tenant_id == tenant_id,
                    Conversation.contact_id == contact.id,
                )
            )
            last_activity = latest_conv.scalar_one_or_none()
            if last_activity is None or last_activity < cutoff:
                contacts_to_erase.append(contact)

        total_contacts_anonymized = 0
        total_messages_redacted = 0

        for contact in contacts_to_erase:
            result = await self.erase_contact_data(
                db=db,
                tenant_id=tenant_id,
                contact_id=contact.id,
            )
            total_contacts_anonymized += 1
            total_messages_redacted += result.get("messages_redacted", 0)

        await audit_log_service.log(
            db=db,
            tenant_id=tenant_id,
            action="LGPD_RETENTION_CLEANUP",
            entity="Tenant",
            entity_id=str(tenant_id),
            metadata={
                "retention_days": retention_days,
                "cutoff_date": cutoff.isoformat(),
                "contacts_anonymized": total_contacts_anonymized,
                "messages_redacted": total_messages_redacted,
            },
        )

        logger.info(
            "lgpd_retention_cleanup",
            tenant_id=str(tenant_id),
            retention_days=retention_days,
            contacts_anonymized=total_contacts_anonymized,
            messages_redacted=total_messages_redacted,
        )

        return {
            "contacts_anonymized": total_contacts_anonymized,
            "messages_redacted": total_messages_redacted,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _get_contact(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        contact_id: uuid.UUID,
    ) -> Contact:
        """Fetch a contact scoped to tenant_id, raising NotFoundError if absent."""
        result = await db.execute(
            select(Contact).where(
                Contact.tenant_id == tenant_id,
                Contact.id == contact_id,
            )
        )
        contact = result.scalar_one_or_none()
        if not contact:
            raise NotFoundError(f"Contact {contact_id} not found")
        return contact


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

lgpd_service = LGPDService()
