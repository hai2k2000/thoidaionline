#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/release-common.sh"

backup=${1:?usage: $0 <new-backup-directory>}
backup_root=${THOIDAI_MIGRATION_BACKUP_ROOT:-/opt/thoidai-backups}
root=$(realpath -m -- "$backup_root")
resolved=$(realpath -m -- "$backup")
[[ "$resolved" == "$root"/* ]] || { die "backup path outside $root"; exit 1; }
[[ ! -e "$resolved" ]] || { die "backup path already exists: $resolved"; exit 1; }
install -d -m 0700 "$resolved/rootfs"

fragment=$("$THOIDAI_SYSTEMCTL_BIN" show -P FragmentPath "$THOIDAI_SERVICE")
read -r -a dropins <<<"$("$THOIDAI_SYSTEMCTL_BIN" show -P DropInPaths "$THOIDAI_SERVICE")"
[[ -f "$fragment" ]] || { die "missing service fragment: $fragment"; exit 1; }
[[ ${#dropins[@]} -gt 0 ]] || { die "no active drop-ins captured"; exit 1; }

printf '%s\n' "$fragment" > "$resolved/fragment-path.txt"
printf '%s\n' "${dropins[@]}" > "$resolved/dropin-paths.txt"
printf '%s\n' "${#dropins[@]}" > "$resolved/dropin-count.txt"
"$THOIDAI_SYSTEMCTL_BIN" cat "$THOIDAI_SERVICE" > "$resolved/systemctl-cat.txt"
"$THOIDAI_SYSTEMCTL_BIN" show "$THOIDAI_SERVICE" > "$resolved/systemctl-show.txt"
snapshot_links > "$resolved/link-mapping.txt"

paths=("$fragment" "${dropins[@]}")
for path in "${paths[@]}"; do
  [[ -f "$path" ]] || { die "missing captured systemd file: $path"; exit 1; }
  install -D -m 0600 -- "$path" "$resolved/rootfs$path"
done

[[ "$(wc -l < "$resolved/dropin-paths.txt")" -eq "${#dropins[@]}" ]] || { die "drop-in manifest count mismatch"; exit 1; }
for path in "${paths[@]}"; do [[ -f "$resolved/rootfs$path" ]] || { die "backup incomplete: $path"; exit 1; }; done
sha256sum "${paths[@]}" > "$resolved/source-files.sha256"
(cd "$resolved/rootfs" && find . -type f -print0 | sort -z | xargs -0 sha256sum) > "$resolved/files.sha256"
chmod -R go-rwx "$resolved"
log_event "SYSTEMD_BASELINE_CAPTURED backup=$resolved dropins=${#dropins[@]}"
