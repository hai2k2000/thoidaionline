#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/small" "$ROOT/large"
printf x > "$ROOT/small/a"
truncate -s 2M "$ROOT/large/a"
small=$(THOIDAI_MAX_ARTIFACT_GIB=0.01 scripts/production/artifact-size-guard.sh "$ROOT/small")
echo "$small" | grep -q 'ARTIFACT_SIZE'
if THOIDAI_MAX_ARTIFACT_GIB=0.000001 scripts/production/artifact-size-guard.sh "$ROOT/large" >/dev/null 2>&1; then exit 1; fi
if scripts/production/artifact-size-guard.sh "$ROOT/missing" >/dev/null 2>&1; then exit 1; fi
echo PASS artifact-size-guard