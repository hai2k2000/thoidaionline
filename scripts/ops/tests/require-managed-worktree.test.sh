#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
repo="$ROOT/repo"; remote="$ROOT/remote.git"; wt="$ROOT/wt"; mkdir -p "$ROOT"
git init -q --bare "$remote"; git clone -q "$remote" "$repo"; git -C "$repo" config user.email test@example.invalid; git -C "$repo" config user.name test; printf seed > "$repo/file"; git -C "$repo" add file; git -C "$repo" commit -qm seed; git -C "$repo" branch -M main; git -C "$repo" push -qu origin main
if scripts/ops/require-managed-worktree.sh "$repo" >/dev/null 2>&1; then exit 1; fi
git -C "$repo" worktree add -qb feature "$wt" >/dev/null; if scripts/ops/require-managed-worktree.sh "$wt" >/dev/null 2>&1; then exit 1; fi
printf 'path=%s\nbranch=feature\ncommit=%s\ncreated_at=2026-09-28T00:00:00Z\nlast_used_at=2026-09-28T00:00:00Z\npurpose=test\nowner_tool=test\nprotected=false\nbuild_required=false\nlifecycle_state=ACTIVE\nschema_version=1\n' "$wt" "$(git -C "$wt" rev-parse HEAD)" > "$wt/.thoidai-lifecycle"
scripts/ops/require-managed-worktree.sh "$wt" >/dev/null
printf 'path=%s\nbranch=feature\ncommit=bad\nlifecycle_state=ACTIVE\nschema_version=1\n' "$wt" > "$wt/.thoidai-lifecycle"
if scripts/ops/require-managed-worktree.sh "$wt" >/dev/null 2>&1; then exit 1; fi
THOIDAI_MANAGED_SOURCE_EXCEPTION=immutable-build scripts/ops/require-managed-worktree.sh "$repo" >/dev/null
echo PASS require-managed-worktree