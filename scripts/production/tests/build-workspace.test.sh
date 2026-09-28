#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
export THOIDAI_BUILD_ROOT="$ROOT/build" THOIDAI_BUILD_DEBUG_TTL_HOURS=1
path=$(scripts/production/build-workspace.sh create test-build)
[[ -d "$path" ]]
printf x > "$path/marker"
scripts/production/build-workspace.sh cleanup "$path" success
[[ ! -e "$path" ]]
path=$(scripts/production/build-workspace.sh create failed-build)
scripts/production/build-workspace.sh cleanup "$path" failure
[[ -d "$path" ]]
scripts/production/build-workspace.sh cleanup "$path" success
[[ ! -e "$path" ]]
echo PASS build-workspace