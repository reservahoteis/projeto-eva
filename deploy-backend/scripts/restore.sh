#!/bin/bash

# ============================================
# Restore Script - PostgreSQL Database
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
BACKUP_DIR="./backups/postgres"

# Load environment
if [ -f ".env.production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Please provide backup file name${NC}"
    echo ""
    echo "Usage: ./restore.sh backup_20240101_120000.sql.gz"
    echo ""
    echo -e "${YELLOW}Available backups:${NC}"
    ls -lh $BACKUP_DIR/backup_*.sql.gz | tail -n 10
    exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# Confirmation
echo -e "${RED}⚠️  WARNING: This will OVERWRITE the current database!${NC}"
echo -e "${YELLOW}Backup file: $BACKUP_FILE${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo -e "${YELLOW}🔄 Restoring database from backup...${NC}"

# Stop backend to prevent connections
docker-compose -f docker-compose.production.yml stop backend

# Drop existing database and recreate
docker-compose -f docker-compose.production.yml exec -T postgres psql -U ${POSTGRES_USER:-crm_user} -d postgres <<EOF
DROP DATABASE IF EXISTS ${POSTGRES_DB:-crm_whatsapp_saas};
CREATE DATABASE ${POSTGRES_DB:-crm_whatsapp_saas};
EOF

# Restore backup
gunzip < "$BACKUP_FILE" | docker-compose -f docker-compose.production.yml exec -T postgres \
    psql -U ${POSTGRES_USER:-crm_user} -d ${POSTGRES_DB:-crm_whatsapp_saas}

# Start backend
docker-compose -f docker-compose.production.yml start backend

echo -e "${GREEN}✅ Database restored successfully!${NC}"
echo ""
echo "Check application: docker-compose -f docker-compose.production.yml logs -f backend"
