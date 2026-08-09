#!/usr/bin/env bash
# Host-side orchestrator: builds the screenshot image (Expo web + Playwright)
# with podman, runs it, and copies the captured PNGs into assets/screenshots.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

IMG=pawly-screenshots

podman build -t "$IMG" -f scripts/screenshots/Dockerfile .

podman run --rm \
  -v "$PWD/assets/screenshots:/out" \
  "$IMG"

echo "screenshots written to assets/screenshots/"
ls -la assets/screenshots/
