#!/bin/bash

# ============================================
# GitHub Actions Deploy - SSH Key Setup
# Execute este script NO VPS para gerar as chaves
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  GitHub Actions Deploy - SSH Key Setup${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Este script deve ser executado como root${NC}"
  echo "Use: sudo bash setup-deploy-keys.sh"
  exit 1
fi

# Variables
SSH_DIR="/root/.ssh"
KEY_NAME="github_actions_deploy"
KEY_PATH="$SSH_DIR/$KEY_NAME"
DEPLOY_PATH="/root/deploy-backend"

# ============================================
# 1. Create SSH directory
# ============================================
echo -e "${YELLOW}[1/6] Criando diretório SSH...${NC}"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
echo -e "${GREEN}✓ Diretório criado: $SSH_DIR${NC}"
echo ""

# ============================================
# 2. Generate SSH key
# ============================================
echo -e "${YELLOW}[2/6] Gerando chave SSH...${NC}"

if [ -f "$KEY_PATH" ]; then
  echo -e "${RED}Chave já existe em: $KEY_PATH${NC}"
  read -p "Deseja sobrescrever? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Operação cancelada${NC}"
    exit 0
  fi
  rm -f "$KEY_PATH" "$KEY_PATH.pub"
fi

ssh-keygen -t ed25519 -C "github-actions-deploy-$(date +%Y%m%d)" -f "$KEY_PATH" -N "" -q
chmod 600 "$KEY_PATH"
chmod 644 "$KEY_PATH.pub"

echo -e "${GREEN}✓ Chave SSH gerada${NC}"
echo ""

# ============================================
# 3. Add to authorized_keys
# ============================================
echo -e "${YELLOW}[3/6] Adicionando chave ao authorized_keys...${NC}"

if [ ! -f "$SSH_DIR/authorized_keys" ]; then
  touch "$SSH_DIR/authorized_keys"
  chmod 600 "$SSH_DIR/authorized_keys"
fi

# Check if key already in authorized_keys
KEY_CONTENT=$(cat "$KEY_PATH.pub")
if grep -qF "$KEY_CONTENT" "$SSH_DIR/authorized_keys"; then
  echo -e "${YELLOW}⚠ Chave já existe em authorized_keys${NC}"
else
  cat "$KEY_PATH.pub" >> "$SSH_DIR/authorized_keys"
  echo -e "${GREEN}✓ Chave adicionada ao authorized_keys${NC}"
fi
echo ""

# ============================================
# 4. Test SSH key locally
# ============================================
echo -e "${YELLOW}[4/6] Testando chave SSH...${NC}"

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

if ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no -o BatchMode=yes root@localhost "echo 'SSH test successful'" 2>/dev/null; then
  echo -e "${GREEN}✓ Chave SSH funciona corretamente${NC}"
else
  echo -e "${YELLOW}⚠ Não foi possível testar localmente (normal em alguns VPS)${NC}"
fi
echo ""

# ============================================
# 5. Create deploy directory
# ============================================
echo -e "${YELLOW}[5/6] Preparando diretório de deploy...${NC}"

mkdir -p "$DEPLOY_PATH"
mkdir -p "$DEPLOY_PATH/backups"
mkdir -p "$DEPLOY_PATH/certbot/conf"
mkdir -p "$DEPLOY_PATH/certbot/www"
mkdir -p "$DEPLOY_PATH/nginx/conf.d"

chmod 755 "$DEPLOY_PATH"

echo -e "${GREEN}✓ Diretório de deploy pronto: $DEPLOY_PATH${NC}"
echo ""

# ============================================
# 6. Display results
# ============================================
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}✓ Configuração concluída com sucesso!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

echo -e "${YELLOW}PRÓXIMOS PASSOS:${NC}"
echo ""

echo -e "${YELLOW}1. Copie a CHAVE PRIVADA abaixo:${NC}"
echo ""
echo -e "${BLUE}============================================${NC}"
cat "$KEY_PATH"
echo -e "${BLUE}============================================${NC}"
echo ""

echo -e "${YELLOW}2. Configure os GitHub Secrets:${NC}"
echo ""
echo "   Acesse: https://github.com/SEU-USUARIO/SEU-REPO/settings/secrets/actions"
echo ""
echo "   VPS_SSH_KEY:"
echo "     - Cole TODA a chave privada acima (incluindo BEGIN/END)"
echo ""
echo "   VPS_HOST:"
echo "     - Value: $SERVER_IP"
echo ""
echo "   VPS_USER:"
echo "     - Value: root"
echo ""
echo "   VPS_PATH:"
echo "     - Value: $DEPLOY_PATH"
echo ""

echo -e "${YELLOW}3. Crie o arquivo .env.production:${NC}"
echo ""
echo "   cd $DEPLOY_PATH"
echo "   nano .env.production"
echo ""

echo -e "${YELLOW}4. Teste o deploy:${NC}"
echo ""
echo "   - Vá para GitHub Actions"
echo "   - Execute workflow 'Deploy to Production VPS'"
echo "   - Monitore os logs"
echo ""

echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}Informações do Sistema:${NC}"
echo -e "${BLUE}============================================${NC}"
echo "IP do Servidor: $SERVER_IP"
echo "Chave SSH: $KEY_PATH"
echo "Chave Pública: $KEY_PATH.pub"
echo "Diretório Deploy: $DEPLOY_PATH"
echo "Docker Status: $(systemctl is-active docker || echo 'not running')"
echo -e "${BLUE}============================================${NC}"
echo ""

echo -e "${GREEN}✓ Setup completo!${NC}"
echo ""

# Save config to file
cat > "$DEPLOY_PATH/.deploy-config" << EOF
# GitHub Actions Deploy Configuration
# Generated: $(date)

VPS_HOST=$SERVER_IP
VPS_USER=root
VPS_PATH=$DEPLOY_PATH
SSH_KEY_PATH=$KEY_PATH
SSH_KEY_CREATED=$(date)
EOF

echo -e "${GREEN}Configuração salva em: $DEPLOY_PATH/.deploy-config${NC}"
