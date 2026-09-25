#!/usr/bin/env bash
set -Eeuo pipefail
cache_path=${THOIDAI_CACHE_PATH:-/opt/releases/thoidai-work/current/.next/cache}
expected_user=${THOIDAI_SERVICE_USER:-thoidai-work}
expected_group=${THOIDAI_SERVICE_GROUP:-thoidai-work}
[[ -d "$cache_path" ]] || { echo "cache path missing: $cache_path" >&2; exit 1; }
owner=$(stat -c '%U:%G' -- "$cache_path")
mode=$(stat -c '%a' -- "$cache_path")
[[ "$owner" == "$expected_user:$expected_group" ]] || { echo "cache ownership mismatch: $owner" >&2; exit 1; }
runuser -u "$expected_user" -- test -w "$cache_path" || { echo "cache is not writable by service user: $mode" >&2; exit 1; }
echo "cache-permissions: PASS ($cache_path $owner $mode)"
