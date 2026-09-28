#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/worktrees/a/node_modules" "$ROOT/worktrees/a/.next/cache" "$ROOT/build/b"
touch "$ROOT/worktrees/a/.thoidai-lifecycle"
export THOIDAI_WORKTREE_ROOT="$ROOT/worktrees" THOIDAI_BUILD_ROOT="$ROOT/build"
out=$(scripts/ops/storage-debt-report.sh)
echo "$out" | grep -q 'STORAGE LIFECYCLE DEBT'
echo "$out" | grep -q 'node_modules total:'
echo "$out" | grep -q 'Potential reclaim from SHRINK only:'
echo "$out" | grep -q 'Production changed: NO'
echo PASS storage-debt-report