#!/bin/bash

# ============================================
# Backup Script - PostgreSQL Database
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKUP_DIR="./backups/postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backup_${TIMESTAMP}.sql.gz"
KEEP_DAYS=7  # Keep backups for 7 days

# Load environment
if [ -f ".env.production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Create backup directory
mkdir -p $BACKUP_DIR

echo -e "${YELLOW}📦 Creating database backup...${NC}"

# Create backup
docker-compose -f docker-compose.production.yml exec -T postgres \
    pg_dump -U ${POSTGRES_USER:-crm_user} ${POSTGRES_DB:-crm_whatsapp_saas} | \
    gzip > "$BACKUP_DIR/$BACKUP_FILE"

# Check if backup was successful
if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup created: $BACKUP_FILE (${BACKUP_SIZE})${NC}"
else
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi

# Delete old backups
echo -e "${YELLOW}🗑️  Removing backups older than ${KEEP_DAYS} days...${NC}"
find $BACKUP_DIR -name "backup_*.sql.gz" -type f -mtime +$KEEP_DAYS -delete

# List all backups
echo -e "${GREEN}📋 Available backups:${NC}"
ls -lh $BACKUP_DIR/backup_*.sql.gz | tail -n 10

echo -e "${GREEN}✅ Backup completed!${NC}"
