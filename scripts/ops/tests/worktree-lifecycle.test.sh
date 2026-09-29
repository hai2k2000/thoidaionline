#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
repo="$ROOT/repo"; remote="$ROOT/remote.git"; wt="$ROOT/wt"
git init -q --bare "$remote"; git clone -q "$remote" "$repo"; git -C "$repo" config user.email test@example.invalid; git -C "$repo" config user.name test; printf seed > "$repo/file"; git -C "$repo" add file; git -C "$repo" commit -qm seed; git -C "$repo" branch -M main; git -C "$repo" push -qu origin main
export THOIDAI_SOURCE_REPO="$repo" THOIDAI_WORKTREE_ROOT="$ROOT" THOIDAI_LIFECYCLE_TTL_DAYS=7
scripts/ops/worktree-lifecycle.sh create "$wt" feature test-purpose >/dev/null
git -C "$wt" push -qu -u origin feature
mkdir -p "$wt/node_modules/pkg" "$wt/.next/cache" "$wt/.turbo"; truncate -s 1M "$wt/node_modules/pkg/a"; truncate -s 2M "$wt/.next/cache/a"
scripts/ops/worktree-lifecycle.sh close "$wt" >/dev/null
[[ ! -e "$wt/node_modules" && ! -e "$wt/.next/cache" && ! -e "$wt/.turbo" ]]
meta=$(git -C "$wt" rev-parse --git-path thoidai-lifecycle)
grep -q '^lifecycle_state=READY_FOR_CLEANUP$' "$meta"
if git -C "$wt" status --porcelain | grep -q .; then echo 'FAIL worktree-lifecycle dirtied worktree'; exit 1; fi
adopt="$ROOT/adopt"; git -C "$repo" worktree add -qb adopt "$adopt" >/dev/null; git -C "$adopt" push -qu -u origin adopt
scripts/ops/worktree-lifecycle.sh adopt "$adopt" adopted-purpose >/dev/null
adopt_meta=$(git -C "$adopt" rev-parse --git-path thoidai-lifecycle)
grep -q '^lifecycle_state=READY_FOR_CLEANUP$' "$adopt_meta"
if git -C "$adopt" status --porcelain | grep -q .; then echo 'FAIL adopt dirtied worktree'; exit 1; fi
mkdir -p "$ROOT/dirty"; git -C "$repo" worktree add -qb dirty "$ROOT/dirty" >/dev/null; git -C "$ROOT/dirty" push -qu -u origin dirty; printf dirty > "$ROOT/dirty/new"; mkdir -p "$ROOT/dirty/node_modules"; printf 'lifecycle_state=ACTIVE\n' > "$ROOT/dirty/.thoidai-lifecycle"; if scripts/ops/worktree-lifecycle.sh close "$ROOT/dirty" >/dev/null 2>&1; then exit 1; fi; [[ -d "$ROOT/dirty/node_modules" && -f "$ROOT/dirty/new" ]]
echo PASS worktree-lifecycle
