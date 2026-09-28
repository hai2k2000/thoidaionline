#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
: "${THOIDAI_BUILD_ROOT:=/opt/build/thoidai-work}"
: "${THOIDAI_BUILD_DEBUG_TTL_HOURS:=2}"
cmd=${1:?usage}
case "$cmd" in
 create)
   id=${2:?id required}; mkdir -p "$THOIDAI_BUILD_ROOT"; "$SCRIPT_DIR/../ops/storage-budget-guard.sh" build "$THOIDAI_BUILD_ROOT/$id-$$" >/dev/null; path="$THOIDAI_BUILD_ROOT/$id-$$"; printf '%s\n' "$path" ;;
 cleanup)
   path=${2:?}; result=${3:?}; root=$(realpath -m "$THOIDAI_BUILD_ROOT"); real=$(realpath -m "$path"); [[ "$real" == "$root"/* ]] || { echo outside-root >&2; exit 1; }; [[ -d "$real" ]] || exit 0
   if [[ "$result" == success ]]; then rm -rf -- "$real"; else printf 'created_at=%s\nlifecycle_state=FAILED_DEBUG\nexpires_at_epoch=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(( $(date +%s)+THOIDAI_BUILD_DEBUG_TTL_HOURS*3600 ))" > "$real/.build-lifecycle"; fi ;;
 *) exit 2;;
esac