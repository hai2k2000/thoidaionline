#!/usr/bin/env bash
set -Eeuo pipefail

: "${THOIDAI_SOURCE_REPO:=/opt/thoidai-work}"
: "${THOIDAI_WORKTREE_ROOT:=/opt/worktrees}"
: "${THOIDAI_RELEASE_ROOT:=/opt/releases/thoidai-work}"
: "${THOIDAI_BUILD_ROOT:=/opt/build/thoidai-work}"
: "${THOIDAI_DOCKER_BIN:=docker}"
: "${THOIDAI_JOURNALCTL_BIN:=journalctl}"
: "${THOIDAI_LOG_ROOT:=/var/log}"
: "${THOIDAI_REPORT_ROOT:=/var/tmp/thoidai-storage-reports}"
: "${THOIDAI_DB_VOLUME:=supabase_db_thoidai-work}"
format=human
case "${1:-}" in
  '') ;;
  --human) format=human ;;
  --json) format=json ;;
  *) echo "usage: $0 [--human|--json]" >&2; exit 2 ;;
esac

json_escape() { local s=${1-}; s=${s//\\/\\\\}; s=${s//\"/\\\"}; s=${s//$'\n'/\\n}; printf '%s' "$s"; }
emit() {
  local category=$1 status=$2 bytes=$3 path=$4 reason=$5
  if [[ "$format" == json ]]; then
    printf '{"category":"%s","status":"%s","bytes":%s,"path":"%s","reason":"%s"}\n' \
      "$(json_escape "$category")" "$(json_escape "$status")" "$bytes" "$(json_escape "$path")" "$(json_escape "$reason")"
  else
    printf '%s\t%s\t%s\t%s\t%s\n' "$category" "$status" "$bytes" "$path" "$reason"
  fi
}
size_bytes() {
  local path=$1 value
  [[ -e "$path" || -L "$path" ]] || { printf '0\n'; return 0; }
  value=$(du -sx --bytes -- "$path" 2>/dev/null | awk 'NR==1 {print $1}') || return 1
  [[ "$value" =~ ^[0-9]+$ ]] || return 1
  printf '%s\n' "$value"
}
scan_path() {
  local category=$1 path=$2 bytes
  if [[ ! -e "$path" && ! -L "$path" ]]; then emit "$category" UNKNOWN 0 "$path" missing; return; fi
  if ! bytes=$(size_bytes "$path"); then emit "$category" UNKNOWN 0 "$path" size-inspection-failed; return; fi
  emit "$category" INFO "$bytes" "$path" observed
}

mkdir -p "$THOIDAI_REPORT_ROOT" 2>/dev/null || true
if [[ "$format" == human ]]; then
  printf 'STORAGE_INVENTORY\tmode=read-only\tproduction_changed=NO\n'
fi
if df_line=$(df -Pk / 2>/dev/null | awk 'NR==2 {print $2" "$3" "$4" "$5}'); then
  read -r blocks used avail pct <<<"$df_line"
  [[ "$avail" =~ ^[0-9]+$ ]] && emit filesystem INFO "$((avail * 1024))" / "free_bytes=${avail}KiB used_percent=${pct}"
else
  emit filesystem UNKNOWN 0 / df-inspection-failed
fi
for pair in \
  "worktree:$THOIDAI_WORKTREE_ROOT" \
  "release:$THOIDAI_RELEASE_ROOT" \
  "build:$THOIDAI_BUILD_ROOT" \
  "log:$THOIDAI_LOG_ROOT" \
  "backup:/opt/backups" \
  "backup:/var/backups/thoidai-work" \
  "backup:/opt/thoidai-backups" \
  "backup:$THOIDAI_SOURCE_REPO/backups"; do
  category=${pair%%:*}; path=${pair#*:}; scan_path "$category" "$path"
done

if [[ -d "$THOIDAI_RELEASE_ROOT" ]]; then
  while IFS= read -r -d '' path; do
    case "$(basename "$path")" in current|previous|rollback-2|ops-backups|build-evidence) continue;; esac
    scan_path release-candidate "$path"
  done < <(find "$THOIDAI_RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
fi
if [[ -d "$THOIDAI_WORKTREE_ROOT" ]]; then
  while IFS= read -r -d '' path; do scan_path worktree "$path"; done < <(find "$THOIDAI_WORKTREE_ROOT" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
fi

if command -v "$THOIDAI_DOCKER_BIN" >/dev/null 2>&1; then
  if image_lines=$("$THOIDAI_DOCKER_BIN" image ls --format '{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}' 2>/dev/null); then
    while IFS=$'\t' read -r ref id size; do [[ -n "$ref" ]] && emit docker-image INFO 0 "$ref" "id=$id size=$size"; done <<<"$image_lines"
  else emit docker-image UNKNOWN 0 docker image-list-failed; fi
  if volume_lines=$("$THOIDAI_DOCKER_BIN" volume ls --format '{{.Name}}' 2>/dev/null); then
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      if [[ "$name" == "$THOIDAI_DB_VOLUME" ]]; then emit docker-volume KEEP 0 "$name" production-db-protected
      elif [[ "$name" == *supabase* || "$name" == *recovery* ]]; then emit docker-volume KEEP 0 "$name" protected-pattern
      elif inspect=$("$THOIDAI_DOCKER_BIN" volume inspect "$name" --format '{{.Mountpoint}}' 2>/dev/null); then
        if [[ -n "$inspect" ]] && bytes=$(size_bytes "$inspect"); then emit docker-volume UNKNOWN "$bytes" "$name" unclassified-volume-review; else emit docker-volume UNKNOWN 0 "$name" volume-size-unavailable; fi
      else emit docker-volume UNKNOWN 0 "$name" volume-inspection-failed; fi
    done <<<"$volume_lines"
  else emit docker-volume UNKNOWN 0 docker volume-list-failed; fi
else
  emit docker-image UNKNOWN 0 docker docker-unavailable
  emit docker-volume UNKNOWN 0 docker docker-unavailable
fi
if command -v "$THOIDAI_JOURNALCTL_BIN" >/dev/null 2>&1; then
  if journal=$("$THOIDAI_JOURNALCTL_BIN" --disk-usage 2>/dev/null); then emit journal INFO 0 journalctl "$(tr '\n' ' ' <<<"$journal")"; else emit journal UNKNOWN 0 journal journal-inspection-failed; fi
else emit journal UNKNOWN 0 journal journalctl-unavailable; fi
if command -v lsof >/dev/null 2>&1; then
  if deleted=$(lsof +L1 2>/dev/null | tail -n +2 | wc -l); then emit deleted-open INFO 0 lsof "count=$deleted"; else emit deleted-open UNKNOWN 0 lsof inspection-failed; fi
else emit deleted-open UNKNOWN 0 lsof lsof-unavailable; fi
if [[ "$format" == human ]]; then printf 'STORAGE_INVENTORY_END\tproduction_changed=NO\n'; fi