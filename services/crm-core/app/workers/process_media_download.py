"""ARQ task: download a media file from the channel and persist it locally.

Responsibilities
----------------
1. Validate the Message exists and belongs to the tenant.
2. Skip if media was already downloaded (``metadata_json.mediaUrl`` set).
3. Fetch the media download URL from the Meta Graph API (for WhatsApp).
4. Download the binary content.
5. Organise it on disk under ``{MEDIA_STORAGE_ROOT}/{tenant_id}/{YYYY-MM}/{type}/``.
6. Create a ``MediaFile`` row linked to the Message.
7. Update ``Message.metadata_json`` with the local URL so future queries
   can serve the file without re-fetching from Meta.

Storage layout
--------------
Files are stored at::

    {MEDIA_STORAGE_ROOT}/{tenant_id}/{YYYY-MM}/{media_type}/{filename}

The ``MEDIA_STORAGE_ROOT`` env var defaults to ``/var/media`` (suitable
for a Docker volume mount).  The HTTP-accessible URL is derived by
replacing the root prefix with ``settings.MEDIA_BASE_URL`` (e.g.
``https://api.botreserva.com.br/media``).

Why not base64/data URLs?
--------------------------
The Express worker (process-media-download.worker.ts) stored media as
base64 data URLs in the Message metadata JSON.  This approach has two
problems at scale:

1. Large images bloat the DB row (base64 is 33 % larger than binary).
2. JSON columns do not benefit from PostgreSQL compression when the value
   is already a data URL string.

CRM Core therefore saves binary files on disk (or a mounted volume) and
stores only the HTTP URL in metadata, mirroring how the Express worker
``downloadMediaAndSave`` function works when called from the incoming-
message worker.

Retry safety
------------
The task checks ``metadata_json.mediaUrl`` before downloading.  If the
file exists on disk but the DB row was not updated (crash after write),
the task re-creates the MediaFile row and re-updates the Message without
re-downloading.
"""

from __future__ import annotations

import hashlib
import mimetypes
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path

import httpx
import structlog
from sqlalchemy import select

from app.channels._http import build_client
from app.core.config import settings
from app.core.database import async_session
from app.models.media_file import MediaFile
from app.models.message import Message
from app.models.tenant import Tenant

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Storage configuration
# ---------------------------------------------------------------------------

MEDIA_STORAGE_ROOT: str = os.environ.get("MEDIA_STORAGE_ROOT", "/var/media")
MEDIA_BASE_URL: str = os.environ.get("MEDIA_BASE_URL", "https://api.botreserva.com.br/media")

# Max binary size we are willing to download (50 MB)
MAX_MEDIA_SIZE_BYTES: int = 50 * 1024 * 1024

# Mapping mime-type category → media_type label used in storage paths and DB
_MEDIA_TYPE_MAP: dict[str, str] = {
    "image": "image",
    "video": "video",
    "audio": "audio",
    "application": "document",
    "text": "document",
}


def _resolve_media_type(mime_type: str, hint: str = "image") -> str:
    """Return the canonical media_type string from a MIME type."""
    main_type = mime_type.split("/")[0].lower()
    return _MEDIA_TYPE_MAP.get(main_type, hint.lower())


def _guess_extension(mime_type: str) -> str:
    """Return a file extension for the given MIME type."""
    ext = mimetypes.guess_extension(mime_type.split(";")[0].strip())
    if ext:
        return ext  # e.g. ".jpg"
    # Manual fallbacks for common types that Python's mimetypes misses
    fallbacks: dict[str, str] = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
        "audio/ogg": ".ogg",
        "audio/mpeg": ".mp3",
        "application/pdf": ".pdf",
    }
    return fallbacks.get(mime_type.split(";")[0].strip(), ".bin")


# ---------------------------------------------------------------------------
# WhatsApp media download helpers
# ---------------------------------------------------------------------------


async def _fetch_whatsapp_media_url(
    phone_number_id: str,
    access_token: str,
    media_id: str,
) -> str:
    """Fetch the temporary CDN download URL for a WhatsApp media ID.

    Meta Graph API flow:
    1. GET /{media_id}?phone_number_id={phone_number_id}
       Returns JSON with ``url`` (expires in ~5 minutes).
    2. GET {url} with Authorization header → binary content.
    """
    graph_url = f"https://graph.facebook.com/v21.0/{media_id}"
    params = {"phone_number_id": phone_number_id}
    headers = {"Authorization": f"Bearer {access_token}"}

    async with build_client(timeout=15.0) as client:
        resp = await client.get(graph_url, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    download_url: str | None = data.get("url")
    if not download_url:
        raise RuntimeError(
            f"Meta Graph API returned no 'url' for media_id={media_id!r}: {data}"
        )
    return download_url


async def _download_binary(download_url: str, access_token: str) -> bytes:
    """Download raw binary content from the Meta CDN URL."""
    headers = {"Authorization": f"Bearer {access_token}"}

    async with build_client(timeout=60.0) as client:
        async with client.stream("GET", download_url, headers=headers) as response:
            response.raise_for_status()

            chunks: list[bytes] = []
            total = 0
            async for chunk in response.aiter_bytes(chunk_size=65536):
                total += len(chunk)
                if total > MAX_MEDIA_SIZE_BYTES:
                    raise RuntimeError(
                        f"Media file exceeds maximum allowed size ({MAX_MEDIA_SIZE_BYTES} bytes)"
                    )
                chunks.append(chunk)

    return b"".join(chunks)


# ---------------------------------------------------------------------------
# File system helpers
# ---------------------------------------------------------------------------


def _build_file_path(
    tenant_id: str,
    media_type: str,
    extension: str,
) -> tuple[Path, str]:
    """Return ``(absolute_path, relative_url_path)`` for the media file.

    Directory structure::

        {MEDIA_STORAGE_ROOT}/{tenant_id}/{YYYY-MM}/{media_type}/{uuid}{ext}
    """
    now = datetime.now(tz=UTC)
    month_dir = now.strftime("%Y-%m")
    file_name = f"{uuid.uuid4()}{extension}"

    relative_path = Path(tenant_id) / month_dir / media_type / file_name
    absolute_path = Path(MEDIA_STORAGE_ROOT) / relative_path

    return absolute_path, str(relative_path)


async def _save_file(path: Path, content: bytes) -> None:
    """Write ``content`` to ``path``, creating parent directories as needed.

    Uses asyncio.to_thread to avoid blocking the event loop on large files.
    """
    import asyncio

    def _write() -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    await asyncio.to_thread(_write)


def _build_public_url(relative_path: str) -> str:
    """Convert a relative storage path to the public HTTP URL."""
    # Normalise separators for URL construction
    url_path = relative_path.replace("\\", "/")
    return f"{MEDIA_BASE_URL.rstrip('/')}/{url_path}"


# ---------------------------------------------------------------------------
# Main task function
# ---------------------------------------------------------------------------


async def process_media_download(
    ctx: dict,
    *,
    tenant_id: str,
    message_id: str,
    media_id: str,
    media_type: str,
    mime_type: str,
    channel: str = "WHATSAPP",
) -> None:
    """ARQ task: download a media attachment and persist it.

    Parameters
    ----------
    ctx:
        ARQ context dict.
    tenant_id:
        UUID string of the owning tenant.
    message_id:
        UUID string of the Message row that contains this media.
    media_id:
        Platform-specific media identifier (e.g. WhatsApp media ID).
    media_type:
        One of: ``image``, ``video``, ``audio``, ``document``.
    mime_type:
        MIME type string (e.g. ``image/jpeg``, ``audio/ogg; codecs=opus``).
    channel:
        One of: ``WHATSAPP``, ``MESSENGER``, ``INSTAGRAM``.
        Only ``WHATSAPP`` is fully implemented; others are stubs.
    """
    job_id: str = ctx.get("job_id", "<unknown>")
    clean_mime = mime_type.split(";")[0].strip()
    log = logger.bind(
        job_id=job_id,
        tenant_id=tenant_id,
        message_id=message_id,
        media_id=media_id,
        media_type=media_type,
        mime_type=clean_mime,
        channel=channel,
    )

    log.info("process_media_download_start")

    try:
        tenant_uuid = uuid.UUID(tenant_id)
        message_uuid = uuid.UUID(message_id)
    except (ValueError, AttributeError) as exc:
        log.error("process_media_download_invalid_uuids", error=str(exc))
        return

    async with async_session() as db:
        try:
            # ------------------------------------------------------------------
            # 1. Load and validate the Message
            # ------------------------------------------------------------------
            msg_stmt = select(Message).where(
                Message.id == message_uuid,
                Message.tenant_id == tenant_uuid,
            )
            result = await db.execute(msg_stmt)
            message: Message | None = result.scalar_one_or_none()

            if message is None:
                log.error("process_media_download_message_not_found")
                return

            # ------------------------------------------------------------------
            # 2. Idempotency: skip if already downloaded
            # ------------------------------------------------------------------
            existing_meta: dict = message.metadata_json or {}
            if existing_meta.get("mediaUrl"):
                log.info(
                    "process_media_download_already_downloaded",
                    media_url=existing_meta["mediaUrl"],
                )
                return

            # ------------------------------------------------------------------
            # 3. Load Tenant credentials
            # ------------------------------------------------------------------
            tenant_stmt = select(Tenant).where(Tenant.id == tenant_uuid)
            tenant_result = await db.execute(tenant_stmt)
            tenant: Tenant | None = tenant_result.scalar_one_or_none()

            if tenant is None:
                log.error("process_media_download_tenant_not_found")
                return

            # ------------------------------------------------------------------
            # 4. Fetch download URL and download binary content
            # ------------------------------------------------------------------
            channel_upper = channel.upper()

            if channel_upper == "WHATSAPP":
                phone_number_id: str | None = getattr(tenant, "whatsapp_phone_number_id", None)
                access_token: str | None = getattr(tenant, "whatsapp_access_token", None)

                if not phone_number_id or not access_token:
                    raise ValueError(
                        "Tenant is missing WhatsApp credentials for media download"
                    )

                download_url = await _fetch_whatsapp_media_url(
                    phone_number_id, access_token, media_id
                )
                binary_content = await _download_binary(download_url, access_token)

            else:
                # Messenger / Instagram share the same token structure;
                # implement when those adapters are fully ported.
                log.warning(
                    "process_media_download_unsupported_channel",
                    channel=channel_upper,
                )
                return

            # ------------------------------------------------------------------
            # 5. Save to local storage
            # ------------------------------------------------------------------
            resolved_type = _resolve_media_type(clean_mime, media_type)
            extension = _guess_extension(clean_mime)
            abs_path, rel_path = _build_file_path(tenant_id, resolved_type, extension)

            await _save_file(abs_path, binary_content)

            file_size = len(binary_content)
            checksum = hashlib.sha256(binary_content).hexdigest()
            public_url = _build_public_url(rel_path)

            log.info(
                "process_media_download_file_saved",
                path=str(abs_path),
                file_size=file_size,
                public_url=public_url,
            )

            # ------------------------------------------------------------------
            # 6. Create MediaFile row
            # ------------------------------------------------------------------
            media_file = MediaFile(
                tenant_id=tenant_uuid,
                message_id=message_uuid,
                file_name=abs_path.name,
                file_path=rel_path,
                mime_type=clean_mime,
                file_size=file_size,
                media_type=resolved_type,
                external_url=None,  # We already have the CDN URL in media_id metadata
                checksum=checksum,
            )
            db.add(media_file)

            # ------------------------------------------------------------------
            # 7. Update Message.metadata_json with local URL
            # ------------------------------------------------------------------
            updated_meta = {
                **existing_meta,
                "mediaUrl": public_url,
                "fileSize": file_size,
                "filePath": rel_path,
                "checksum": checksum,
                "downloadedAt": datetime.now(tz=UTC).isoformat(),
            }
            message.metadata_json = updated_meta

            await db.commit()

            log.info(
                "process_media_download_success",
                media_file_id=str(media_file.id),
                public_url=public_url,
                file_size=file_size,
            )

        except Exception as exc:
            await db.rollback()
            log.error(
                "process_media_download_error",
                error=str(exc),
                exc_info=True,
            )
            raise  # Re-raise for ARQ retry
