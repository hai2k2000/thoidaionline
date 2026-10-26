#!/usr/bin/env bash
main() {
  set -Eeuo pipefail
  local ROOT=${THOIDAI_BACKUP_ROOT:-/opt/ops/thoidai-work/backups/managed}
  local LOCK=${THOIDAI_BACKUP_LOCK:-/run/lock/thoidai-backup.lock}
  local MAX_MB=${THOIDAI_BACKUP_MAX_MB:-500}
  local NOW=${THOIDAI_BACKUP_NOW:-}
  local PG_CONTAINER=${THOIDAI_BACKUP_PG_CONTAINER:-supabase_db_thoidai-work}
  local STORAGE=${THOIDAI_BACKUP_STORAGE:-/opt/thoidai-work/storage}
  local cleanup_partial=''
  [[ "$MAX_MB" =~ ^[0-9]+$ ]] || { echo 'invalid THOIDAI_BACKUP_MAX_MB' >&2; return 2; }
  timestamp() { [[ -n "$NOW" ]] && printf '%s\n' "$NOW" || date -u +%Y%m%dT%H%M%SZ; }
  safe_name() { [[ "$1" =~ ^[a-z0-9][a-z0-9-]*$ ]]; }
  valid_name() { [[ "$1" =~ ^[0-9]{8}T[0-9]{6}Z-(daily|predeploy)(-[a-z0-9][a-z0-9-]*)?$ ]]; }
  disk_guard() { local free_kb; free_kb=$(df -Pk / | awk 'NR == 2 {print $4}'); [[ "$free_kb" =~ ^[0-9]+$ ]] && (( free_kb >= 10 * 1024 * 1024 )) || { echo "DISK_GUARD=BLOCKED" >&2; return 4; }; }
  trap 'if [[ -n "${cleanup_partial:-}" ]]; then rm -rf -- "$cleanup_partial"; fi' EXIT
  retention() {
    local apply=0 layer entry base rank epoch week month reason target
    [[ "${1:---dry-run}" == '--apply' ]] && apply=1
    [[ "${1:---dry-run}" == '--dry-run' || $apply == 1 ]] || return 2
    mkdir -p "$ROOT/daily" "$ROOT/predeploy"
    declare -A weeks=() months=()
    for layer in daily predeploy; do
      mapfile -t entries < <(find "$ROOT/$layer" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
      rank=0
      for base in "${entries[@]}"; do
        [[ -n "$base" ]] || continue
        if [[ -f "$ROOT/$layer/$base/.keep" ]]; then echo "KEEP=$base reason=.keep"; continue; fi
        if ! valid_name "$base"; then echo "SKIP_UNKNOWN=$base"; continue; fi
        reason=''
        if [[ "$layer" == daily ]]; then
          (( rank < 7 )) && reason=daily-recent
          epoch=$(date -u -d "${base:0:8} ${base:9:6}" +%s 2>/dev/null || true)
          if [[ -n "$epoch" ]]; then
            week=$(date -u -d "@$epoch" +%G-W%V); month=$(date -u -d "@$epoch" +%Y-%m)
            [[ -n "${weeks[$week]+x}" || -n "$reason" ]] || { reason=weekly; weeks[$week]=1; }
            [[ -n "${months[$month]+x}" || -n "$reason" ]] || { reason=monthly; months[$month]=1; }
          fi
        else
          (( rank < 5 )) && reason=predeploy-recent
        fi
        if [[ -n "$reason" ]]; then echo "KEEP=$base reason=$reason"; else echo "DELETE=$base"; if (( apply )); then target=$(realpath -m -- "$ROOT/$layer/$base"); [[ "$target" == "$ROOT"/* && -d "$target" ]] || return 1; rm -rf -- "$target"; fi; fi
        rank=$((rank + 1))
      done
    done
  }
  run_backup() {
    local kind=daily label='' name partial dump tarfile prev prevtar current_mb
    [[ "${1:-}" == '--kind' ]] && { kind=${2:?}; shift 2; }
    [[ "${1:-}" == '--label' ]] && { label=${2:?}; shift 2; }
    [[ "$kind" == daily || "$kind" == predeploy ]] || return 2
    if [[ -n "$label" ]] && ! safe_name "$label"; then return 2; fi
    mkdir -p "$ROOT/$kind"; chmod 700 "$ROOT";
    if [[ "${THOIDAI_BACKUP_SKIP_DISK_GUARD:-0}" != 1 || "$ROOT" == /opt/ops/thoidai-work/backups/managed ]]; then disk_guard; fi
    current_mb=$(du -sm -- "$ROOT" | awk '{print $1}'); (( current_mb + 50 <= MAX_MB )) || { echo 'BACKUP_CAP=EXCEEDED'; return 3; }
    exec 9>"$LOCK"; flock -n 9 || return 1
    name="$(timestamp)-$kind${label:+-$label}"; partial="$ROOT/$kind/.$name.partial"; cleanup_partial="$partial"; mkdir -p "$partial"
    dump="$partial/postgres.dump"; tarfile="$partial/storage.tar.gz"
    docker exec "$PG_CONTAINER" pg_dump -U postgres -d postgres -Fc > "$dump"; chmod 600 "$dump"; [[ -s "$dump" ]]
    docker exec -i "$PG_CONTAINER" pg_restore --list < "$dump" > "$partial/pg.list"; (( $(wc -l < "$partial/pg.list") > 100 ))
    tar --exclude='*/cache' --exclude='cache' -czf "$tarfile" -C "$(dirname "$STORAGE")" "$(basename "$STORAGE")"; tar -tzf "$tarfile" >/dev/null
    { printf 'created_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"; printf 'postgres_version='; docker exec "$PG_CONTAINER" psql -U postgres -d postgres -Atc 'show server_version'; printf 'pg_restore_items=%s\n' "$(wc -l < "$partial/pg.list")"; (cd "$partial" && sha256sum postgres.dump storage.tar.gz); (cd "$partial" && stat -c 'size=%s path=%n' postgres.dump storage.tar.gz); } > "$partial/manifest.txt"
    prev=''
    while IFS= read -r candidate; do
      [[ "$candidate" == .* ]] && continue
      valid_name "$candidate" || continue
      prev="$ROOT/daily/$candidate"
      break
    done < <(find "$ROOT/daily" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
    prevtar="$prev/storage.tar.gz"
    if [[ -f "$prev/postgres.dump" && -f "$prevtar" ]] && [[ "$(sha256sum "$dump" | awk '{print $1}')" == "$(sha256sum "$prev/postgres.dump" | awk '{print $1}')" ]] && [[ "$(sha256sum "$tarfile" | awk '{print $1}')" == "$(sha256sum "$prevtar" | awk '{print $1}')" ]]; then echo "DUPLICATE_OF=$(basename "$prev")" >> "$ROOT/backup.log"; rm -rf -- "$partial"; cleanup_partial=''; return 0; fi
    mv -- "$partial" "$ROOT/$kind/$name"; cleanup_partial=''; printf '%s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$name" "$(du -sm -- "$ROOT/$kind/$name" | awk '{print $1}')" > "$ROOT/last-success"; retention --apply
  }
  status() { local layer latest count total age; total=$(du -sm -- "$ROOT" 2>/dev/null | awk '{print $1}'); for layer in daily predeploy; do latest=$(find "$ROOT/$layer" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort -r | head -n1 || true); count=$(find "$ROOT/$layer" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | wc -l); echo "$layer latest=${latest:-none} count=$count"; if [[ "$layer" == daily && -n "$latest" ]]; then age=$(( $(date +%s) - $(stat -c %Y "$latest") )); (( age <= 26 * 3600 )) || return 1; fi; done; echo "total_mb=$total"; [[ -f "$ROOT/last-success" ]] && echo "last-success=$(cat "$ROOT/last-success")"; }
  self_test() { local old=$ROOT tmp i d; tmp=$(mktemp -d); ROOT="$tmp"; NOW=20261026T024000Z; mkdir -p "$ROOT/daily" "$ROOT/predeploy"; for i in $(seq 0 39); do d=$(date -u -d "20261026 -$i days" +%Y%m%dT024000Z)-daily; mkdir -p "$ROOT/daily/$d"; done; mkdir -p "$ROOT/daily/not-a-backup" "$ROOT/daily/20261025T024000Z-daily"; : > "$ROOT/daily/20261025T024000Z-daily/.keep"; retention --dry-run > "$tmp/dry"; grep -q 'SKIP_UNKNOWN=not-a-backup' "$tmp/dry"; grep -q 'KEEP=20261025T024000Z-daily reason=.keep' "$tmp/dry"; retention --apply > "$tmp/apply"; [[ $(find "$ROOT/daily" -mindepth 1 -maxdepth 1 -type d | wc -l) -le 20 ]]; rm -rf -- "$tmp"; ROOT=$old; echo 'SELF_TEST=PASS'; }
  case "${1:-}" in run) shift; run_backup "$@";; retention) shift; retention "${1:---dry-run}";; status) status;; self-test) self_test;; *) return 2;; esac
}
main "$@"; exit $?
