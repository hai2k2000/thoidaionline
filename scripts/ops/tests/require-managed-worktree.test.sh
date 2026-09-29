#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
repo="$ROOT/repo"; remote="$ROOT/remote.git"; wt="$ROOT/wt"; git init -q --bare "$remote"; git clone -q "$remote" "$repo"; git -C "$repo" config user.email test@example.invalid; git -C "$repo" config user.name test; printf seed > "$repo/file"; git -C "$repo" add file; git -C "$repo" commit -qm seed; git -C "$repo" branch -M main; git -C "$repo" push -qu origin main; git -C "$repo" worktree add -qb feature "$wt" >/dev/null
write_good(){ printf 'schema_version=1\npath=%s\nbranch=feature\ncommit=%s\ncreated_at=2026-09-28T00:00:00Z\nlast_used_at=2026-09-28T00:00:00Z\npurpose=test\nowner_tool=test\nprotected=false\nbuild_required=false\nlifecycle_state=ACTIVE\n' "$wt" "$(git -C "$wt" rev-parse HEAD)" > "$wt/.thoidai-lifecycle"; }
write_good; scripts/ops/require-managed-worktree.sh "$wt" >/dev/null
for mutation in bad-time bad-schema bad-state; do write_good; case "$mutation" in bad-time) sed -i 's/^created_at=.*/created_at=not-a-time/' "$wt/.thoidai-lifecycle";; bad-schema) sed -i 's/^schema_version=.*/schema_version=99/' "$wt/.thoidai-lifecycle";; bad-state) sed -i 's/^lifecycle_state=.*/lifecycle_state=FORGED/' "$wt/.thoidai-lifecycle";; esac; if scripts/ops/require-managed-worktree.sh "$wt" >/dev/null 2>&1; then echo "FAIL $mutation"; exit 1; fi; done
THOIDAI_MANAGED_SOURCE_EXCEPTION=immutable-build scripts/ops/require-managed-worktree.sh "$repo" >/dev/null
echo PASS require-managed-worktree