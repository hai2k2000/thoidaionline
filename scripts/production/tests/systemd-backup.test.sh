#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/systemd/service.d" "$TMP/backups"
printf base > "$TMP/systemd/service"
printf one > "$TMP/systemd/service.d/10-one.conf"
printf two > "$TMP/systemd/service.d/20-two.conf"

cat > "$TMP/bin/systemctl" <<EOF
#!/usr/bin/env bash
if [[ "\$1" == show && "\$2" == -P && "\$3" == FragmentPath ]]; then printf '%s\n' '$TMP/systemd/service'; exit 0; fi
if [[ "\$1" == show && "\$2" == -P && "\$3" == DropInPaths ]]; then printf '%s %s\n' '$TMP/systemd/service.d/10-one.conf' '$TMP/systemd/service.d/20-two.conf'; exit 0; fi
if [[ "\$1" == cat ]]; then printf 'cat-output\n'; exit 0; fi
if [[ "\$1" == show ]]; then printf 'show-output\n'; exit 0; fi
exit 1
EOF
chmod +x "$TMP/bin/systemctl"

export THOIDAI_SYSTEMCTL_BIN="$TMP/bin/systemctl"
export THOIDAI_MIGRATION_BACKUP_ROOT="$TMP/backups"
backup="$TMP/backups/run-001"
"$ROOT/scripts/production/capture-systemd-baseline.sh" "$backup"

[ "$(cat "$backup/dropin-count.txt")" = 2 ]
[ "$(wc -l < "$backup/dropin-paths.txt")" -eq 2 ]
[ -f "$backup/rootfs$TMP/systemd/service" ]
[ -f "$backup/rootfs$TMP/systemd/service.d/10-one.conf" ]
[ -f "$backup/rootfs$TMP/systemd/service.d/20-two.conf" ]
grep -q '10-one.conf' "$backup/files.sha256"
grep -q '20-two.conf' "$backup/files.sha256"
echo "PASS systemd-backup"
