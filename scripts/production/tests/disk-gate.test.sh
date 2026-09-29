#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/releases" "$ROOT/systemd" "$ROOT/bin"
cat > "$ROOT/bin/df" <<'EOF'
#!/usr/bin/env bash
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/test 100000000 50000000 50000000 50%% /\n'
EOF
chmod +x "$ROOT/bin/df"
export THOIDAI_RELEASE_ROOT="$ROOT/releases" THOIDAI_SYSTEMD_ROOT="$ROOT/systemd" THOIDAI_LOCK_FILE="$ROOT/lock" THOIDAI_DF_BIN="$ROOT/bin/df" THOIDAI_HARD_MIN_FREE_GIB=1 THOIDAI_ESTIMATED_RELEASE_GIB=1
source scripts/production/release-common.sh
disk_guard >/dev/null
THOIDAI_HARD_MIN_FREE_GIB=1 THOIDAI_ESTIMATED_RELEASE_GIB=1 scripts/production/disk-gate.sh >/dev/null
export THOIDAI_HARD_MIN_FREE_GIB=100
if disk_guard >/dev/null 2>&1; then exit 1; fi
echo PASS release-common-disk-gate
