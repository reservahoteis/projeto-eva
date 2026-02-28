import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
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
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Subscription
    plan: Mapped[str] = mapped_column(
        String(20), nullable=False, default="BASIC"
    )  # BASIC | PRO | ENTERPRISE
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="TRIAL"
    )  # TRIAL | ACTIVE | SUSPENDED | CANCELLED

    # Localisation
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="BRL")
    timezone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    date_format: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # WhatsApp Cloud API
    whatsapp_phone_number_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    whatsapp_business_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    whatsapp_access_token: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Meta Messenger / Instagram
    messenger_page_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    messenger_page_access_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    instagram_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # N8N Automation
    n8n_api_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    n8n_webhook_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Billing (Stripe)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Limits
    max_attendants: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Tenant id={self.id} slug={self.slug!r} plan={self.plan} status={self.status}>"
