#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA_DIR="$(mktemp -d -t vh-smoke.XXXXXX)"
export VIBEHACK_DATA_DIR="$DATA_DIR"

cleanup() {
  docker compose -f "$ROOT/tests/e2e/docker-compose.yml" down -v >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR"
}
trap cleanup EXIT

echo "=== bringing up DVWA ==="
docker compose -f "$ROOT/tests/e2e/docker-compose.yml" up -d
echo "=== waiting for DVWA on http://127.0.0.1:8080 ==="
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8080/login.php >/dev/null 2>&1; then break; fi
  sleep 2
done

echo "=== running smoke test ==="
cd "$ROOT"
npx vitest run tests/e2e/dvwa-smoke.test.ts --reporter=verbose
