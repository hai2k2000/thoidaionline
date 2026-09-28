#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
: "${THOIDAI_SOURCE_REPO:=/opt/thoidai-work}"
: "${THOIDAI_WORKTREE_ROOT:=/opt/worktrees}"
: "${THOIDAI_LIFECYCLE_TTL_DAYS:=7}"
usage(){ echo "usage: $0 create <path> <branch> <purpose> | status <path> | close <path> | shrink <path> | remove <path>" >&2; exit 2; }
cmd=${1:-}; path=${2:-}; [[ -n "$cmd" && -n "$path" ]] || usage
root=$(realpath -m -- "$THOIDAI_WORKTREE_ROOT"); real=$(realpath -m -- "$path"); [[ "$real" == "$root"/* ]] || { echo 'ERROR: path outside worktree root' >&2; exit 1; }
meta="$real/.thoidai-lifecycle"
write_meta(){ local state=$1 branch commit now; branch=$(git -C "$real" symbolic-ref --short -q HEAD || echo detached); commit=$(git -C "$real" rev-parse HEAD); now=$(date -u +%Y-%m-%dT%H:%M:%SZ); { printf 'schema_version=1\npath=%s\nbranch=%s\ncommit=%s\ncreated_at=%s\nlast_used_at=%s\npurpose=%s\nowner_tool=%s\nprotected=%s\nbuild_required=%s\nlifecycle_state=%s\n' "$real" "$branch" "$commit" "${created_at:-$now}" "$now" "${purpose:-managed}" "${owner_tool:-worktree-lifecycle}" "${protected:-false}" "${build_required:-false}" "$state"; } > "$meta"; }
dirty_status(){ git -C "$real" status --porcelain -- . ":(exclude).thoidai-lifecycle" ":(exclude)node_modules" ":(exclude).next" ":(exclude).turbo" ":(exclude).cache" ":(exclude)coverage"; }
shrink(){ [[ -d "$real" ]] || { echo 'ERROR: worktree missing' >&2; exit 1; }; [[ -n "$(dirty_status 2>/dev/null)" ]] && { echo 'ERROR: dirty source; refusing shrink' >&2; exit 1; }; rm -rf -- "$real/node_modules" "$real/.next/cache" "$real/.next/trace" "$real/.turbo" "$real/.cache" "$real/coverage"; }
case "$cmd" in
 create) [[ ! -e "$real" ]] || { echo 'ERROR: worktree path exists' >&2; exit 1; }; mkdir -p "$(dirname "$real")"; "$SCRIPT_DIR/storage-budget-guard.sh" worktree "$real" >/dev/null; git -C "$THOIDAI_SOURCE_REPO" worktree add -b "${3:?branch required}" "$real" >/dev/null; purpose=${4:-managed}; owner_tool=${THOIDAI_OWNER_TOOL:-worktree-lifecycle}; protected=${THOIDAI_PROTECTED:-false}; build_required=${THOIDAI_BUILD_REQUIRED:-false}; write_meta ACTIVE ;;
 status) [[ -f "$meta" ]] || { echo 'UNKNOWN'; exit 0; }; cat "$meta" ;;
 close) [[ -f "$meta" ]] || { echo 'ERROR: lifecycle metadata missing' >&2; exit 1; }; [[ -z "$(dirty_status)" ]] || { echo 'ERROR: worktree is dirty' >&2; exit 1; }; git -C "$real" rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1 || { echo 'ERROR: branch has no recoverable upstream' >&2; exit 1; }; shrink; source "$meta"; write_meta READY_FOR_CLEANUP ;;
 shrink) [[ -f "$meta" ]] || { echo 'ERROR: lifecycle metadata missing' >&2; exit 1; }; source "$meta"; [[ "$lifecycle_state" == IDLE || "$lifecycle_state" == READY_FOR_CLEANUP ]] || { echo 'ERROR: state does not permit shrink' >&2; exit 1; }; shrink; write_meta READY_FOR_CLEANUP ;;
 remove) [[ -f "$meta" ]] || { echo 'ERROR: lifecycle metadata missing' >&2; exit 1; }; source "$meta"; [[ "$lifecycle_state" == READY_FOR_CLEANUP ]] || { echo 'ERROR: remove requires READY_FOR_CLEANUP' >&2; exit 1; }; [[ -z "$(dirty_status)" ]] || { echo 'ERROR: dirty source' >&2; exit 1; }; git -C "$THOIDAI_SOURCE_REPO" worktree remove "$real" ;;
 *) usage;;
esac