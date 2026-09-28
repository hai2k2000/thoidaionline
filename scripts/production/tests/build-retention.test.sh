#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/build/old" "$ROOT/build/recent" "$ROOT/build/build-evidence"
touch -d '30 days ago' "$ROOT/build/old"
export THOIDAI_BUILD_ROOT="$ROOT/build" THOIDAI_BUILD_RETENTION_DAYS=14
out=$(scripts/production/build-retention.sh)
echo "$out" | grep -q $'build\tCANDIDATE\t.*\t.*/old\tolder-than-14d'
echo "$out" | grep -q $'build\tKEEP\t.*\t.*/recent\twithin-retention'
echo "$out" | grep -q $'build\tKEEP\t.*\t.*/build-evidence\tprotected-name'
[ -d "$ROOT/build/old" ]
! scripts/production/build-retention.sh --apply >/dev/null 2>&1
echo PASS build-retention