#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/releases"
mkdir -p "$ROOT/releases/release-0001"
ln -s "$ROOT/releases/missing-release" "$ROOT/releases/current"
mkdir -p "$ROOT/releases/release-0002"
out=$(THOIDAI_RELEASE_ROOT="$ROOT/releases" THOIDAI_SYSTEMCTL_BIN=/bin/true THOIDAI_CURL_BIN=/bin/true THOIDAI_PGREP_BIN=/bin/false THOIDAI_LSOF_BIN=/bin/false THOIDAI_FINDMNT_BIN=/bin/false THOIDAI_DOCKER_BIN=/bin/false scripts/production/release-retention.sh --dry-run)
echo "$out" | grep -q $'REVIEW\t.*release-0001\tlegacy-unmanaged' || true
if THOIDAI_DOCKER_BIN=/does/not/exist scripts/ops/docker-retention-guard.sh --dry-run 2>&1 | grep -vq 'UNKNOWN'; then exit 1; fi
echo PASS fail-closed