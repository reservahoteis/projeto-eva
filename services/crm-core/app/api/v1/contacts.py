"""Contacts API router — /api/v1/contacts.

All endpoints require a valid Bearer JWT (get_current_user) and resolve the
calling user's tenant automatically (get_tenant_id — populated by
get_current_user via request.state).

Endpoint map:
  GET    /                            list_contacts           — paginated list (supports limit/sortBy/sortOrder)
  GET    /stats                       get_contact_stats       — aggregated counts
  GET    /phone/{phone_number}        get_contact_by_phone    — look up by mobile_no
  POST   /                            create_contact          — accepts camelCase field names
  GET    /{contact_id}                get_contact
  PUT    /{contact_id}                update_contact          — accepts camelCase field names
  PATCH  /{contact_id}                patch_contact           — alias for PUT
  GET    /{contact_id}/conversations  get_contact_conversations — conversations for a contact
  GET    /{contact_id}/deals          list_contact_deals      — deals linked to this contact
  DELETE /{contact_id}                delete_contact
  POST   /bulk-delete                 bulk_delete_contacts

Route ordering note:
  /stats and /phone/{phone_number} are registered BEFORE /{contact_id} to prevent
  FastAPI from trying to parse the literal strings "stats" or "phone" as a UUID.

The `filters` query param is a JSON-encoded dict, e.g.:
  GET /api/v1/contacts?filters={"industry_id":"uuid"}
FastAPI does not natively parse nested JSON from query strings, so we add a
custom dependency (_parse_filters) that reads the raw `filters` string and
decodes it before constructing the ContactListParams.
"""

from __future__ import annotations

import json
import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import emit_audit_log
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.core.exceptions import BadRequestError
from app.models.deal import Deal
from app.models.user import User
from app.schemas.contact import (
    BulkDeleteRequest,
    BulkDeleteResponse,
    ContactCreate,
    ContactListItem,
    ContactListParams,
    ContactResponse,
    ContactUpdate,
    PaginatedResponse,
    _normalize_sort_field,
)
from app.schemas.deal import DealListItem
from app.services.contact_service import contact_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Custom query-param dependency: parse JSON `filters` string
# ---------------------------------------------------------------------------


def _parse_filters(filters: str | None = Query(None)) -> dict[str, Any] | None:
    """Parse an optional JSON-encoded filters query parameter.

    Example usage in URL:
        GET /contacts?filters={"industry_id":"<uuid>","territory_id":"<uuid>"}
    """
    if not filters:
        return None
    try:
        parsed = json.loads(filters)
    except json.JSONDecodeError as exc:
        raise BadRequestError(f"Invalid JSON in 'filters' parameter: {exc}") from exc
    if not isinstance(parsed, dict):
        raise BadRequestError("'filters' must be a JSON object, e.g. {\"field\": \"value\"}")
    return parsed


# ---------------------------------------------------------------------------
# Dependency: build ContactListParams from individual query-string args.
# ---------------------------------------------------------------------------


def _contact_list_params(
    page: int = Query(1, ge=1),
    # Accept both page_size (snake_case) and limit (camelCase/frontend convention).
    # limit takes precedence when provided.
    page_size: int = Query(20, ge=1, le=200),
    limit: int | None = Query(None, ge=1, le=200, description="Alias for page_size"),
    order_by: str = Query("created_at desc"),
    # Frontend sends individual sortBy + sortOrder instead of combined order_by
    sort_by: str | None = Query(None, alias="sortBy", description="Field to sort by (camelCase or snake_case)"),
    sort_order: str | None = Query(None, alias="sortOrder", description="Sort direction: asc or desc"),
    search: str | None = Query(None, max_length=200),
    parsed_filters: dict[str, Any] | None = Depends(_parse_filters),
) -> ContactListParams:
    # Resolve page_size: limit alias takes precedence
    effective_page_size = limit if limit is not None else page_size

    # Resolve order_by: sortBy/sortOrder take precedence over combined order_by
    effective_order_by = order_by
    if sort_by:
        normalised_field = _normalize_sort_field(sort_by)
        direction = (sort_order or "asc").lower()
        if direction not in ("asc", "desc"):
            direction = "asc"
        effective_order_by = f"{normalised_field} {direction}"

    return ContactListParams(
        page=page,
        page_size=effective_page_size,
        order_by=effective_order_by,
        search=search,
        filters=parsed_filters,
    )


ListParams = Annotated[ContactListParams, Depends(_contact_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list contacts
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List contacts",
    description=(
        "Returns a paginated list of Contacts. "
        "Use `search` for full-text search across first_name, last_name, email, "
        "and company_name. "
        "Use `filters` (JSON dict) to narrow results by any Contact field. "
        "Use `order_by` for multi-column sorting (comma-separated 'field dir' tokens)."
    ),
    response_model=PaginatedResponse[ContactListItem],
    status_code=status.HTTP_200_OK,
)
async def list_contacts(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    params: ListParams,
):
    return await contact_service.list_contacts(db, tenant_id, params)


# ---------------------------------------------------------------------------
# GET /stats  — contact statistics
# ---------------------------------------------------------------------------


@router.get(
    "/stats",
    summary="Contact statistics",
    description="Returns aggregated contact counts for dashboard widgets.",
    status_code=status.HTTP_200_OK,
)
async def get_contact_stats(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> dict:
    from sqlalchemy import func

    from app.models.contact import Contact
    from app.models.conversation import Conversation

    total_result = await db.execute(
        select(func.count()).select_from(Contact).where(Contact.tenant_id == tenant_id)
    )
    total = total_result.scalar_one()

    with_conversations_result = await db.execute(
        select(func.count(func.distinct(Conversation.contact_id)))
        .select_from(Conversation)
        .where(Conversation.tenant_id == tenant_id, Conversation.contact_id.isnot(None))
    )
    with_conversations = with_conversations_result.scalar_one()

    recent_result = await db.execute(
        select(Contact)
        .where(Contact.tenant_id == tenant_id)
        .order_by(Contact.created_at.desc())
        .limit(5)
    )
    recent_contacts = recent_result.scalars().all()

    from datetime import datetime, timezone

    return {
        "total": total,
        "withConversations": with_conversations,
        "withoutConversations": total - with_conversations,
        "recentContacts": [
            ContactListItem.model_validate(c).model_dump(mode="json")
            for c in recent_contacts
        ],
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# GET /phone/{phone_number}  — look up a contact by phone number
# IMPORTANT: Must be registered BEFORE /{contact_id} to avoid UUID parse error.
# ---------------------------------------------------------------------------


@router.get(
    "/phone/{phone_number}",
    summary="Get contact by phone number",
    description=(
        "Look up a single Contact by mobile_no.  Useful for linking incoming "
        "WhatsApp / messaging events to an existing Contact record."
    ),
    response_model=ContactResponse,
    status_code=status.HTTP_200_OK,
)
async def get_contact_by_phone(
    phone_number: str,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ContactResponse:
    from app.core.exceptions import NotFoundError

    contact = await contact_service.get_by_phone(db, tenant_id, phone_number)
    if not contact:
        raise NotFoundError(f"Contact with phone {phone_number!r} not found")
    return ContactResponse.model_validate(contact)


# ---------------------------------------------------------------------------
# POST /  — create contact
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create a contact",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_contact(
    payload: ContactCreate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    request: Request,
) -> ContactResponse:
    contact = await contact_service.create_contact(
        db=db,
        tenant_id=tenant_id,
        data=payload,
    )
    result = ContactResponse.model_validate(contact)
    await emit_audit_log(
        db=db,
        tenant_id=tenant_id,
        action="CONTACT_CREATED",
        entity="Contact",
        entity_id=str(contact.id),
        user_id=current_user.id,
        request=request,
        new_data=result.model_dump(mode="json"),
    )
    return result


# ---------------------------------------------------------------------------
# GET /{contact_id}  — get contact detail
# ---------------------------------------------------------------------------


@router.get(
    "/{contact_id}",
    summary="Get contact detail",
    response_model=ContactResponse,
    status_code=status.HTTP_200_OK,
)
async def get_contact(
    contact_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ContactResponse:
    contact = await contact_service.get_contact(db, tenant_id, contact_id)
    return ContactResponse.model_validate(contact)


# ---------------------------------------------------------------------------
# PUT /{contact_id}  — update contact
# ---------------------------------------------------------------------------


@router.put(
    "/{contact_id}",
    summary="Update a contact",
    description="Partial update — only non-null fields in the request body are applied.",
    response_model=ContactResponse,
    status_code=status.HTTP_200_OK,
)
async def update_contact(
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    request: Request,
) -> ContactResponse:
    old = await contact_service.get_contact(db, tenant_id, contact_id)
    old_snapshot = ContactResponse.model_validate(old).model_dump(mode="json")
    contact = await contact_service.update_contact(
        db=db,
        tenant_id=tenant_id,
        contact_id=contact_id,
        data=payload,
    )
    result = ContactResponse.model_validate(contact)
    await emit_audit_log(
        db=db,
        tenant_id=tenant_id,
        action="CONTACT_UPDATED",
        entity="Contact",
        entity_id=str(contact_id),
        user_id=current_user.id,
        request=request,
        old_data=old_snapshot,
        new_data=result.model_dump(mode="json"),
    )
    return result


# ---------------------------------------------------------------------------
# PATCH /{contact_id}  — partial update contact (same logic as PUT)
# ---------------------------------------------------------------------------


@router.patch(
    "/{contact_id}",
    summary="Partially update a contact",
    description="Same as PUT — only non-null fields in the request body are applied.",
    response_model=ContactResponse,
    status_code=status.HTTP_200_OK,
)
async def patch_contact(
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    request: Request,
) -> ContactResponse:
    old = await contact_service.get_contact(db, tenant_id, contact_id)
    old_snapshot = ContactResponse.model_validate(old).model_dump(mode="json")
    contact = await contact_service.update_contact(
        db=db,
        tenant_id=tenant_id,
        contact_id=contact_id,
        data=payload,
    )
    result = ContactResponse.model_validate(contact)
    await emit_audit_log(
        db=db,
        tenant_id=tenant_id,
        action="CONTACT_UPDATED",
        entity="Contact",
        entity_id=str(contact_id),
        user_id=current_user.id,
        request=request,
        old_data=old_snapshot,
        new_data=result.model_dump(mode="json"),
    )
    return result


# ---------------------------------------------------------------------------
# GET /{contact_id}/conversations  — list conversations for a contact
# ---------------------------------------------------------------------------


@router.get(
    "/{contact_id}/conversations",
    summary="List conversations linked to a contact",
    description=(
        "Returns a paginated list of Conversations where contact_id matches "
        "this Contact.  Scoped to the calling user's tenant."
    ),
    status_code=status.HTTP_200_OK,
)
async def get_contact_conversations(
    contact_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
) -> dict:
    from sqlalchemy import func

    from app.models.conversation import Conversation

    # Verify the contact exists and belongs to this tenant first.
    await contact_service.get_contact(db, tenant_id, contact_id)

    base_stmt = (
        select(Conversation)
        .where(
            Conversation.tenant_id == tenant_id,
            Conversation.contact_id == contact_id,
        )
        .order_by(Conversation.last_message_at.desc().nullslast())
    )

    count_stmt = (
        select(func.count())
        .select_from(Conversation)
        .where(
            Conversation.tenant_id == tenant_id,
            Conversation.contact_id == contact_id,
        )
    )

    total_result = await db.execute(count_stmt)
    total_count = total_result.scalar_one()

    offset = (page - 1) * limit
    rows = await db.execute(base_stmt.offset(offset).limit(limit))
    conversations = rows.scalars().all()

    # Return a lightweight dict compatible with PaginatedResponse envelope
    return {
        "data": [
            {
                "id": str(c.id),
                "status": c.status,
                "channel": c.channel,
                "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
                "created_at": c.created_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
                "ia_locked": c.ia_locked,
                "is_opportunity": c.is_opportunity,
            }
            for c in conversations
        ],
        "total_count": total_count,
        "page": page,
        "page_size": limit,
    }


# ---------------------------------------------------------------------------
# DELETE /{contact_id}  — delete contact
# ---------------------------------------------------------------------------


@router.delete(
    "/{contact_id}",
    summary="Delete a contact",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_contact(
    contact_id: uuid.UUID,
    db: DB,
    tenant_id: TenantId,
    request: Request,
    current_user: User = Depends(require_roles("SUPER_ADMIN", "TENANT_ADMIN", "HEAD", "SALES_MANAGER")),
):
    await contact_service.delete_contact(db, tenant_id, contact_id)
    await emit_audit_log(
        db=db,
        tenant_id=tenant_id,
        action="CONTACT_DELETED",
        entity="Contact",
        entity_id=str(contact_id),
        user_id=current_user.id,
        request=request,
    )


# ---------------------------------------------------------------------------
# GET /{contact_id}/deals  — list deals linked to this contact
# ---------------------------------------------------------------------------


@router.get(
    "/{contact_id}/deals",
    summary="List deals linked to a contact",
    description=(
        "Returns a paginated list of Deals where contact_id matches this Contact. "
        "Scoped to the calling user's tenant."
    ),
    response_model=PaginatedResponse[DealListItem],
    status_code=status.HTTP_200_OK,
)
async def list_contact_deals(
    contact_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
) -> PaginatedResponse[DealListItem]:
    # Verify the contact exists and belongs to this tenant first.
    await contact_service.get_contact(db, tenant_id, contact_id)

    from sqlalchemy import func

    base_stmt = (
        select(Deal)
        .where(
            Deal.tenant_id == tenant_id,
            Deal.contact_id == contact_id,
        )
        .options(
            selectinload(Deal.status),
            selectinload(Deal.deal_owner),
        )
        .order_by(Deal.created_at.desc())
    )

    count_stmt = (
        select(func.count())
        .select_from(Deal)
        .where(
            Deal.tenant_id == tenant_id,
            Deal.contact_id == contact_id,
        )
    )

    total_result = await db.execute(count_stmt)
    total_count = total_result.scalar_one()

    offset = (page - 1) * page_size
    rows = await db.execute(base_stmt.offset(offset).limit(page_size))
    deals = rows.scalars().all()

    return PaginatedResponse[DealListItem](
        data=[DealListItem.model_validate(deal) for deal in deals],
        total_count=total_count,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# POST /bulk-delete  — bulk delete contacts
# ---------------------------------------------------------------------------


@router.post(
    "/bulk-delete",
    summary="Bulk delete contacts",
    description=(
        "Delete up to 500 contacts in a single request. "
        "Returns the count of contacts that were actually deleted "
        "(IDs not belonging to this tenant are silently skipped)."
    ),
    response_model=BulkDeleteResponse,
    status_code=status.HTTP_200_OK,
)
async def bulk_delete_contacts(
    body: BulkDeleteRequest,
    db: DB,
    tenant_id: TenantId,
    request: Request,
    current_user: User = Depends(require_roles("SUPER_ADMIN", "TENANT_ADMIN", "HEAD", "SALES_MANAGER")),
) -> BulkDeleteResponse:
    deleted_count = await contact_service.bulk_delete(
        db=db,
        tenant_id=tenant_id,
        contact_ids=body.ids,
    )
    await emit_audit_log(
        db=db,
        tenant_id=tenant_id,
        action="CONTACT_BULK_DELETED",
        entity="Contact",
        user_id=current_user.id,
        request=request,
        new_data={"ids": [str(i) for i in body.ids], "deleted_count": deleted_count},
    )
    return BulkDeleteResponse(deleted_count=deleted_count)
