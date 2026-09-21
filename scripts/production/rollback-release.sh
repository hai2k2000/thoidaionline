#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/release-common.sh"

target_name=previous
[[ "${1:-}" == --to-rollback-2 ]] && target_name=rollback-2
[[ -z "${1:-}" || "$1" == --to-rollback-2 ]] || { echo "usage: $0 [--to-rollback-2]" >&2; exit 2; }
acquire_lock
export THOIDAI_LOCK_HELD=1
snapshot=$(mktemp)
trap 'rm -f "$snapshot"' EXIT
snapshot_links > "$snapshot"
target=$(resolve_link_target "$THOIDAI_RELEASE_ROOT/$target_name")
atomic_link "$target" "$THOIDAI_RELEASE_ROOT/current"
if [[ "${THOIDAI_ALLOW_RESTART:-0}" != 1 ]]; then restore_links "$snapshot"; die "production restart not authorized in implementation checkpoint"; fi
"$THOIDAI_SYSTEMCTL_BIN" restart "$THOIDAI_SERVICE"
if ! health_check; then
  restore_links "$snapshot"
  "$THOIDAI_SYSTEMCTL_BIN" restart "$THOIDAI_SERVICE" || true
  die "rollback health failed"
fi
old_current=$(awk -F= '$1=="current"{print $2}' "$snapshot")
[[ -z "$old_current" ]] || atomic_link "$old_current" "$THOIDAI_RELEASE_ROOT/previous"
