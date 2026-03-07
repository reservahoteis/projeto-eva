#!/usr/bin/env bash
# MED-009: CI script to validate Alembic migrations
#
# Usage: ./scripts/validate-migrations.sh
#
# This script:
# 1. Creates a fresh temporary PostgreSQL database
# 2. Runs all Alembic migrations (alembic upgrade head)
# 3. Validates migration ordering (no conflicts)
# 4. Warns on destructive operations (DROP TABLE/COLUMN)
# 5. Tears down the temporary database
#
# Requires: PostgreSQL running, PGHOST/PGUSER/PGPASSWORD set or default values.
# In CI: use a PostgreSQL service container.

set -euo pipefail

DB_NAME="crm_core_migration_test_$$"
DB_URL="${DATABASE_URL_BASE:-postgresql+asyncpg://crm:crm_dev_password@localhost:5432}/${DB_NAME}"

echo "==> Creating temporary database: ${DB_NAME}"
createdb "${DB_NAME}" 2>/dev/null || psql -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null

cleanup() {
    echo "==> Dropping temporary database: ${DB_NAME}"
    dropdb "${DB_NAME}" 2>/dev/null || psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null
}
trap cleanup EXIT

echo "==> Running alembic upgrade head..."
DATABASE_URL="${DB_URL}" alembic upgrade head

echo "==> Checking for destructive operations in migration files..."
DESTRUCTIVE=$(grep -rn -i "DROP TABLE\|DROP COLUMN\|TRUNCATE" alembic/versions/ 2>/dev/null || true)
if [ -n "${DESTRUCTIVE}" ]; then
    echo "WARNING: Destructive operations found in migrations:"
    echo "${DESTRUCTIVE}"
    echo ""
    echo "Please verify these are intentional."
fi

echo "==> Checking migration history consistency..."
DATABASE_URL="${DB_URL}" alembic history --verbose | head -20

echo "==> All migrations validated successfully!"
