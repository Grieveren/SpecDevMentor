#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.test.yml"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-codementor-test}"
COMMAND="${1:-up}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not available in PATH" >&2
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Error: unable to find compose file at ${COMPOSE_FILE}" >&2
  exit 1
fi

case "$COMMAND" in
  up)
    shift || true
    echo "Starting test data services (project: ${PROJECT_NAME})..."
    if docker compose up --help | grep -q -- '--wait'; then
      docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d --wait "$@"
    else
      docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d "$@"
      echo "Waiting for containers to report healthy status..."
      wait_for_health() {
        local container="$1"
        local retries=30
        local delay=2
        for ((i=0; i<retries; i++)); do
          local status
          status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || echo "starting")
          if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
            return 0
          fi
          sleep "$delay"
        done
        echo "Warning: $container did not become healthy within expected time" >&2
        return 1
      }

      wait_for_health "codementor-postgres-test"
      wait_for_health "codementor-redis-test"
    fi
    ;;
  down)
    echo "Stopping test data services (project: ${PROJECT_NAME})..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v
    ;;
  logs)
    echo "Streaming logs for test data services (project: ${PROJECT_NAME})..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f
    ;;
  ps)
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
    ;;
  *)
    cat <<USAGE
Usage: $(basename "$0") <command>

Commands:
  up [service...]   Start the Postgres + Redis test stack (default)
  down              Stop and remove the stack
  logs              Tail logs from all services
  ps                Show container status
USAGE
    exit 1
    ;;
esac
