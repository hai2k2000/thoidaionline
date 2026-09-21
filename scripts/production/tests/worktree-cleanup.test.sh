#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
repo="$ROOT/repo"
remote="$ROOT/remote.git"
mkdir -p "$repo"
git init -q --bare "$remote"
git clone -q "$remote" "$repo/main"
git -C "$repo/main" config user.email test@example.invalid
git -C "$repo/main" config user.name test
printf seed > "$repo/main/file"
git -C "$repo/main" add file
git -C "$repo/main" commit -qm seed
git -C "$repo/main" branch -M main
git -C "$repo/main" push -qu origin main
git -C "$repo/main" worktree add -qb clean-branch "$repo/clean"
git -C "$repo/main" worktree add -qb dirty-branch "$repo/dirty"
git -C "$repo/clean" push -qu -u origin clean-branch
git -C "$repo/dirty" push -qu -u origin dirty-branch
printf dirty >> "$repo/dirty/file"
printf untracked > "$repo/dirty/untracked"

export THOIDAI_SOURCE_REPO="$repo/main"
export THOIDAI_WORKTREE_ROOT="$repo"
export THOIDAI_LOCK_FILE="$ROOT/lock"
export THOIDAI_TEST_MODE=1
export THOIDAI_PGREP_BIN=/bin/false
export THOIDAI_LSOF_BIN=/bin/false
out=$("$(dirname "$0")/../worktree-cleanup.sh")
echo "$out" | grep -q $'DELETE\t.*clean\tclean-upstream-reachable'
echo "$out" | grep -q $'KEEP\t.*dirty\tdirty-or-untracked'
"$(dirname "$0")/../worktree-cleanup.sh" --apply >/dev/null
[ ! -e "$repo/clean" ]
[ -e "$repo/dirty" ]

echo "PASS worktree-cleanup"
