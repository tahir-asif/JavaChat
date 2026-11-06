#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESULTS="$ROOT/metrics/results"

for name in gateway chat auth; do
  pidfile="$RESULTS/$name.pid"
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile")"
    kill "$pid" 2>/dev/null || true
    rm -f "$pidfile"
  fi
done

for port in 8080 8081 8082; do
  pids="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    printf '[stop-local] stopping listeners on %s: %s\n' "$port" "$pids"
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      kill -9 $pids 2>/dev/null || true
    fi
  fi
done

if [ "${1:-}" != "--keep-mongo" ]; then
  printf '[stop-local] stopping MongoDB\n'
  ( cd "$ROOT" && docker compose stop mongodb >/dev/null 2>&1 || true )
fi

printf '[stop-local] done\n'
