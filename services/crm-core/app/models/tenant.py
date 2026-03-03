import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Identity
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)

    # Subscription
    plan: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="ACTIVE"
    )

    # Branding
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # WhatsApp Cloud API
    whatsapp_phone_number_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    whatsapp_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    whatsapp_verify_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    whatsapp_webhook_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Instagram
    instagram_page_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    instagram_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Messenger
    messenger_page_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    messenger_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Billing (Stripe)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Localisation
    currency: Mapped[str | None] = mapped_column(String(10), nullable=True, server_default="BRL")
    timezone: Mapped[str | None] = mapped_column(String(50), nullable=True, server_default="America/Sao_Paulo")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Tenant id={self.id} slug={self.slug!r} plan={self.plan} status={self.status}>"
