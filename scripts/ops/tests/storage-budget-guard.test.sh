#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/worktrees/a" "$ROOT/build" "$ROOT/bin"
truncate -s 2M "$ROOT/worktrees/a/file"
cat > "$ROOT/bin/df" <<'EOF'
#!/usr/bin/env bash
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/test 10000000 9000000 1000000 90%% /\n'
EOF
chmod +x "$ROOT/bin/df"
export THOIDAI_WORKTREE_ROOT="$ROOT/worktrees" THOIDAI_BUILD_ROOT="$ROOT/build" THOIDAI_DF_BIN="$ROOT/bin/df" THOIDAI_WORKTREE_MAX_TOTAL_BYTES=1048576 THOIDAI_MIN_FREE_DISK_BYTES=2147483648
if scripts/ops/storage-budget-guard.sh worktree "$ROOT/worktrees/new" >/dev/null 2>&1; then exit 1; fi
if scripts/ops/storage-budget-guard.sh build "$ROOT/build/new" >/dev/null 2>&1; then exit 1; fi
echo PASS storage-budget-guard