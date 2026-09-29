#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/worktrees/a/node_modules" "$ROOT/worktrees/a/.next/cache" "$ROOT/build/b"
git init -q "$ROOT/worktrees/a"
git -C "$ROOT/worktrees/a" config user.email test@example.invalid
git -C "$ROOT/worktrees/a" config user.name test
printf seed > "$ROOT/worktrees/a/file"
git -C "$ROOT/worktrees/a" add file
git -C "$ROOT/worktrees/a" commit -qm seed
meta=$(cd "$ROOT/worktrees/a" && realpath -m "$(git rev-parse --git-path thoidai-lifecycle)")
mkdir -p "$(dirname "$meta")"
cat > "$meta" <<EOF
schema_version=1
path=$ROOT/worktrees/a
branch=master
commit=$(git -C "$ROOT/worktrees/a" rev-parse HEAD)
created_at=2026-01-01T00:00:00Z
last_used_at=2026-01-01T00:00:00Z
purpose=test
owner_tool=test
protected=false
build_required=false
lifecycle_state=ACTIVE
EOF
export THOIDAI_WORKTREE_ROOT="$ROOT/worktrees" THOIDAI_BUILD_ROOT="$ROOT/build"
out=$(scripts/ops/storage-debt-report.sh)
echo "$out" | grep -q 'STORAGE LIFECYCLE DEBT'
echo "$out" | grep -q 'Active worktrees: 1'
! echo "$out" | grep -q 'UNKNOWN.*missing-metadata'
echo "$out" | grep -q 'node_modules total:'
echo "$out" | grep -q 'Potential reclaim from SHRINK only:'
echo "$out" | grep -q 'Production changed: NO'
git init -q --bare "$ROOT/remote.git"
git -C "$ROOT/worktrees/a" remote add origin "$ROOT/remote.git"
git -C "$ROOT/worktrees/a" push -qu -u origin master
git -C "$ROOT/worktrees/a" worktree add -qb candidate "$ROOT/worktrees/candidate" >/dev/null
candidate_meta=$(cd "$ROOT/worktrees/candidate" && realpath -m "$(git rev-parse --git-path thoidai-lifecycle)")
cat > "$candidate_meta" <<EOF
schema_version=1
path=$ROOT/worktrees/candidate
branch=candidate
commit=$(git -C "$ROOT/worktrees/candidate" rev-parse HEAD)
created_at=2026-01-01T00:00:00Z
purpose=test
lifecycle_state=READY_FOR_CLEANUP
EOF
adoption=$(THOIDAI_SOURCE_REPO="$ROOT/worktrees/a" THOIDAI_WORKTREE_ROOT="$ROOT/worktrees" scripts/ops/worktree-adoption-audit.sh)
echo "$adoption" | grep -q '^Managed: 2$'
echo PASS storage-debt-report
