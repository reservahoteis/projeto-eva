"""FastAPI router for the Note resource — /api/v1/notes.

All endpoints require a valid Bearer JWT (get_current_user) and resolve the
calling user's tenant automatically (get_tenant_id — populated by
get_current_user via request.state).

Endpoint map:
  GET    /              list_notes       — paginated, filter by reference entity
  POST   /              create_note
  GET    /{note_id}     get_note
  PUT    /{note_id}     update_note
  DELETE /{note_id}     delete_note
  POST   /bulk-delete   bulk_delete_notes

The primary usage pattern for the list endpoint is fetching all notes
attached to a specific CRM entity:

  GET /api/v1/notes?reference_doctype=Lead&reference_docname=<uuid>

Omitting both filter fields returns all notes for the tenant (paginated,
newest first).
"""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id
from app.models.user import User
from app.schemas.lead import PaginatedResponse
from app.schemas.note import (
    NoteBulkDeleteRequest,
    NoteBulkDeleteResponse,
    NoteCreate,
    NoteListItem,
    NoteListParams,
    NoteResponse,
    NoteUpdate,
)
from app.services.note_service import note_service

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# Common dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Dependency: build NoteListParams from individual query-string args
# ---------------------------------------------------------------------------


def _note_list_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    reference_doctype: str | None = Query(
        None,
        description="Lead | Deal | Contact | Organization",
    ),
    reference_docname: uuid.UUID | None = Query(
        None,
        description="PK of the referenced document",
    ),
) -> NoteListParams:
    return NoteListParams(
        page=page,
        page_size=page_size,
        reference_doctype=reference_doctype,
        reference_docname=reference_docname,
    )


ListParams = Annotated[NoteListParams, Depends(_note_list_params)]


# ---------------------------------------------------------------------------
# GET /  — list notes
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List notes",
    description=(
        "Returns a paginated list of notes for the tenant. "
        "Filter by reference entity using reference_doctype and reference_docname. "
        "Example: GET /notes?reference_doctype=Lead&reference_docname=<uuid> "
        "returns all notes attached to a specific Lead, newest first."
    ),
    response_model=PaginatedResponse[NoteListItem],
    status_code=status.HTTP_200_OK,
)
async def list_notes(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    params: ListParams,
):
    return await note_service.list_notes(db, tenant_id, params)


# ---------------------------------------------------------------------------
# POST /  — create note
# ---------------------------------------------------------------------------


@router.post(
    "/",
    summary="Create a note",
    description=(
        "Creates a note scoped to the authenticated user's tenant. "
        "Optionally link the note to a CRM entity via reference_doctype + "
        "reference_docname. The created_by field is always set from the "
        "authenticated user — it cannot be overridden by the client."
    ),
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_note(
    payload: NoteCreate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> NoteResponse:
    note = await note_service.create_note(
        db=db,
        tenant_id=tenant_id,
        data=payload,
        user_id=current_user.id,
    )
    return NoteResponse.model_validate(note)


# ---------------------------------------------------------------------------
# GET /{note_id}  — get note detail
# ---------------------------------------------------------------------------


@router.get(
    "/{note_id}",
    summary="Get note detail",
    response_model=NoteResponse,
    status_code=status.HTTP_200_OK,
)
async def get_note(
    note_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> NoteResponse:
    note = await note_service.get_note(db, tenant_id, note_id)
    return NoteResponse.model_validate(note)


# ---------------------------------------------------------------------------
# PUT /{note_id}  — update note
# ---------------------------------------------------------------------------


@router.put(
    "/{note_id}",
    summary="Update a note",
    description=(
        "Partial update — only non-null fields in the request body are applied. "
        "Only title and content are mutable after creation."
    ),
    response_model=NoteResponse,
    status_code=status.HTTP_200_OK,
)
async def update_note(
    note_id: uuid.UUID,
    payload: NoteUpdate,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> NoteResponse:
    note = await note_service.update_note(
        db=db,
        tenant_id=tenant_id,
        note_id=note_id,
        data=payload,
        user_id=current_user.id,
    )
    return NoteResponse.model_validate(note)


# ---------------------------------------------------------------------------
# DELETE /{note_id}  — delete note
# ---------------------------------------------------------------------------


@router.delete(
    "/{note_id}",
    summary="Delete a note",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_note(
    note_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> None:
    await note_service.delete_note(db, tenant_id, note_id)


# ---------------------------------------------------------------------------
# POST /bulk-delete  — bulk delete notes
# ---------------------------------------------------------------------------


@router.post(
    "/bulk-delete",
    summary="Bulk delete notes",
    description=(
        "Delete up to 500 notes in a single request. "
        "Returns the count of notes that were actually deleted "
        "(IDs not belonging to this tenant are silently skipped)."
    ),
    response_model=NoteBulkDeleteResponse,
    status_code=status.HTTP_200_OK,
)
async def bulk_delete_notes(
    body: NoteBulkDeleteRequest,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> NoteBulkDeleteResponse:
    deleted_count = await note_service.bulk_delete(
        db=db,
        tenant_id=tenant_id,
        note_ids=body.ids,
    )
    return NoteBulkDeleteResponse(deleted_count=deleted_count)
