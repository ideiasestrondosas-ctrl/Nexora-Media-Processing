#!/usr/bin/env bash
# =============================================================================
# Nexora Media Processing — Health Check Script
# scripts/healthcheck.sh
#
# Verifica o estado de todos os serviços da stack Nexora.
#
# USO:
#   bash scripts/healthcheck.sh              # output formatado (humano)
#   bash scripts/healthcheck.sh --json       # output JSON estruturado
#   bash scripts/healthcheck.sh --quiet      # apenas exit code (0=OK, 1=FAIL)
#
# EXIT CODES:
#   0 — Todos os serviços operacionais
#   1 — Um ou mais serviços com falha
# =============================================================================

set -euo pipefail

# ── Configuração ──────────────────────────────────────────────────────────────

API_URL="${NEXORA_API_URL:-http://localhost:3000}"
WORKER_METRICS_URL="${NEXORA_WORKER_URL:-http://localhost:9101}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-nexora}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
MINIO_URL="${MINIO_URL:-http://localhost:9000}"
TEMPORAL_URL="${TEMPORAL_URL:-http://localhost:7233}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"

TIMEOUT=5  # segundos por check
CURL_OPTS="--silent --fail --max-time $TIMEOUT"

# ── Modo de output ─────────────────────────────────────────────────────────────

JSON_MODE=false
QUIET_MODE=false

for arg in "$@"; do
  case $arg in
    --json)   JSON_MODE=true  ;;
    --quiet)  QUIET_MODE=true ;;
  esac
done

# ── Resultados ─────────────────────────────────────────────────────────────────

declare -a SERVICE_NAMES=()
declare -a SERVICE_STATUS=()
declare -a SERVICE_DETAILS=()
FAILURES=0

# ── Funções de check ──────────────────────────────────────────────────────────

check_http() {
  local name="$1"
  local url="$2"
  local detail=""

  if curl $CURL_OPTS "$url" > /dev/null 2>&1; then
    SERVICE_NAMES+=("$name")
    SERVICE_STATUS+=("ok")
    SERVICE_DETAILS+=("HTTP OK")
  else
    SERVICE_NAMES+=("$name")
    SERVICE_STATUS+=("fail")
    SERVICE_DETAILS+=("Não responde em $url")
    ((FAILURES++)) || true
  fi
}

check_postgres() {
  local name="Postgres"
  if pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -q 2>/dev/null; then
    SERVICE_NAMES+=("$name")
    SERVICE_STATUS+=("ok")
    SERVICE_DETAILS+=("pg_isready OK")
  else
    SERVICE_NAMES+=("$name")
    SERVICE_STATUS+=("fail")
    SERVICE_DETAILS+=("Não responde em $POSTGRES_HOST:$POSTGRES_PORT")
    ((FAILURES++)) || true
  fi
}

check_redis() {
  local name="Redis"
  local pong
  pong=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PING 2>/dev/null || echo "ERROR")
  if [[ "$pong" == "PONG" ]]; then
    SERVICE_NAMES+=("$name")
    SERVICE_STATUS+=("ok")
    SERVICE_DETAILS+=("PONG recebido")
  else
    SERVICE_NAMES+=("$name")
    SERVICE_STATUS+=("fail")
    SERVICE_DETAILS+=("Não responde em $REDIS_HOST:$REDIS_PORT")
    ((FAILURES++)) || true
  fi
}

# ── Executar checks ───────────────────────────────────────────────────────────

check_http  "Nexora API"         "$API_URL/health/ready"
check_http  "Worker (métricas)"  "$WORKER_METRICS_URL/health"
check_postgres
check_redis
check_http  "MinIO"              "$MINIO_URL/minio/health/ready"
check_http  "Temporal"           "$TEMPORAL_URL/health"
check_http  "Prometheus"         "$PROMETHEUS_URL/-/healthy"
check_http  "Grafana"            "$GRAFANA_URL/api/health"

# ── Output ────────────────────────────────────────────────────────────────────

if $QUIET_MODE; then
  exit $( [ "$FAILURES" -eq 0 ] && echo 0 || echo 1 )
fi

if $JSON_MODE; then
  # Output JSON estruturado
  echo "{"
  echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"healthy\": $( [ "$FAILURES" -eq 0 ] && echo 'true' || echo 'false' ),"
  echo "  \"failures\": $FAILURES,"
  echo "  \"services\": ["
  for i in "${!SERVICE_NAMES[@]}"; do
    local_comma=$( [ $i -lt $((${#SERVICE_NAMES[@]} - 1)) ] && echo ',' || echo '' )
    echo "    {\"name\": \"${SERVICE_NAMES[$i]}\", \"status\": \"${SERVICE_STATUS[$i]}\", \"detail\": \"${SERVICE_DETAILS[$i]}\"}${local_comma}"
  done
  echo "  ]"
  echo "}"
else
  # Output formatado para humanos
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║         Nexora Media Processing — Health Check           ║"
  echo "╠══════════════════════════════════════════════════════════╣"
  printf "║  %-20s %-12s %-22s║\n" "SERVIÇO" "ESTADO" "DETALHE"
  echo "╠══════════════════════════════════════════════════════════╣"

  for i in "${!SERVICE_NAMES[@]}"; do
    name="${SERVICE_NAMES[$i]}"
    status="${SERVICE_STATUS[$i]}"
    detail="${SERVICE_DETAILS[$i]}"

    if [[ "$status" == "ok" ]]; then
      icon="✅"
    else
      icon="❌"
    fi

    printf "║  %s %-19s %-34s║\n" "$icon" "$name" "$detail"
  done

  echo "╠══════════════════════════════════════════════════════════╣"
  if [ "$FAILURES" -eq 0 ]; then
    echo "║  ✅ Todos os serviços operacionais                      ║"
  else
    echo "║  ❌ $FAILURES serviço(s) com falha                           ║"
  fi
  echo "╚══════════════════════════════════════════════════════════╝"
  echo "  Executado em: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo ""
fi

exit $( [ "$FAILURES" -eq 0 ] && echo 0 || echo 1 )
