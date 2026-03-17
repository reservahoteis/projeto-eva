"""One-time migration script to encrypt existing plaintext tokens in the database.

Reads all tenants and encrypts any plaintext token fields that are not yet
encrypted (i.e., missing the "enc:" prefix). Safe to run multiple times —
already-encrypted values are skipped.

Usage:
    DATABASE_URL=postgresql+asyncpg://... TOKEN_ENCRYPTION_KEY=... python scripts/encrypt_existing_tokens.py

Requirements:
    - DATABASE_URL must use the asyncpg driver (postgresql+asyncpg://...)
    - TOKEN_ENCRYPTION_KEY must be a valid Fernet key
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys

# Ensure the project root is on sys.path so `app.*` imports work.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.encryption import encrypt_token, is_encrypted

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

TOKEN_COLUMNS = [
    "whatsapp_access_token",
    "instagram_access_token",
    "messenger_access_token",
]


async def migrate_tokens() -> None:
    database_url = os.environ.get("DATABASE_URL")
    encryption_key = os.environ.get("TOKEN_ENCRYPTION_KEY")

    if not database_url:
        logger.error("DATABASE_URL environment variable is required.")
        sys.exit(1)

    if not encryption_key:
        logger.error("TOKEN_ENCRYPTION_KEY environment variable is required.")
        sys.exit(1)

    engine = create_async_engine(database_url, echo=False)

    encrypted_count = 0
    skipped_count = 0

    async with AsyncSession(engine) as session:
        # Read all tenants with their token columns.
        result = await session.execute(
            text(f"SELECT id, {', '.join(TOKEN_COLUMNS)} FROM tenants")
        )
        rows = result.fetchall()
        logger.info("Found %d tenants to process.", len(rows))

        for row in rows:
            tenant_id = row[0]
            updates: dict[str, str] = {}

            for i, col in enumerate(TOKEN_COLUMNS, start=1):
                value = row[i]
                if value is None or value == "":
                    skipped_count += 1
                    continue

                if is_encrypted(value):
                    logger.debug("Tenant %s: %s already encrypted — skipping.", tenant_id, col)
                    skipped_count += 1
                    continue

                encrypted_value = encrypt_token(value)
                updates[col] = encrypted_value

            if updates:
                set_clause = ", ".join(f"{col} = :val_{col}" for col in updates)
                params = {f"val_{col}": val for col, val in updates.items()}
                params["tenant_id"] = str(tenant_id)

                await session.execute(
                    text(f"UPDATE tenants SET {set_clause} WHERE id = :tenant_id::uuid"),
                    params,
                )
                encrypted_count += len(updates)
                logger.info(
                    "Tenant %s: encrypted %d token(s) — %s",
                    tenant_id,
                    len(updates),
                    ", ".join(updates.keys()),
                )

        await session.commit()

    await engine.dispose()

    logger.info(
        "Migration complete. Encrypted: %d token(s), Skipped: %d (null/empty/already encrypted).",
        encrypted_count,
        skipped_count,
    )


if __name__ == "__main__":
    asyncio.run(migrate_tokens())
