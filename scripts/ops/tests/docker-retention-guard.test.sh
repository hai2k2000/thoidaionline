#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/bin"
cat > "$ROOT/bin/docker" <<'EOF'
#!/usr/bin/env bash
case "$1 $2" in
  "ps -aq") printf 'c1\n' ;;
  "inspect c1") printf 'sha256:used\n' ;;
  "image ls") printf 'used:tag\tsha256:used\t1GB\nold:tag\tsha256:old\t2GB\n' ;;
  "volume ls") printf 'supabase_db_thoidai-work\nrecovery_store\nunknown_store\n' ;;
  *) exit 1;;
esac
EOF
chmod +x "$ROOT/bin/docker"
export THOIDAI_DOCKER_BIN="$ROOT/bin/docker"
out=$(scripts/ops/docker-retention-guard.sh)
echo "$out" | grep -q $'docker-image\tKEEP\t0\tused:tag'
echo "$out" | grep -q $'docker-image\tCANDIDATE\t0\told:tag'
echo "$out" | grep -q $'docker-volume\tKEEP\t0\tsupabase_db_thoidai-work'
echo "$out" | grep -q $'docker-volume\tKEEP\t0\trecovery_store'
echo "$out" | grep -q $'docker-volume\tUNKNOWN\t0\tunknown_store'
! scripts/ops/docker-retention-guard.sh --apply >/dev/null 2>&1
echo PASS docker-retention-guard