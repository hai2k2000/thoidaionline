#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
config=${THOIDAI_DISK_GUARD_CONFIG:-$script_dir/../../deploy/disk-guard.conf}
[[ -r "$config" ]] || { echo "DISK_GUARD=BLOCKED reason=config-missing path=$config" >&2; return 1 2>/dev/null || exit 1; }
# shellcheck disable=SC1090
source "$config"
THOIDAI_DISK_HARD_MIN_KB=${THOIDAI_DISK_HARD_MIN_KB//$'\r'/}
THOIDAI_DISK_WARNING_KB=${THOIDAI_DISK_WARNING_KB//$'\r'/}
THOIDAI_DISK_DEFAULT_HEADROOM_KB=${THOIDAI_DISK_DEFAULT_HEADROOM_KB//$'\r'/}
[[ "${THOIDAI_DISK_HARD_MIN_KB:-}" =~ ^[0-9]+$ && "${THOIDAI_DISK_WARNING_KB:-}" =~ ^[0-9]+$ && "${THOIDAI_DISK_DEFAULT_HEADROOM_KB:-}" =~ ^[0-9]+$ ]] || { echo "DISK_GUARD=BLOCKED reason=invalid-config" >&2; return 1 2>/dev/null || exit 1; }

disk_guard_require() {
  local free_kb=${1:?free space in KiB required}
  local estimated_kb=${2:-0}
  local operation=${3:-operation}
  [[ "$free_kb" =~ ^[0-9]+$ && "$estimated_kb" =~ ^[0-9]+$ ]] || { echo "DISK_GUARD=BLOCKED reason=invalid-input" >&2; return 1; }
  local projected_kb=$((free_kb - estimated_kb))
  if (( free_kb < THOIDAI_DISK_HARD_MIN_KB || projected_kb < THOIDAI_DISK_HARD_MIN_KB )); then
    printf 'DISK_GUARD=BLOCKED operation=%s free_kb=%s estimated_kb=%s projected_kb=%s hard_min_kb=%s\n' "$operation" "$free_kb" "$estimated_kb" "$projected_kb" "$THOIDAI_DISK_HARD_MIN_KB" >&2
    return 1
  fi
  if (( free_kb < THOIDAI_DISK_WARNING_KB )); then
    printf 'DISK_GUARD=WARNING operation=%s free_kb=%s estimated_kb=%s projected_kb=%s warning_kb=%s hard_min_kb=%s\n' "$operation" "$free_kb" "$estimated_kb" "$projected_kb" "$THOIDAI_DISK_WARNING_KB" "$THOIDAI_DISK_HARD_MIN_KB"
  else
    printf 'DISK_GUARD=PASS operation=%s free_kb=%s estimated_kb=%s projected_kb=%s warning_kb=%s hard_min_kb=%s\n' "$operation" "$free_kb" "$estimated_kb" "$projected_kb" "$THOIDAI_DISK_WARNING_KB" "$THOIDAI_DISK_HARD_MIN_KB"
  fi
}
