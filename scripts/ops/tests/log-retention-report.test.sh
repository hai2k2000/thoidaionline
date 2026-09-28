#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/log" "$ROOT/bin"
truncate -s 1M "$ROOT/log/app.log"
cat > "$ROOT/bin/journalctl" <<'EOF'
#!/usr/bin/env bash
printf 'Archived and active journals take up 3.0M in the file system.\n'
EOF
chmod +x "$ROOT/bin/journalctl"
out=$(THOIDAI_LOG_ROOT="$ROOT/log" THOIDAI_JOURNALCTL_BIN="$ROOT/bin/journalctl" scripts/ops/log-retention-report.sh)
echo "$out" | grep -q $'logs\tKEEP'
echo "$out" | grep -q $'journal\tINFO'
echo "$out" | grep -q no-automatic-delete
echo PASS log-retention-report