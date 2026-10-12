#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); source "$SCRIPT_DIR/release-common.sh"
mode=dry-run; case "${1:-}" in '') ;; --dry-run) ;; --apply) mode=apply ;; *) die "usage"; exit 2;; esac
repo=${THOIDAI_SOURCE_REPO:?source repo required}; : "${THOIDAI_LSOF_TIMEOUT_SEC:=3}"
dirty_status(){ git -C "$1" status --porcelain 2>/dev/null | grep -v -E '^.. (\.thoidai-lifecycle|node_modules/|\.next/|\.turbo/|\.cache/|coverage/)' || true; }
resolve_meta(){
  local path=$1 git_path
  git_path=$(git -C "$path" rev-parse --git-path thoidai-lifecycle 2>/dev/null) || return 1
  case "$git_path" in
    /*) realpath -m -- "$git_path" ;;
    *) realpath -m -- "$path/$git_path" ;;
  esac
}
classify(){
  local path=$1 state meta metadata_path
  [[ "$path" = "$repo" ]] && { printf 'KEEP\t%s\tmain-checkout\n' "$path"; return; }
  [[ -e "$path/.keep" ]] && { printf 'KEEP\t%s\tprotected:.keep\n' "$path"; return; }
  meta=$(resolve_meta "$path" 2>/dev/null || true)
  [[ -n "$meta" && -f "$meta" ]] || { printf 'REVIEW\t%s\tmissing-lifecycle-metadata\n' "$path"; return; }
  metadata_path=$(awk -F= '$1=="path"{print $2}' "$meta")
  [[ "$metadata_path" == "$(realpath -m -- "$path")" ]] || { printf 'REVIEW\t%s\tmetadata-path-mismatch\n' "$path"; return; }
  state=$(awk -F= '$1=="lifecycle_state"{print $2}' "$meta")
  [[ "$state" == READY_FOR_CLEANUP ]] || { printf 'KEEP\t%s\tlifecycle-state-%s\n' "$path" "$state"; return; }
  if command -v "$THOIDAI_PGREP_BIN" >/dev/null 2>&1 && "$THOIDAI_PGREP_BIN" -af -- "$path" >/dev/null 2>&1; then printf 'KEEP\t%s\tprocess-in-use\n' "$path"; return; fi
  if command -v "$THOIDAI_LSOF_BIN" >/dev/null 2>&1 && timeout "$THOIDAI_LSOF_TIMEOUT_SEC" "$THOIDAI_LSOF_BIN" +D "$path" 2>/dev/null | tail -n +2 | grep -q .; then printf 'KEEP\t%s\topen-file\n' "$path"; return; fi
  [[ -z "$(dirty_status "$path")" ]] || { printf 'KEEP\t%s\tdirty-or-untracked\n' "$path"; return; }
  if git -C "$path" rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1 && git -C "$repo" merge-base --is-ancestor "$(git -C "$path" rev-parse HEAD)" "$(git -C "$path" rev-parse '@{upstream}')"; then printf 'DELETE\t%s\tclean-upstream-reachable\n' "$path"; else printf 'REVIEW\t%s\tno-upstream-or-unreachable\n' "$path"; fi
}
entries=(); while IFS= read -r path; do entries+=("$path"); done < <(git -C "$repo" worktree list --porcelain | awk '/^worktree /{print substr($0,10)}'); for path in "${entries[@]}"; do classify "$path"; done
if [[ "$mode" = apply ]]; then [[ "${THOIDAI_OWNER_APPROVED_CLEANUP:-0}" = 1 || "${THOIDAI_TEST_MODE:-0}" = 1 ]] || { die "apply requires owner approval"; return 1; }; acquire_lock; for path in "${entries[@]}"; do record=$(classify "$path"); [[ "$record" == $'DELETE\t'* ]] || continue; git -C "$repo" worktree remove --force "$path"; done; git -C "$repo" worktree prune; fi
