#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

log() {
  printf "[kkval] %s\n" "$1"
}

fail() {
  printf "[kkval] ERROR: %s\n" "$1" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "node is required (Node.js >= 20)."
command -v npm >/dev/null 2>&1 || fail "npm is required."
command -v pm2 >/dev/null 2>&1 || fail "pm2 is required (install with: npm install -g pm2)."

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js >= 20 is required (found $(node -v))."
fi

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    fail "Created .env from .env.example. Fill in DATABASE_URL and SEC_USER_AGENT, then re-run ./bootstrap.sh."
  else
    fail ".env file is missing."
  fi
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL is not set in .env."
fi

if [ -z "${SEC_USER_AGENT:-}" ]; then
  fail "SEC_USER_AGENT is required by SEC EDGAR fair access policy."
fi

if [[ "$DATABASE_URL" == *"localhost"* || "$DATABASE_URL" == *"127.0.0.1"* ]]; then
  if command -v docker >/dev/null 2>&1; then
    log "Starting PostgreSQL container (kkval-postgres on 5433)..."
    docker compose up -d postgres

    log "Waiting for PostgreSQL to become healthy..."
    for _ in $(seq 1 30); do
      STATUS="$(docker inspect -f '{{.State.Health.Status}}' kkval-postgres 2>/dev/null || echo "starting")"
      if [ "$STATUS" = "healthy" ]; then
        break
      fi
      sleep 1
    done

    STATUS="$(docker inspect -f '{{.State.Health.Status}}' kkval-postgres 2>/dev/null || echo "unknown")"
    if [ "$STATUS" != "healthy" ]; then
      fail "PostgreSQL container did not reach healthy state (status: $STATUS)."
    fi
  else
    log "docker not found; assuming PostgreSQL is already running locally."
  fi
fi

if [ -f "package-lock.json" ]; then
  log "Installing dependencies with npm ci..."
  npm ci
else
  log "Installing dependencies with npm install..."
  npm install
fi

log "Running Drizzle database migrations..."
npx drizzle-kit migrate

log "Building Next.js application..."
npm run build

log "Starting/reloading PM2 processes (kkval-web & kkval-worker)..."
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

log "Deployment complete. App listening on http://localhost:${PORT:-3001}."
log "Run initial ingestion with: npm run ingest:sample (fast) or npm run ingest:bulk (all US tickers)."
