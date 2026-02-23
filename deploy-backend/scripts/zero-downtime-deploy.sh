#!/bin/bash
set -euo pipefail

# ============================================
# Zero-Downtime Blue/Green Deploy
# Alterna entre backend-blue e backend-green
# Nginx reload = zero downtime
# ============================================

COMPOSE_FILE="docker-compose.production.yml"
DEPLOY_DIR="/root/deploy-backend"
STATE_FILE="$DEPLOY_DIR/.deploy-color"
UPSTREAM_FILE="$DEPLOY_DIR/nginx/conf.d/upstream-backend.conf"
HEALTH_TIMEOUT=60
DRAIN_WAIT=5

cd "$DEPLOY_DIR"

# Determinar cor ativa e target
CURRENT=$(cat "$STATE_FILE" 2>/dev/null || echo "none")
if [ "$CURRENT" = "blue" ]; then
  TARGET="green"
elif [ "$CURRENT" = "green" ]; then
  TARGET="blue"
else
  TARGET="blue"
  CURRENT="none"
fi

echo "=== Zero-Downtime Deploy ==="
echo "Current: $CURRENT | Target: $TARGET"
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1. Build nova imagem
echo "[1/6] Building image..."
docker compose -f "$COMPOSE_FILE" build "backend-$TARGET"

# 2. Iniciar novo container
echo "[2/6] Starting backend-$TARGET..."
docker compose -f "$COMPOSE_FILE" --profile "$TARGET" up -d "backend-$TARGET"

# 3. Aguardar health check
echo "[3/6] Waiting for health check (max ${HEALTH_TIMEOUT}s)..."
CONTAINER="crm-backend-$TARGET"
ELAPSED=0
HEALTHY=false

while [ $ELAPSED -lt $HEALTH_TIMEOUT ]; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    HEALTHY=true
    echo "  Health check PASSED in ${ELAPSED}s"
    break
  fi
  echo "  Status: $STATUS (${ELAPSED}s/${HEALTH_TIMEOUT}s)"
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

if [ "$HEALTHY" != "true" ]; then
  echo ""
  echo "ERROR: Health check failed after ${HEALTH_TIMEOUT}s!"
  echo "Container logs:"
  docker logs "$CONTAINER" --tail=30
  echo ""
  echo "Rolling back - stopping failed container..."
  docker compose -f "$COMPOSE_FILE" --profile "$TARGET" stop "backend-$TARGET"
  docker compose -f "$COMPOSE_FILE" --profile "$TARGET" rm -f "backend-$TARGET"
  exit 1
fi

# 4. Trocar nginx upstream para novo container
echo "[4/6] Switching nginx upstream to backend-$TARGET..."
cat > "$UPSTREAM_FILE" << NGINXEOF
# Managed by zero-downtime-deploy.sh - DO NOT EDIT MANUALLY
# Active: $TARGET | Deployed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
upstream backend {
    server crm-backend-$TARGET:3001;
    keepalive 32;
    keepalive_timeout 60s;
    keepalive_requests 100;
}
NGINXEOF

# 5. Reload nginx (zero-downtime)
echo "[5/6] Reloading nginx..."
docker exec crm-nginx nginx -t
docker exec crm-nginx nginx -s reload
echo "  Nginx reloaded. Draining connections (${DRAIN_WAIT}s)..."
sleep $DRAIN_WAIT

# 6. Parar container antigo
if [ "$CURRENT" != "none" ]; then
  echo "[6/6] Stopping old backend-$CURRENT..."
  docker compose -f "$COMPOSE_FILE" --profile "$CURRENT" stop "backend-$CURRENT"
  docker compose -f "$COMPOSE_FILE" --profile "$CURRENT" rm -f "backend-$CURRENT"
else
  echo "[6/6] No previous container to stop (first deploy)"
fi

# Salvar estado
echo "$TARGET" > "$STATE_FILE"

# Cleanup imagens antigas
echo ""
echo "Cleaning up unused images..."
docker image prune -f --filter "until=24h" 2>/dev/null || true

echo ""
echo "=== Deploy Complete ==="
echo "Active: $TARGET (crm-backend-$TARGET)"
echo "Downtime: 0 seconds"
docker compose -f "$COMPOSE_FILE" --profile "$TARGET" ps "backend-$TARGET"
