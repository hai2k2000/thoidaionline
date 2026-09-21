#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
BIN="$ROOT/bin"
mkdir -p "$BIN" "$ROOT/releases" "$ROOT/systemd"
cat > "$BIN/systemctl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$BIN/curl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$BIN/false-ref" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
cat > "$BIN/empty-ref" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$BIN/false-ref"
chmod +x "$BIN/empty-ref" "$BIN/systemctl" "$BIN/curl"
export THOIDAI_SYSTEMCTL_BIN="$BIN/systemctl"
export THOIDAI_CURL_BIN="$BIN/curl"
export THOIDAI_RELEASE_ROOT="$ROOT/releases"
export THOIDAI_SYSTEMD_ROOT="$ROOT/systemd"
export THOIDAI_LOCK_FILE="$ROOT/lock"
export THOIDAI_TEST_MODE=1
export THOIDAI_PGREP_BIN="$BIN/false-ref"
export THOIDAI_LSOF_BIN="$BIN/empty-ref"
export THOIDAI_FINDMNT_BIN="$BIN/empty-ref"
export THOIDAI_DOCKER_BIN="$BIN/empty-ref"

mkdir -p "$THOIDAI_RELEASE_ROOT/current-release-0001" "$THOIDAI_RELEASE_ROOT/old-release-0002" "$THOIDAI_RELEASE_ROOT/protected-release-0003" "$THOIDAI_RELEASE_ROOT/rollback-release-0004" "$THOIDAI_RELEASE_ROOT/rollback-release-0005"
mkdir -p "$THOIDAI_RELEASE_ROOT/ops-backups" "$THOIDAI_RELEASE_ROOT/build-evidence"
touch "$THOIDAI_RELEASE_ROOT/protected-release-0003/.keep"
ln -s "$THOIDAI_RELEASE_ROOT/current-release-0001" "$THOIDAI_RELEASE_ROOT/current"
ln -s "$THOIDAI_RELEASE_ROOT/rollback-release-0005" "$THOIDAI_RELEASE_ROOT/previous"
ln -s "$THOIDAI_RELEASE_ROOT/rollback-release-0004" "$THOIDAI_RELEASE_ROOT/rollback-2"

out=$("$(dirname "$0")/../release-retention.sh")
echo "$out" | grep -q $'KEEP\t.*current-release-0001\tcurrent'
echo "$out" | grep -q $'DELETE\t.*old-release-0002\told-unused'
echo "$out" | grep -q $'KEEP\t.*protected-release-0003\tprotected:.keep'
! echo "$out" | grep -q 'ops-backups'
! echo "$out" | grep -q 'build-evidence'
[ -d "$THOIDAI_RELEASE_ROOT/old-release-0002" ]

"$(dirname "$0")/../release-retention.sh" --apply >/dev/null
[ ! -e "$THOIDAI_RELEASE_ROOT/old-release-0002" ]

mkdir -p "$THOIDAI_RELEASE_ROOT/old-release-0006"
export THOIDAI_LSOF_BIN="$BIN/missing-lsof"
out=$("$(dirname "$0")/../release-retention.sh" --dry-run)
echo "$out" | grep -q $'REVIEW\t.*old-release-0006\tinspection-unavailable'
export THOIDAI_LSOF_BIN="$BIN/false-ref"

rm -f "$THOIDAI_RELEASE_ROOT/current" "$THOIDAI_RELEASE_ROOT/previous" "$THOIDAI_RELEASE_ROOT/rollback-2"
mkdir -p "$THOIDAI_RELEASE_ROOT/legacy-release-0004"
out=$("$(dirname "$0")/../release-retention.sh" --dry-run)
echo "$out" | grep -q $'REVIEW\t.*legacy-release-0004\tlegacy-unmanaged'

echo "PASS release-retention"
