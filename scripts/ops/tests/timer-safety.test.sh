#!/usr/bin/env bash
set -Eeuo pipefail
for unit in ops/systemd/thoidai-storage-inventory.service ops/systemd/thoidai-storage-inventory.timer ops/systemd/thoidai-storage-dry-run.service ops/systemd/thoidai-storage-dry-run.timer; do test -s "$unit"; done
! grep -En 'volume prune|system prune --volumes|docker compose down -v|--apply|rm -rf' ops/systemd/thoidai-storage-*.service ops/systemd/thoidai-storage-*.timer
echo PASS timer-safety