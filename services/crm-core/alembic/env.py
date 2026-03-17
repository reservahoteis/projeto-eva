"""
Alembic environment configuration.

Key decisions:
- Async engine (asyncpg): matches the runtime engine in app.core.database so
  the same driver is used for both the application and migrations.
- DATABASE_URL is read from the environment variable, NOT from alembic.ini,
  so no secret ever lives in a config file.
- All SQLAlchemy models are imported here via `app.models` so that
  `alembic revision --autogenerate` can detect schema changes automatically.
- Both online (default) and offline (--sql flag) modes are implemented.
"""

import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ---------------------------------------------------------------------------
# Alembic Config object — gives access to values from alembic.ini.
# ---------------------------------------------------------------------------
config = context.config

# Set up Python logging using the [loggers]/[handlers]/[formatters] sections
# defined in alembic.ini.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------------------------
# Inject DATABASE_URL from environment so alembic.ini stays secret-free.
#
# The environment variable must be set before invoking alembic commands:
#   export DATABASE_URL="postgresql+asyncpg://..."
#   alembic upgrade head
#
# In Docker Compose the variable is provided via the env_file / environment
# block in docker-compose.dev.yml.
#
# asyncpg cannot be used for the *synchronous* "offline" mode; for offline
# SQL generation we swap the driver to psycopg2.  See run_migrations_offline.
# ---------------------------------------------------------------------------
database_url = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/crm_dev",
)

# Override the (empty) sqlalchemy.url from alembic.ini at runtime.
config.set_main_option("sqlalchemy.url", database_url)

# ---------------------------------------------------------------------------
# Import ALL models so SQLAlchemy's metadata is fully populated.
# Alembic compares Base.metadata against the live database schema to produce
# autogenerate diffs — any model NOT imported here will be invisible to it
# and will never appear in generated migrations.
# ---------------------------------------------------------------------------
# Import Base first so metadata is registered on the correct declarative base.
from app.core.database import Base  # noqa: E402

# Import every model module.  The app.models package __init__.py re-exports
# all mapper classes, which has the side effect of registering each Table
# object onto Base.metadata.
import app.models  # noqa: E402, F401 — side-effect import (populates Base.metadata)

# The MetaData object that Alembic will diff against the database.
target_metadata = Base.metadata

# ---------------------------------------------------------------------------
# Optional: exclude tables that are managed outside Alembic
# (e.g. PostGIS spatial_ref_sys, TimescaleDB internal tables).
# ---------------------------------------------------------------------------
# EXCLUDE_TABLES: set[str] = {"spatial_ref_sys"}
#
# def include_object(object, name, type_, reflected, compare_to):
#     if type_ == "table" and name in EXCLUDE_TABLES:
#         return False
#     return True


# =============================================================================
# Offline mode  (alembic upgrade head --sql)
# Generates a plain SQL script without connecting to the database.
# Useful for auditing migrations before applying them to production.
#
# asyncpg is an async-only driver and cannot run in synchronous offline mode.
# We therefore replace "+asyncpg" with "+psycopg2" for offline SQL generation.
# psycopg2 does NOT need to be installed; its URL is never actually used to
# open a connection in offline mode.
# =============================================================================
def run_migrations_offline() -> None:
    offline_url = database_url.replace("+asyncpg", "+psycopg2")

    context.configure(
        url=offline_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Wrap all offline SQL in a transaction so the script is atomic.
        transaction_per_migration=True,
        # Render ALTER TABLE ... ADD CONSTRAINT inline rather than as a
        # separate statement — required for some Postgres constraint types.
        render_as_batch=False,
        # compare_type=True makes autogenerate detect column type changes.
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# =============================================================================
# Online mode  (alembic upgrade head)
# Connects to the real database via an async engine and runs migrations inside
# a synchronous wrapper that asyncio.run() can drive.
# =============================================================================
def do_run_migrations(connection: Connection) -> None:
    """Execute migrations on the provided synchronous connection handle."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # Detect column type changes (e.g. VARCHAR(50) -> VARCHAR(100)).
        compare_type=True,
        # Detect server-side default changes.
        compare_server_default=True,
        # Include schemas other than 'public' if used.
        # include_schemas=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations via a sync connection proxy."""
    # Build the engine from alembic.ini's [alembic] section.
    # NullPool is mandatory for short-lived migration scripts — it prevents
    # the pool from holding open connections after the migration completes,
    # which would leave dangling connections in Postgres.
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        # run_sync wraps the async connection in a sync interface that
        # Alembic's context.run_migrations() expects.
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


# ---------------------------------------------------------------------------
# Entry point: Alembic calls this module at the top level.
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
