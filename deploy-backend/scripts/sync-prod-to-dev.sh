#!/bin/bash

# =============================================================================
# Script de Sincronização: Produção → Desenvolvimento
# =============================================================================
#
# Este script replica os dados do banco de produção para o banco de
# desenvolvimento de forma unidirecional.
#
# Uso:
#   ./sync-prod-to-dev.sh              # Sync completo
#   ./sync-prod-to-dev.sh --tables     # Apenas tabelas específicas
#   ./sync-prod-to-dev.sh --dry-run    # Simular sem executar
#
# Configurar via variáveis de ambiente ou editar abaixo:
# =============================================================================

set -e

# Configurações - PRODUÇÃO (origem)
PROD_CONTAINER="${PROD_DB_CONTAINER:-crm-postgres}"
PROD_DATABASE="${PROD_DATABASE:-crm_production}"
PROD_USER="${PROD_DB_USER:-postgres}"

# Configurações - DESENVOLVIMENTO (destino)
DEV_CONTAINER="${DEV_DB_CONTAINER:-crm-postgres-dev}"
DEV_DATABASE="${DEV_DATABASE:-crm_development}"
DEV_USER="${DEV_DB_USER:-postgres}"

# Configurações gerais
BACKUP_DIR="/tmp/db-sync"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${BACKUP_DIR}/prod_dump_${TIMESTAMP}.sql"
LOG_FILE="${BACKUP_DIR}/sync_${TIMESTAMP}.log"
DRY_RUN=false

# Tabelas que NÃO devem ser sincronizadas (dados locais do dev)
# Adicione aqui tabelas que você quer preservar no dev
EXCLUDE_TABLES=(
    # "_prisma_migrations"  # Descomente se quiser manter migrations do dev
)

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $(date '+%H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Verificar argumentos
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Argumento desconhecido: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    echo "Uso: $0 [opções]"
    echo ""
    echo "Opções:"
    echo "  --dry-run    Simula a execução sem fazer alterações"
    echo "  --help       Mostra esta ajuda"
    echo ""
    echo "Variáveis de ambiente:"
    echo "  PROD_DB_CONTAINER  Container do PostgreSQL de produção (default: crm-postgres)"
    echo "  PROD_DATABASE      Nome do banco de produção (default: crm_production)"
    echo "  PROD_DB_USER       Usuário do banco de produção (default: postgres)"
    echo "  DEV_DB_CONTAINER   Container do PostgreSQL de dev (default: crm-postgres-dev)"
    echo "  DEV_DATABASE       Nome do banco de dev (default: crm_development)"
    echo "  DEV_DB_USER        Usuário do banco de dev (default: postgres)"
}

# Verificar se containers estão rodando
check_containers() {
    log_info "Verificando containers..."

    if ! docker ps --format '{{.Names}}' | grep -q "^${PROD_CONTAINER}$"; then
        log_error "Container de produção '${PROD_CONTAINER}' não está rodando!"
        exit 1
    fi

    if ! docker ps --format '{{.Names}}' | grep -q "^${DEV_CONTAINER}$"; then
        log_error "Container de desenvolvimento '${DEV_CONTAINER}' não está rodando!"
        exit 1
    fi

    log_success "Containers verificados"
}

# Criar diretório de backup
setup_directories() {
    mkdir -p "$BACKUP_DIR"
    log_info "Diretório de trabalho: $BACKUP_DIR"
}

# Fazer dump do banco de produção
dump_production() {
    log_info "Iniciando dump do banco de produção..."

    # Construir opções de exclusão
    EXCLUDE_OPTS=""
    for table in "${EXCLUDE_TABLES[@]}"; do
        EXCLUDE_OPTS="$EXCLUDE_OPTS --exclude-table=$table"
    done

    if [ "$DRY_RUN" = true ]; then
        log_warn "[DRY-RUN] Simulando: docker exec $PROD_CONTAINER pg_dump -U $PROD_USER $PROD_DATABASE $EXCLUDE_OPTS"
        return
    fi

    # Dump com:
    # --clean: Adiciona DROP antes de CREATE
    # --if-exists: Não falha se objeto não existir
    # --no-owner: Remove ownership (usa o user do destino)
    # --no-privileges: Remove GRANT/REVOKE
    docker exec "$PROD_CONTAINER" pg_dump \
        -U "$PROD_USER" \
        -d "$PROD_DATABASE" \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        $EXCLUDE_OPTS \
        > "$DUMP_FILE"

    DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
    log_success "Dump concluído: $DUMP_FILE ($DUMP_SIZE)"
}

# Parar conexões ativas no banco de dev (para evitar locks)
kill_dev_connections() {
    log_info "Encerrando conexões ativas no banco de dev..."

    if [ "$DRY_RUN" = true ]; then
        log_warn "[DRY-RUN] Simulando: encerrar conexões em $DEV_DATABASE"
        return
    fi

    docker exec "$DEV_CONTAINER" psql -U "$DEV_USER" -d postgres -c "
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '$DEV_DATABASE'
        AND pid <> pg_backend_pid();
    " 2>/dev/null || true

    log_success "Conexões encerradas"
}

# Restaurar no banco de desenvolvimento
restore_to_dev() {
    log_info "Restaurando dados no banco de desenvolvimento..."

    if [ "$DRY_RUN" = true ]; then
        log_warn "[DRY-RUN] Simulando: restaurar $DUMP_FILE em $DEV_DATABASE"
        return
    fi

    # Copiar dump para dentro do container de dev
    docker cp "$DUMP_FILE" "$DEV_CONTAINER:/tmp/restore.sql"

    # Restaurar
    # Usar ON_ERROR_ROLLBACK para continuar mesmo com erros menores
    docker exec "$DEV_CONTAINER" psql \
        -U "$DEV_USER" \
        -d "$DEV_DATABASE" \
        -v ON_ERROR_ROLLBACK=on \
        -f /tmp/restore.sql \
        2>&1 | grep -v "^NOTICE:" | tee -a "$LOG_FILE"

    # Limpar arquivo temporário
    docker exec "$DEV_CONTAINER" rm -f /tmp/restore.sql

    log_success "Restauração concluída"
}

# Atualizar sequences (importante após restore)
update_sequences() {
    log_info "Atualizando sequences..."

    if [ "$DRY_RUN" = true ]; then
        log_warn "[DRY-RUN] Simulando: atualizar sequences"
        return
    fi

    # Este comando atualiza todas as sequences para o valor máximo atual da tabela
    docker exec "$DEV_CONTAINER" psql -U "$DEV_USER" -d "$DEV_DATABASE" -c "
        DO \$\$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT
                    'SELECT setval(''' || pg_get_serial_sequence(quote_ident(t.table_name), quote_ident(c.column_name)) || ''', COALESCE(MAX(' || quote_ident(c.column_name) || '), 1)) FROM ' || quote_ident(t.table_name) AS query
                FROM information_schema.tables t
                JOIN information_schema.columns c ON t.table_name = c.table_name
                WHERE t.table_schema = 'public'
                AND c.column_default LIKE 'nextval%'
            ) LOOP
                BEGIN
                    EXECUTE r.query;
                EXCEPTION WHEN OTHERS THEN
                    -- Ignorar erros (algumas sequences podem não existir)
                    NULL;
                END;
            END LOOP;
        END \$\$;
    " 2>/dev/null || true

    log_success "Sequences atualizadas"
}

# Limpar arquivos antigos
cleanup() {
    log_info "Limpando arquivos temporários..."

    if [ "$DRY_RUN" = true ]; then
        log_warn "[DRY-RUN] Simulando: limpeza de arquivos"
        return
    fi

    # Manter apenas os últimos 5 dumps
    ls -t "${BACKUP_DIR}"/prod_dump_*.sql 2>/dev/null | tail -n +6 | xargs -r rm -f
    ls -t "${BACKUP_DIR}"/sync_*.log 2>/dev/null | tail -n +10 | xargs -r rm -f

    log_success "Limpeza concluída"
}

# Mostrar resumo
show_summary() {
    echo ""
    echo "=============================================="
    echo "           SINCRONIZAÇÃO CONCLUÍDA"
    echo "=============================================="
    echo ""
    echo "  Origem:  ${PROD_CONTAINER}/${PROD_DATABASE}"
    echo "  Destino: ${DEV_CONTAINER}/${DEV_DATABASE}"
    echo ""
    if [ "$DRY_RUN" = true ]; then
        echo "  Modo: DRY-RUN (nenhuma alteração foi feita)"
    else
        echo "  Dump: $DUMP_FILE"
        echo "  Log:  $LOG_FILE"
    fi
    echo ""
    echo "=============================================="
}

# Main
main() {
    parse_args "$@"

    echo ""
    echo "=============================================="
    echo "    SYNC: Produção → Desenvolvimento"
    echo "=============================================="
    echo ""

    if [ "$DRY_RUN" = true ]; then
        log_warn "Modo DRY-RUN ativado - nenhuma alteração será feita"
    fi

    setup_directories
    check_containers
    dump_production
    kill_dev_connections
    restore_to_dev
    update_sequences
    cleanup
    show_summary
}

main "$@"
