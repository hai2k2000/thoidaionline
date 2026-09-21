#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/release-common.sh"
mode=dry-run
case "${1:-}" in '') ;; --dry-run) ;; --apply) mode=apply ;; *) die "usage: $0 [--dry-run|--apply]"; exit 2 ;; esac
repo=${THOIDAI_SOURCE_REPO:?source repo required}
classify() {
  local path=$1
  [[ "$path" = "$repo" ]] && { printf 'KEEP\t%s\tmain-checkout\n' "$path"; return; }
  [[ -e "$path/.keep" ]] && { printf 'KEEP\t%s\tprotected:.keep\n' "$path"; return; }
  if command -v "$THOIDAI_PGREP_BIN" >/dev/null 2>&1 && "$THOIDAI_PGREP_BIN" -af -- "$path" >/dev/null 2>&1; then printf 'KEEP\t%s\tprocess-in-use\n' "$path"; return; fi
  if command -v "$THOIDAI_LSOF_BIN" >/dev/null 2>&1 && "$THOIDAI_LSOF_BIN" +D "$path" 2>/dev/null | tail -n +2 | grep -q .; then printf 'KEEP\t%s\topen-file\n' "$path"; return; fi
  [[ -n "$(git -C "$path" status --porcelain 2>/dev/null)" ]] && { printf 'KEEP\t%s\tdirty-or-untracked\n' "$path"; return; }
  if git -C "$path" rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1 && git -C "$repo" merge-base --is-ancestor "$(git -C "$path" rev-parse HEAD)" "$(git -C "$path" rev-parse '@{upstream}')"; then
    printf 'DELETE\t%s\tclean-upstream-reachable\n' "$path"
  else
    printf 'REVIEW\t%s\tno-upstream-or-unreachable\n' "$path"
  fi
}
entries=()
while IFS= read -r path; do entries+=("$path"); done < <(git -C "$repo" worktree list --porcelain | awk '/^worktree /{print substr($0,10)}')
for path in "${entries[@]}"; do classify "$path"; done
if [[ "$mode" = apply ]]; then
  acquire_lock
  export THOIDAI_LOCK_HELD=1
  for path in "${entries[@]}"; do
    record=$(classify "$path")
    [[ "$record" == $'DELETE\t'* ]] || continue
    git -C "$repo" worktree remove "$path"
  done
  git -C "$repo" worktree prune
fi
