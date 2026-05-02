#!/usr/bin/env bash
# bench/example/up.sh — boot a DVWA-style target on port 18080
set -euo pipefail

NAME="vh-bench-example"
PORT=18080

# Tear down any prior instance
docker rm -f "$NAME" >/dev/null 2>&1 || true

docker run -d --rm --name "$NAME" -p "${PORT}:80" vulnerables/web-dvwa:latest

# 60-second ready poll cap (per spec §3.1 risk mitigation)
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    echo "ready"
    exit 0
  fi
  sleep 1
done

echo "TIMEOUT: target did not become ready within 60s" >&2
docker logs "$NAME" 2>&1 | tail -20 >&2 || true
docker rm -f "$NAME" >/dev/null 2>&1 || true
exit 1
