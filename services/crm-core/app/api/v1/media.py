"""Media API router — /api/v1/media.

Endpoints:
  POST /upload  — upload a media file (image, video, audio, document)
  GET  /{media_id}  — retrieve media file metadata
"""

from __future__ import annotations

import hashlib
import os
import uuid
from pathlib import Path
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_id
from app.core.exceptions import BadRequestError, NotFoundError
from app.models.media_file import MediaFile
from app.models.user import User

logger = structlog.get_logger()

router = APIRouter()

CurrentUser = Annotated[User, Depends(get_current_user)]
TenantId = Annotated[uuid.UUID, Depends(get_tenant_id)]
DB = Annotated[AsyncSession, Depends(get_db)]

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

UPLOAD_DIR = Path(os.getenv("MEDIA_UPLOAD_DIR", "/app/uploads"))
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

MIME_TO_MEDIA_TYPE: dict[str, str] = {
    "image/jpeg": "image",
    "image/png": "image",
    "image/gif": "image",
    "image/webp": "image",
    "video/mp4": "video",
    "video/3gpp": "video",
    "video/quicktime": "video",
    "audio/mpeg": "audio",
    "audio/ogg": "audio",
    "audio/opus": "audio",
    "audio/wav": "audio",
    "audio/amr": "audio",
    "application/pdf": "document",
    "application/msword": "document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/vnd.ms-excel": "document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
    "text/plain": "document",
    "text/csv": "document",
}


# ---------------------------------------------------------------------------
# POST /upload  — upload media file
# ---------------------------------------------------------------------------


@router.post(
    "/upload",
    summary="Upload a media file",
    description="Upload an image, video, audio, or document. Returns the file URL and metadata.",
    status_code=status.HTTP_201_CREATED,
)
async def upload_media(
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
    file: UploadFile = File(...),
) -> dict:
    if not file.filename:
        raise BadRequestError("File must have a filename")

    content_type = file.content_type or "application/octet-stream"
    media_type = MIME_TO_MEDIA_TYPE.get(content_type, "document")

    # Read file content
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE:
        raise BadRequestError(f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB")

    if file_size == 0:
        raise BadRequestError("File is empty")

    # Generate unique path
    file_id = uuid.uuid4()
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    tenant_dir = UPLOAD_DIR / str(tenant_id)
    tenant_dir.mkdir(parents=True, exist_ok=True)

    file_name = f"{file_id}{ext}"
    file_path = tenant_dir / file_name
    relative_path = f"{tenant_id}/{file_name}"

    # Write to disk
    file_path.write_bytes(content)

    # Compute checksum
    checksum = hashlib.sha256(content).hexdigest()

    # Save to DB
    media = MediaFile(
        id=file_id,
        tenant_id=tenant_id,
        file_name=file.filename,
        file_path=relative_path,
        mime_type=content_type,
        file_size=file_size,
        media_type=media_type,
        checksum=checksum,
    )
    db.add(media)
    await db.flush()

    logger.info(
        "media_uploaded",
        media_id=str(file_id),
        tenant_id=str(tenant_id),
        media_type=media_type,
        file_size=file_size,
    )

    return {
        "id": str(file_id),
        "url": f"/api/v1/media/{file_id}",
        "file_name": file.filename,
        "mime_type": content_type,
        "media_type": media_type,
        "file_size": file_size,
    }


# ---------------------------------------------------------------------------
# GET /{media_id}  — get media metadata
# ---------------------------------------------------------------------------


@router.get(
    "/{media_id}",
    summary="Get media file metadata",
    status_code=status.HTTP_200_OK,
)
async def get_media(
    media_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    tenant_id: TenantId,
) -> dict:
    from sqlalchemy import select

    result = await db.execute(
        select(MediaFile).where(
            MediaFile.id == media_id,
            MediaFile.tenant_id == tenant_id,
        )
    )
    media = result.scalar_one_or_none()
    if not media:
        raise NotFoundError(f"Media {media_id} not found")

    return {
        "id": str(media.id),
        "url": f"/api/v1/media/{media.id}",
        "file_name": media.file_name,
        "mime_type": media.mime_type,
        "media_type": media.media_type,
        "file_size": media.file_size,
        "checksum": media.checksum,
        "created_at": str(media.created_at) if media.created_at else None,
    }
