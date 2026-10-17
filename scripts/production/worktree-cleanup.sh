#!/usr/bin/env bash
set -euo pipefail

# Lifecycle close is explicit: dry-run is the default and --apply needs task completion.
usage() {
  cat <<'USAGE'
Usage: worktree-cleanup.sh [--repo PATH] [--worktree PATH ...] [--task-complete] [--apply]

Without --apply the script only reports KEEP/SKIP/DELETE decisions.
--apply requires --task-complete and removes only verified, clean, pushed worktrees.
USAGE
}

repo=""
apply=0
task_complete=0
declare -a requested=()

while (($#)); do
  case "$1" in
    --repo) repo=${2:?missing repository path}; shift 2 ;;
    --worktree) requested+=("${2:?missing worktree path}"); shift 2 ;;
    --task-complete) task_complete=1; shift ;;
    --apply) apply=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if ((apply && !task_complete)); then
  echo "ERROR --apply requires --task-complete" >&2
  exit 2
fi

repo=${repo:-$(git rev-parse --show-toplevel)}
repo=$(cd "$repo" && pwd -P)
git -C "$repo" rev-parse --git-dir >/dev/null

declare -a worktrees=()
if ((${#requested[@]})); then
  worktrees=("${requested[@]}")
else
  current=""
  while IFS= read -r line; do
    case "$line" in
      worktree\ *) current=${line#worktree } ;;
      HEAD\ *) [[ "$current" == "$repo" ]] || worktrees+=("$current"); current="" ;;
    esac
  done < <(git -C "$repo" worktree list --porcelain)
fi

is_registered() {
  git -C "$repo" worktree list --porcelain | awk -v p="$1" '$0 == "worktree " p {found=1} END {exit !found}'
}

has_process() {
  local path=$1 p cwd
  for p in /proc/[0-9]*; do
    cwd=$(readlink -f "$p/cwd" 2>/dev/null || true)
    [[ "$cwd" == "$path" || "$cwd" == "$path"/* ]] && return 0
  done
  return 1
}

runtime_references() {
  local path=$1
  systemctl cat thoidai-work.service 2>/dev/null | grep -F -- "$path" >/dev/null
}

for path in "${worktrees[@]}"; do
  path=$(cd "$path" 2>/dev/null && pwd -P || true)
  if [[ -z "$path" || ! -d "$path" ]]; then
    echo "SKIP $path reason=missing-path"
    continue
  fi
  if ! is_registered "$path"; then
    echo "SKIP $path reason=not-registered"
    continue
  fi
  case "$path" in
    /opt/worktrees/*|/opt/build/*) ;;
    *) echo "KEEP $path reason=outside-allowlisted-roots"; continue ;;
  esac
  if [[ "$path" == "$repo" || "$path" == /opt/build/asset-management-v2-canonical ]]; then
    echo "KEEP $path reason=canonical-worktree"
    continue
  fi
  branch=$(git -C "$path" symbolic-ref --short -q HEAD 2>/dev/null || echo DETACHED)
  if [[ "$branch" == integration/production ]]; then
    echo "KEEP $path reason=production-branch"
    continue
  fi
  if [[ -n "$(git -C "$path" status --porcelain 2>/dev/null)" ]]; then
    echo "KEEP $path reason=dirty"
    continue
  fi
  head=$(git -C "$path" rev-parse HEAD)
  if ! git -C "$repo" branch -r --contains "$head" 2>/dev/null | grep -q 'origin/'; then
    echo "KEEP $path reason=head-not-on-origin"
    continue
  fi
  if has_process "$path"; then
    echo "KEEP $path reason=active-process"
    continue
  fi
  if runtime_references "$path"; then
    echo "KEEP $path reason=runtime-reference"
    continue
  fi
  gitdir=$(git -C "$path" rev-parse --git-dir)
  if [[ -e "$gitdir/locked" ]]; then
    echo "KEEP $path reason=git-locked"
    continue
  fi
  if ((apply)); then
    git -C "$repo" worktree remove "$path"
    echo "DELETE $path reason=task-complete-clean-pushed-unused"
  else
    echo "DELETE $path reason=task-complete-clean-pushed-unused dry-run=true"
  fi
done
