from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantBase


class Tag(TenantBase):
    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_tags_tenant_name"),
    )

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, server_default="#6B7280")

    def __repr__(self) -> str:
        return f"<Tag id={self.id} name={self.name!r} tenant_id={self.tenant_id}>"
