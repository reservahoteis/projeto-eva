"""Conversations API router — /api/v1/conversations.

All endpoints require a valid Bearer JWT (get_current_user) and resolve the
calling user's tenant automatically (get_tenant_id — populated by
get_current_user via request.state).

Endpoint map:
  GET    /                         list_conversations    — paginated, role-filtered
  GET    /stats                    get_conversation_stats
  POST   /                         create_conversation
  GET    /{id}                     get_conversation
  PATCH  /{id}                     update_conversation
  POST   /{id}/assign              assign_conversation
  POST   /{id}/close               close_conversation
  PATCH  /{id}/ia-lock             toggle_ia_lock
  GET    /{id}/messages            list_messages         — cursor-paginated
  POST   /{id}/messages            create_message

The `filters` query param is a JSON-encoded dict, e.g.:
  GET /api/v1/conversations?filters={"channel":"WHATSAPP"}
FastAPI does not natively parse nested JSON from query strings, so we use a
custom dependency (_parse_filters) that reads the raw `filters` string and
decodes it before constructing the ConversationListParams.
"""

from __future__ import annotations

import json
import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id, require_roles
from app.core.exceptions import BadRequestError
from app.models.user import User
from app.schemas.conversation import (
    AssignConversationRequest,
    ConversationCreate,
    ConversationListItem,
    ConversationListParams,
    ConversationResponse,
    ConversationStats,
    ConversationUpdate,
    PaginatedResponse,
)
from app.schemas.message import (
    IaLockRequest,
    MessageCreate,
    MessageCursorResponse,
    MessageListParams,
    MessageResponse,
)
from app.services.conversation_service import conversation_service
from app.services.message_service import message_service

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
    """Parse an optional JSON-encoded filters query parameter."""
    if not filters:
        return None
    try:
        parsed = json.loads(filters)
    except json.JSONDecodeError as exc:
        raise BadRequestError(f"Invalid JSON in 'filters' parameter: {exc}") from exc
    if not isinstance(parsed, dict):
        raise BadRequestError("'filters' must be a JSON object")
    return parsed


# ---------------------------------------------------------------------------
# Dependency: build ConversationListParams from individual query-string args.
# ---------------------------------------------------------------------------


def _conversation_list_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    order_by: str = Query("last_message_at desc"),
    search: str | None = Query(None, max_length=200),
    status: str | None = Query(None),
    priority: str | None = Query(None),
    channel: str | None = Query(None),
    assigned_to_id: uuid.UUID | None = Query(None),
    hotel_unit: str | None = Query(None, max_length=100),
    is_opportunity: bool | None = Query(None),
    ia_locked: bool | None = Query(None),
    parsed_filters: dict[str, Any] | None = Depends(_parse_filters),
) -> ConversationListParams:
    return ConversationListParams(
        page=page,
        page_size=page_size,
        order_by=order_by,
        search=search,
        status=status,
        priority=priority,
        channel=channel,
        assigned_to_id=assigned_to_id,
        hotel_unit=hotel_unit,
        is_opportunity=is_opportunity,
        ia_locked=ia_locked,
        filters=parsed_filters,
    )


ListParams = Annotated[ConversationListParams, Depends(_conversation_list_params)]


# ---------------------------------------------------------------------------
# Dependency: build MessageListParams for cursor-paginated message queries.
# ---------------------------------------------------------------------------


def _message_list_params(
    cursor: str | None = Query(None, description="Opaque cursor (last seen message UUID)"),
    limit: int = Query(50, ge=1, le=100),
    direction: str | None = Query(None),
) -> MessageListParams:
    return MessageListParams(cursor=cursor, limit=limit, direction=direction)


MsgListParams = Annotated[MessageListParams, Depends(_message_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list conversations
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List conversations",
    description=(
        "Returns a paginated, role-filtered list of Conversations for the calling user's tenant. "
        "ADMIN roles see all conversations; HEAD sees their hotel_unit; "
        "ATTENDANT sees assigned or same unit; SALES sees opportunity conversations only. "
        "Use `search` for contact name/phone. Use `filters` (JSON dict) for column equality. "
        "Use `order_by` for sorting (comma-separated 'field dir' tokens)."
    ),
    response_model=PaginatedResponse[ConversationListItem],
    status_code=status.HTTP_200_OK,
)
async def list_conversations(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    params: ListParams,
) -> PaginatedResponse[ConversationListItem]:
    return await conversation_service.list_conversations(
        db=db,
        tenant_id=tenant_id,
        user_role=current_user.role,
        user_id=current_user.id,
        user_hotel_unit=getattr(current_user, "hotel_unit", None),
        params=params,
    )


# ---------------------------------------------------------------------------
# GET /stats  — conversation statistics
# ---------------------------------------------------------------------------


@router.get(
    "/stats",
    summary="Conversation statistics",
    description=(
        "Returns aggregated conversation counts (by status, channel, priority) "
        "for dashboard widgets. Role-based scoping mirrors list_conversations."
    ),
    response_model=ConversationStats,
    status_code=status.HTTP_200_OK,
)
async def get_conversation_stats(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ConversationStats:
    return await conversation_service.get_conversation_stats(
        db=db,
        tenant_id=tenant_id,
        user_role=current_user.role,
        user_id=current_user.id,
        user_hotel_unit=getattr(current_user, "hotel_unit", None),
    )


# ---------------------------------------------------------------------------
# POST /  — create conversation
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create a conversation",
    description="Open a new Conversation for a contact. Channel defaults to WHATSAPP.",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: ConversationCreate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ConversationResponse:
    conversation = await conversation_service.create_conversation(
        db=db,
        tenant_id=tenant_id,
        data=payload,
    )
    return ConversationResponse.model_validate(conversation)


# ---------------------------------------------------------------------------
# GET /{conversation_id}  — get conversation detail
# ---------------------------------------------------------------------------


@router.get(
    "/{conversation_id}",
    summary="Get conversation detail",
    description=(
        "Return the full Conversation object including nested contact, assigned user, and tags. "
        "ATTENDANT access is enforced: the conversation must be assigned to the user or in their hotel_unit."
    ),
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ConversationResponse:
    conversation = await conversation_service.get_conversation(
        db=db,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        user_role=current_user.role,
        user_id=current_user.id,
        user_hotel_unit=getattr(current_user, "hotel_unit", None),
    )
    return ConversationResponse.model_validate(conversation)


# ---------------------------------------------------------------------------
# PATCH /{conversation_id}  — update conversation
# ---------------------------------------------------------------------------


@router.patch(
    "/{conversation_id}",
    summary="Update a conversation",
    description=(
        "Partial update — only non-null fields in the request body are applied. "
        "Setting status=CLOSED automatically records closed_at."
    ),
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
)
async def update_conversation(
    conversation_id: uuid.UUID,
    payload: ConversationUpdate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ConversationResponse:
    conversation = await conversation_service.update_conversation(
        db=db,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        data=payload,
    )
    return ConversationResponse.model_validate(conversation)


# ---------------------------------------------------------------------------
# POST /{conversation_id}/assign  — assign conversation to a user
# ---------------------------------------------------------------------------


@router.post(
    "/{conversation_id}/assign",
    summary="Assign conversation to a user",
    description=(
        "Assign a conversation to the specified user. "
        "Transitions status OPEN or BOT_HANDLING → IN_PROGRESS automatically."
    ),
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
)
async def assign_conversation(
    conversation_id: uuid.UUID,
    payload: AssignConversationRequest,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ConversationResponse:
    conversation = await conversation_service.assign_conversation(
        db=db,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        user_id=payload.assigned_to_id,
    )
    return ConversationResponse.model_validate(conversation)


# ---------------------------------------------------------------------------
# POST /{conversation_id}/close  — close conversation
# ---------------------------------------------------------------------------


@router.post(
    "/{conversation_id}/close",
    summary="Close a conversation",
    description="Mark the conversation as CLOSED and record the closed_at timestamp.",
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
)
async def close_conversation(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ConversationResponse:
    conversation = await conversation_service.close_conversation(
        db=db,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    return ConversationResponse.model_validate(conversation)


# ---------------------------------------------------------------------------
# PATCH /{conversation_id}/ia-lock  — toggle AI lock
# ---------------------------------------------------------------------------


@router.patch(
    "/{conversation_id}/ia-lock",
    summary="Toggle AI lock on a conversation",
    description=(
        "Set or clear the ia_locked flag. When locked=true the AI will not "
        "process incoming messages for this conversation."
    ),
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
)
async def toggle_ia_lock(
    conversation_id: uuid.UUID,
    payload: IaLockRequest,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> ConversationResponse:
    conversation = await conversation_service.toggle_ia_lock(
        db=db,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        locked=payload.locked,
    )
    return ConversationResponse.model_validate(conversation)


# ---------------------------------------------------------------------------
# GET /{conversation_id}/messages  — list messages (cursor pagination)
# ---------------------------------------------------------------------------


@router.get(
    "/{conversation_id}/messages",
    summary="List messages for a conversation",
    description=(
        "Returns cursor-paginated messages in chronological order (oldest → newest). "
        "Omit `cursor` to get the most recent page. Pass the returned `next_cursor` "
        "value as `cursor` in the next request to load older messages."
    ),
    response_model=MessageCursorResponse,
    status_code=status.HTTP_200_OK,
)
async def list_messages(
    conversation_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    params: MsgListParams,
) -> MessageCursorResponse:
    return await message_service.list_messages(
        db=db,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        params=params,
    )


# ---------------------------------------------------------------------------
# POST /{conversation_id}/messages  — send message
# ---------------------------------------------------------------------------


@router.post(
    "/{conversation_id}/messages",
    summary="Send a message in a conversation",
    description=(
        "Create an OUTBOUND message record for this conversation. "
        "The sender_name is derived from the calling user's name."
    ),
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> MessageResponse:
    message = await message_service.create_message(
        db=db,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        data=payload,
        direction="OUTBOUND",
        sender_name=getattr(current_user, "name", None),
    )
    return MessageResponse.model_validate(message)
