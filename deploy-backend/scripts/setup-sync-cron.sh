#!/bin/bash

# =============================================================================
# Script de Setup do Cron para Sincronização Prod → Dev
# =============================================================================
#
# Este script configura o cron job que executa a sincronização do banco
# de produção para desenvolvimento a cada 5 minutos.
#
# Uso:
#   ./setup-sync-cron.sh           # Instalar cron job
#   ./setup-sync-cron.sh --remove  # Remover cron job
#   ./setup-sync-cron.sh --status  # Ver status do cron
#
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_SCRIPT="${SCRIPT_DIR}/sync-prod-to-dev.sh"
CRON_INTERVAL="${SYNC_CRON_INTERVAL:-5}"  # Minutos entre cada sync
CRON_COMMENT="# CRM Prod-to-Dev Database Sync"
LOG_DIR="/var/log/crm-sync"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    echo "Uso: $0 [opções]"
    echo ""
    echo "Opções:"
    echo "  --install    Instalar cron job (padrão)"
    echo "  --remove     Remover cron job"
    echo "  --status     Mostrar status do cron"
    echo "  --help       Mostrar esta ajuda"
    echo ""
    echo "Variáveis de ambiente:"
    echo "  SYNC_CRON_INTERVAL  Intervalo em minutos (default: 5)"
}

check_script_exists() {
    if [ ! -f "$SYNC_SCRIPT" ]; then
        log_error "Script de sync não encontrado: $SYNC_SCRIPT"
        exit 1
    fi

    # Garantir que o script tem permissão de execução
    chmod +x "$SYNC_SCRIPT"
}

setup_log_dir() {
    if [ ! -d "$LOG_DIR" ]; then
        log_info "Criando diretório de logs: $LOG_DIR"
        sudo mkdir -p "$LOG_DIR"
        sudo chmod 755 "$LOG_DIR"
    fi
}

install_cron() {
    check_script_exists
    setup_log_dir

    log_info "Instalando cron job (intervalo: ${CRON_INTERVAL} minutos)..."

    # Remover cron existente primeiro (se houver)
    remove_cron_silent

    # Criar entrada do cron
    # Executa a cada X minutos e loga em arquivo rotacionado por data
    CRON_ENTRY="*/${CRON_INTERVAL} * * * * ${SYNC_SCRIPT} >> ${LOG_DIR}/sync-\$(date +\%Y\%m\%d).log 2>&1"

    # Adicionar ao crontab
    (crontab -l 2>/dev/null || true; echo "$CRON_COMMENT"; echo "$CRON_ENTRY") | crontab -

    log_success "Cron job instalado com sucesso!"
    echo ""
    echo "Configuração:"
    echo "  - Intervalo: a cada ${CRON_INTERVAL} minutos"
    echo "  - Script: ${SYNC_SCRIPT}"
    echo "  - Logs: ${LOG_DIR}/sync-YYYYMMDD.log"
    echo ""
    echo "Para ver os logs em tempo real:"
    echo "  tail -f ${LOG_DIR}/sync-\$(date +%Y%m%d).log"
}

remove_cron_silent() {
    # Remove sem mensagens (usado internamente)
    crontab -l 2>/dev/null | grep -v "$CRON_COMMENT" | grep -v "sync-prod-to-dev.sh" | crontab - 2>/dev/null || true
}

remove_cron() {
    log_info "Removendo cron job..."

    if crontab -l 2>/dev/null | grep -q "sync-prod-to-dev.sh"; then
        remove_cron_silent
        log_success "Cron job removido!"
    else
        log_warn "Nenhum cron job encontrado"
    fi
}

show_status() {
    echo ""
    echo "=============================================="
    echo "     STATUS DO CRON DE SINCRONIZAÇÃO"
    echo "=============================================="
    echo ""

    if crontab -l 2>/dev/null | grep -q "sync-prod-to-dev.sh"; then
        log_success "Cron job ATIVO"
        echo ""
        echo "Entrada atual:"
        crontab -l 2>/dev/null | grep -A1 "$CRON_COMMENT" || crontab -l 2>/dev/null | grep "sync-prod-to-dev.sh"
    else
        log_warn "Cron job NÃO INSTALADO"
    fi

    echo ""
    echo "Últimas execuções (se disponíveis):"
    if [ -d "$LOG_DIR" ]; then
        LATEST_LOG=$(ls -t "${LOG_DIR}"/sync-*.log 2>/dev/null | head -1)
        if [ -n "$LATEST_LOG" ]; then
            echo "  Arquivo: $LATEST_LOG"
            echo "  Últimas 5 linhas:"
            tail -5 "$LATEST_LOG" 2>/dev/null | sed 's/^/    /'
        else
            echo "  Nenhum log encontrado"
        fi
    else
        echo "  Diretório de logs não existe"
    fi
    echo ""
}

# Parse argumentos
ACTION="install"

while [[ $# -gt 0 ]]; do
    case $1 in
        --install)
            ACTION="install"
            shift
            ;;
        --remove)
            ACTION="remove"
            shift
            ;;
        --status)
            ACTION="status"
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

# Executar ação
case $ACTION in
    install)
        install_cron
        ;;
    remove)
        remove_cron
        ;;
    status)
        show_status
        ;;
esac
