#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/release-common.sh"

mode=dry-run
case "${1:-}" in
  '') ;;
  --dry-run) ;;
  --apply) mode=apply ;;
  *) die "usage: $0 [--dry-run|--apply]"; exit 2 ;;
esac

mkdir -p "$THOIDAI_RELEASE_ROOT"
declare -A lifecycle=()
declare -A lifecycle_reason=()
declare -A lifecycle_count=()
links_complete=1
for name in current previous rollback-2; do
  if [[ -L "$THOIDAI_RELEASE_ROOT/$name" ]]; then
    target=$(readlink -f -- "$THOIDAI_RELEASE_ROOT/$name")
    lifecycle[$target]=1
    lifecycle_reason[$target]=$name
    lifecycle_count[$target]=$(( ${lifecycle_count[$target]:-0} + 1 ))
  else
    links_complete=0
  fi
done

classify() {
  local path=$1 refs
  if [[ ${lifecycle[$(realpath -m -- "$path")]+yes} ]]; then
    target=$(realpath -m -- "$path")
    if (( lifecycle_count[$target] > 1 )); then printf 'REVIEW\t%s\tlifecycle-duplicate\n' "$path"; else printf 'KEEP\t%s\t%s\n' "$path" "${lifecycle_reason[$target]}"; fi
    return
  fi
  if [[ -e "$path/.keep" ]]; then printf 'KEEP\t%s\tprotected:.keep\n' "$path"; return; fi
  if (( ! links_complete )); then printf 'REVIEW\t%s\tlegacy-unmanaged\n' "$path"; return; fi
  refs=$(path_reference "$path")
  if [[ "$refs" = inspection-unavailable ]]; then printf 'REVIEW\t%s\tinspection-unavailable\n' "$path"; return; fi
  if [[ -n "$refs" ]]; then printf 'KEEP\t%s\t%s\n' "$path" "$refs"; return; fi
  printf 'DELETE\t%s\told-unused\n' "$path"
}

entries=()
while IFS= read -r -d '' path; do
  case "$(basename "$path")" in current|previous|rollback-2|ops-backups|build-evidence) continue ;; esac
  entries+=("$path")
done < <(find "$THOIDAI_RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[A-Za-z0-9][A-Za-z0-9._-]{7,127}$' -print0 | sort -z)
for path in "${entries[@]}"; do classify "$path"; done

if [[ "$mode" = apply ]]; then
  [[ "${THOIDAI_LOCK_HELD:-0}" = 1 ]] || acquire_lock
  for path in "${entries[@]}"; do
    record=$(classify "$path")
    [[ "$record" == $'DELETE\t'* ]] || continue
    rm -rf -- "$path"
    [[ ! -e "$path" ]] || die "failed to remove $path"
    log_event "DELETED path=$path"
  done
  health_check || die "health check failed after retention apply"
fi
