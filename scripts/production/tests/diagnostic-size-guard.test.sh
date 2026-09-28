#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/diagnostic"; truncate -s 884M "$ROOT/diagnostic/debug.bin"
if THOIDAI_ARTIFACT_HARD_MAX_BYTES=805306368 scripts/production/artifact-size-guard.sh "$ROOT/diagnostic" >/tmp/oversize 2>&1; then exit 1; fi
grep -q BLOCKED_OVERSIZE /tmp/oversize
echo PASS diagnostic-size-guard