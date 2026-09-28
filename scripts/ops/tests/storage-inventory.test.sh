#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/bin" "$ROOT/worktrees" "$ROOT/releases" "$ROOT/build" "$ROOT/log" "$ROOT/report"
cat > "$ROOT/bin/docker" <<'EOF'
#!/usr/bin/env bash
case "$1 $2" in
  "image ls") printf 'old:tag\tsha256:old\t12MB\n' ;;
  "volume ls") printf 'supabase_db_thoidai-work\nunknown-volume\n' ;;
  "volume inspect") printf '/missing/mount\n' ;;
  *) exit 1;;
esac
EOF
cat > "$ROOT/bin/journalctl" <<'EOF'
#!/usr/bin/env bash
printf 'Archived and active journals take up 12.0M in the file system.\n'
EOF
cat > "$ROOT/bin/lsof" <<'EOF'
#!/usr/bin/env bash
printf 'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\n'
EOF
chmod +x "$ROOT/bin"/*
mkdir -p "$ROOT/releases/release-0001" "$ROOT/worktrees/w1"; printf x > "$ROOT/releases/release-0001/file"
export THOIDAI_SOURCE_REPO="$ROOT/source" THOIDAI_WORKTREE_ROOT="$ROOT/worktrees" THOIDAI_RELEASE_ROOT="$ROOT/releases" THOIDAI_BUILD_ROOT="$ROOT/build" THOIDAI_LOG_ROOT="$ROOT/log" THOIDAI_REPORT_ROOT="$ROOT/report" THOIDAI_DOCKER_BIN="$ROOT/bin/docker" THOIDAI_JOURNALCTL_BIN="$ROOT/bin/journalctl" PATH="$ROOT/bin:$PATH"
out=$(scripts/ops/storage-inventory.sh)
echo "$out" | grep -q $'STORAGE_INVENTORY\tmode=read-only'
echo "$out" | grep -q $'docker-volume\tKEEP\t0\tsupabase_db_thoidai-work\tproduction-db-protected'
echo "$out" | grep -q $'docker-volume\tUNKNOWN\t0\tunknown-volume\tunclassified-volume-review'
echo "$out" | grep -q $'STORAGE_INVENTORY_END\tproduction_changed=NO'
[ -f "$ROOT/releases/release-0001/file" ]
echo PASS storage-inventory