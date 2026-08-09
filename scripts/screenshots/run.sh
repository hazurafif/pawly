#!/usr/bin/env bash
# Runs inside the screenshot container: serves the exported web build, then
# captures every app route with Playwright.
set -euo pipefail

node /workspace/run/serve.mjs >/tmp/serve.log 2>&1 &
SRV_PID=$!
trap 'kill $SRV_PID 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  if curl -sf -o /dev/null http://localhost:8081/; then
    echo "static server up after ${i} checks"
    break
  fi
  if ! kill -0 $SRV_PID 2>/dev/null; then
    echo "static server died — log:" >&2
    cat /tmp/serve.log >&2
    exit 1
  fi
  sleep 1
done

mkdir -p /out
node /workspace/run/screenshot.mjs
