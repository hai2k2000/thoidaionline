#!/usr/bin/env bash
set -Eeuo pipefail

: "${THOIDAI_RELEASE_ROOT:=/opt/releases/thoidai-work}"
: "${THOIDAI_SERVICE:=thoidai-work.service}"
: "${THOIDAI_HEALTH_URL:=http://127.0.0.1:3001/login}"
: "${THOIDAI_SYSTEMCTL_BIN:=systemctl}"
: "${THOIDAI_CURL_BIN:=curl}"

mode=dry-run
case "${1:-}" in
  ""|--dry-run) ;;
  --apply) mode=apply ;;
  *) echo "usage: $0 [--dry-run|--apply]" >&2; exit 2 ;;
esac

root=$(realpath -m -- "$THOIDAI_RELEASE_ROOT")
[[ -d "$root" ]] || { echo "release root missing: $root" >&2; exit 1; }
health_check() {
  "$THOIDAI_SYSTEMCTL_BIN" is-active --quiet "$THOIDAI_SERVICE" || return 1
  "$THOIDAI_CURL_BIN" -fsS --max-time 15 -o /dev/null "$THOIDAI_HEALTH_URL"
}

active=$("$THOIDAI_SYSTEMCTL_BIN" show -P WorkingDirectory "$THOIDAI_SERVICE" 2>/dev/null || true)
[[ -n "$active" && -d "$active" ]] || { echo "cannot prove active release; refusing retention" >&2; exit 1; }
active=$(realpath -m -- "$active")
[[ "$active" == "$root"/* ]] || { echo "active release is outside release root" >&2; exit 1; }

declare -A keep=()
keep["$active"]="active-systemd"
links_complete=1
for name in current previous rollback-2; do
  link="$root/$name"
  if [[ -L "$link" ]]; then
    target=$(realpath -m -- "$link")
    [[ "$target" == "$root"/* && -d "$target" ]] || { echo "invalid lifecycle link: $link" >&2; exit 1; }
    keep["$target"]="$name"
  else
    links_complete=0
  fi
done

records=()
while IFS= read -r -d '' path; do
  base=$(basename "$path")
  case "$base" in current|previous|rollback-2|ops-backups|build-evidence) continue ;; esac
  real=$(realpath -m -- "$path")
  reason=""
  if (( ! links_complete )); then reason=legacy-unmanaged;
  elif [[ ${keep[$real]+yes} ]]; then reason=${keep[$real]};
  elif [[ -e "$path/.keep" ]]; then reason=protected-.keep;
  elif grep -R -l --fixed-strings "$real" /etc/systemd/system /etc/nginx 2>/dev/null | head -n 1 | grep -q .; then reason=configuration-reference;
  elif command -v pgrep >/dev/null 2>&1 && pgrep -af -- "$real" >/dev/null 2>&1; then reason=process-reference;
  elif command -v lsof >/dev/null 2>&1 && lsof +D "$real" 2>/dev/null | tail -n +2 | grep -q .; then reason=open-file-reference;
  fi
  if [[ -n "$reason" ]]; then records+=("KEEP\t$path\t$reason"); else records+=("DELETE\t$path\told-unused"); fi
done < <(find "$root" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[A-Za-z0-9][A-Za-z0-9._-]{7,127}$' -print0 | sort -z)

printf '%b\n' "${records[@]}"
if [[ "$mode" == apply ]]; then
  [[ "${THOIDAI_RETENTION_AFTER_SUCCESS:-0}" == 1 ]] || { echo "retention apply requires successful deployment validation" >&2; exit 1; }
  health_check || { echo "health validation failed; refusing retention" >&2; exit 1; }
  for record in "${records[@]}"; do
    IFS=$'\t' read -r action path reason <<< "$record"
    [[ "$action" == DELETE ]] || continue
    real=$(realpath -m -- "$path")
    [[ "$real" == "$root"/* && -d "$real" ]] || { echo "unsafe retention target: $path" >&2; exit 1; }
    rm -rf -- "$real"
  done
  health_check || { echo "health validation failed after retention" >&2; exit 1; }
fi
