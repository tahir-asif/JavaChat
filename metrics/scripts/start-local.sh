#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESULTS="$ROOT/metrics/results"
COMPOSE=(docker compose -f "$ROOT/docker-compose.yml")

mkdir -p "$RESULTS"

log() { printf '[start-local] %s\n' "$*"; }
die() { printf '[start-local] ERROR: %s\n' "$*" >&2; exit 1; }

for cmd in docker curl openssl lsof; do
  command -v "$cmd" >/dev/null 2>&1 || die "missing required command: $cmd"
done

for port in 8080 8081 8082; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    die "port $port is already in use; run metrics/scripts/stop-local.sh first"
  fi
done

log "starting MongoDB"
"${COMPOSE[@]}" up -d mongodb >/dev/null

log "waiting for MongoDB"
mongo_ready=0
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T mongodb mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q '^1$'; then
    mongo_ready=1
    break
  fi
  sleep 1
done
[ "$mongo_ready" = "1" ] || die "MongoDB did not become ready"

if [ "${RESET_DB:-1}" = "1" ]; then
  log "resetting metrics databases"
  "${COMPOSE[@]}" exec -T mongodb mongosh --quiet --eval '
    db.getSiblingDB("authdb_metrics").dropDatabase();
    db.getSiblingDB("chatdb_metrics").dropDatabase();
  ' >/dev/null
fi

JWT_SECRET="$(openssl rand -hex 32)"
export JWT_SECRET
AUTH_DB_URI="mongodb://localhost:27017/authdb_metrics"
CHAT_DB_URI="mongodb://localhost:27017/chatdb_metrics"

log "starting auth-service"
(
  cd "$ROOT/auth-service"
  nohup env JWT_SECRET="$JWT_SECRET" MONGODB_URI_AUTH="$AUTH_DB_URI" \
    ./mvnw spring-boot:run >"$RESULTS/auth.log" 2>&1 </dev/null &
  echo $! >"$RESULTS/auth.pid"
)

log "starting chat-service"
(
  cd "$ROOT/chat-service"
  nohup env JWT_SECRET="$JWT_SECRET" MONGODB_URI_CHAT="$CHAT_DB_URI" \
    ./mvnw spring-boot:run >"$RESULTS/chat.log" 2>&1 </dev/null &
  echo $! >"$RESULTS/chat.pid"
)

log "starting api-gateway"
(
  cd "$ROOT/api-gateway"
  nohup ./mvnw spring-boot:run >"$RESULTS/gateway.log" 2>&1 </dev/null &
  echo $! >"$RESULTS/gateway.pid"
)

show_logs() {
  for name in auth chat gateway; do
    printf '\n--- %s.log (tail) ---\n' "$name" >&2
    tail -n 25 "$RESULTS/$name.log" >&2 2>/dev/null || true
  done
}

wait_for() {
  local label="$1" url="$2" timeout="${3:-240}" started
  started="$(date +%s)"

  while true; do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      log "$label ready"
      return 0
    fi

    if [ $(( $(date +%s) - started )) -ge "$timeout" ]; then
      printf '[start-local] ERROR: timed out waiting for %s (%s)\n' "$label" "$url" >&2
      show_logs
      return 1
    fi

    sleep 2
  done
}

wait_for "auth-service" "http://localhost:8081/api/auth/health" 240
wait_for "chat-service" "http://localhost:8082/api/messages/health" 240
wait_for "gateway -> auth" "http://localhost:8080/api/auth/health" 240
wait_for "gateway -> chat" "http://localhost:8080/api/messages/health" 240

log "stack ready (gateway :8080, auth :8081, chat :8082)"
