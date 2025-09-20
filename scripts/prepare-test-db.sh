#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
SERVER_ENV_FILE="${ROOT_DIR}/server/.env"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is required to run this script" >&2
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
elif [ -f "$SERVER_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$SERVER_ENV_FILE"
  set +a
fi

DATABASE_URL_TEST="${DATABASE_URL_TEST:-postgresql://codementor:password@localhost:5433/codementor_ai_test}"
REDIS_URL_TEST="${REDIS_URL_TEST:-redis://localhost:6380}"
RESET_DB="${RESET_TEST_DB:-1}"
SKIP_SEED="${SKIP_TEST_DB_SEED:-0}"

export DATABASE_URL="$DATABASE_URL_TEST"
export REDIS_URL="$REDIS_URL_TEST"

cd "$ROOT_DIR"

echo "➡️  Generating Prisma client for the server workspace"
pnpm --filter server db:generate

if [ "$RESET_DB" = "1" ]; then
  echo "➡️  Resetting test database at ${DATABASE_URL_TEST}"
  if [ "$SKIP_SEED" = "1" ]; then
    PRISMA_SKIP_SEED=1 pnpm --filter server db:reset
  else
    pnpm --filter server db:reset
  fi
else
  echo "➡️  Applying migrations to test database at ${DATABASE_URL_TEST}"
  pnpm --filter server db:migrate:prod
  if [ "$SKIP_SEED" != "1" ]; then
    echo "➡️  Seeding test database"
    pnpm --filter server db:seed
  fi
fi

if command -v redis-cli >/dev/null 2>&1; then
  echo "➡️  Flushing Redis test cache at ${REDIS_URL_TEST}"
  redis-cli -u "$REDIS_URL_TEST" FLUSHALL >/dev/null || true
else
  echo "ℹ️  redis-cli not found; skipping Redis flush"
fi

echo "✅ Test database and cache are ready"
