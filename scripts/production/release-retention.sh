#!/usr/bin/env bash
set -Eeuo pipefail

: "${THOIDAI_RELEASE_ROOT:=/opt/releases/thoidai-work}"
: "${THOIDAI_SERVICE:=thoidai-work.service}"
: "${THOIDAI_HEALTH_URL:=http://127.0.0.1:3001/login}"
: "${THOIDAI_SYSTEMCTL_BIN:=systemctl}"
: "${THOIDAI_CURL_BIN:=curl}"
: "${THOIDAI_RETENTION_KEEP_LATEST:=5}"
: "${THOIDAI_RETENTION_EVIDENCE_ROOT:=/opt/releases/thoidai-work/build-evidence/retention}"
: "${THOIDAI_RETENTION_REFERENCE_ROOTS:=/opt}"
: "${THOIDAI_RETENTION_CONFIG_ROOTS:=/etc/systemd/system:/etc/nginx}"
: "${THOIDAI_RETENTION_PROC_ROOT:=/proc}"
: "${THOIDAI_RETENTION_REFERENCE_MAXDEPTH:=4}"

[[ "$THOIDAI_RETENTION_KEEP_LATEST" =~ ^[0-9]+$ ]] || exit 2
[[ "$THOIDAI_RETENTION_REFERENCE_MAXDEPTH" =~ ^[0-9]+$ ]] || exit 2
mode=dry-run
case "${1:-}" in
  ''|--dry-run) ;;
  --apply) mode=apply ;;
  *) echo "usage: $0 [--dry-run|--apply]" >&2; exit 2 ;;
esac

root=$(realpath -m -- "$THOIDAI_RELEASE_ROOT")
[[ -d "$root" ]] || { echo "release root missing: $root" >&2; exit 1; }
health_check() { "$THOIDAI_SYSTEMCTL_BIN" is-active --quiet "$THOIDAI_SERVICE" && "$THOIDAI_CURL_BIN" -fsS --max-time 15 -o /dev/null "$THOIDAI_HEALTH_URL"; }
meta_value() { awk -F= -v wanted="$2" '$1 == wanted {sub(/^[^=]*=/, ""); print; exit}' "$1"; }
release_candidate() {
  local path=$1 base commit created
  base=$(basename "$path")
  if [[ -f "$path/.release-meta" ]]; then
    commit=$(meta_value "$path/.release-meta" commit)
    created=$(meta_value "$path/.release-meta" created_at)
    [[ "$commit" =~ ^[0-9a-f]{40}$ && "$created" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[^[:space:]]+Z$ ]]
    return
  fi
  [[ "$base" =~ ^thoidai-standalone-[0-9a-f]{40}(-r[2-9][0-9]*)?$ || "$base" =~ ^[0-9a-f]{40}$ || "$base" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,40}(-[a-z0-9._-]+)?$ || "$base" =~ ^[a-z0-9._-]+-[0-9a-f]{7,40}$ ]]
}
release_epoch() {
  local path=$1 created
  if [[ -f "$path/.release-meta" ]]; then
    created=$(meta_value "$path/.release-meta" created_at)
    date -u -d "$created" +%s 2>/dev/null && return
  fi
  stat -c %Y "$path"
}
process_reference_state() {
  local target=$1 link resolved
  [[ -d "$THOIDAI_RETENTION_PROC_ROOT" ]] || { echo unknown; return; }
  for link in "$THOIDAI_RETENTION_PROC_ROOT"/[0-9]*/cwd "$THOIDAI_RETENTION_PROC_ROOT"/[0-9]*/fd/*; do
    [[ -e "$link" || -L "$link" ]] || continue
    resolved=$(readlink -f -- "$link" 2>/dev/null) || continue
    [[ "$resolved" == "$target" || "$resolved" == "$target"/* ]] && { echo yes; return; }
  done
  echo no
}
symlink_reference_state() {
  local target=$1 path link resolved output
  local configured=() roots=("$root")
  IFS=: read -r -a configured <<< "$THOIDAI_RETENTION_REFERENCE_ROOTS"
  roots+=("${configured[@]}")
  for path in "${roots[@]}"; do
    [[ -e "$path" ]] || continue
    output=$(find "$path" -maxdepth "$THOIDAI_RETENTION_REFERENCE_MAXDEPTH" -type l -print 2>/dev/null) || { echo unknown; return; }
    while IFS= read -r link; do
      [[ -n "$link" ]] || continue
      resolved=$(readlink -f -- "$link" 2>/dev/null) || { echo unknown; return; }
      [[ "$resolved" == "$target" || "$resolved" == "$target"/* ]] && { echo yes; return; }
    done <<< "$output"
  done
  echo no
}
config_reference_state() {
  local target=$1 path status saw_error=0
  local configured=()
  IFS=: read -r -a configured <<< "$THOIDAI_RETENTION_CONFIG_ROOTS"
  for path in "${configured[@]}"; do
    [[ -e "$path" ]] || continue
    set +e
    grep -R -l --fixed-strings "$target" "$path" >/dev/null 2>&1
    status=$?
    set -e
    [[ $status == 0 ]] && { echo yes; return; }
    [[ $status == 1 ]] || saw_error=1
  done
  (( saw_error )) && echo unknown || echo no
}
reference_reason() {
  local target=$1 state
  state=$(process_reference_state "$target")
  [[ "$state" == yes ]] && { echo process-reference; return; }
  [[ "$state" == unknown ]] && { echo reference-scan-failed; return; }
  state=$(symlink_reference_state "$target")
  [[ "$state" == yes ]] && { echo symlink-reference; return; }
  [[ "$state" == unknown ]] && { echo reference-scan-failed; return; }
  state=$(config_reference_state "$target")
  [[ "$state" == yes ]] && { echo configuration-reference; return; }
  [[ "$state" == unknown ]] && { echo reference-scan-failed; return; }
  echo no-reference
}

declare -A keep=()
active=$("$THOIDAI_SYSTEMCTL_BIN" show -P WorkingDirectory "$THOIDAI_SERVICE" 2>/dev/null || true)
[[ -n "$active" ]] && active=$(realpath -m -- "$active")
[[ "$active" == "$root"/* ]] && keep["$active"]='active-systemd'
for name in current previous rollback-1 rollback-2; do
  link="$root/$name"
  if [[ -L "$link" ]]; then
    target=$(realpath -m -- "$link")
    [[ "$target" == "$root"/* && -d "$target" ]] || { echo "invalid lifecycle link: $link" >&2; exit 1; }
    keep["$target"]=$name
  fi
done

records=()
candidates=()
tab=$'\t'
while IFS= read -r -d '' path; do
  base=$(basename "$path")
  real=$(realpath -m -- "$path")
  case "$base" in
    current|previous|rollback-1|rollback-2) records+=("KEEP${tab}${path}${tab}protected-lifecycle-name"); continue ;;
    build-evidence|ops-backups) records+=("KEEP${tab}${path}${tab}protected-nonrelease"); continue ;;
  esac
  if [[ ${keep[$real]+yes} ]]; then records+=("KEEP${tab}${path}${tab}${keep[$real]}"); continue; fi
  if [[ -e "$path/.keep" ]]; then records+=("KEEP${tab}${path}${tab}protected-.keep"); continue; fi
  if ! release_candidate "$path"; then records+=("KEEP${tab}${path}${tab}unknown-nonrelease"); continue; fi
  candidates+=("$(release_epoch "$path")${tab}${path}")
done < <(find "$root" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

rank=0
while IFS=$'\t' read -r epoch path; do
  [[ -n "$path" ]] || continue
  if (( rank < THOIDAI_RETENTION_KEEP_LATEST )); then
    records+=("KEEP${tab}${path}${tab}latest-reserve")
  else
    reference=$(reference_reason "$(realpath -m -- "$path")")
    if [[ "$reference" == no-reference ]]; then records+=("DELETE${tab}${path}${tab}superseded-release"); else records+=("KEEP${tab}${path}${tab}${reference}"); fi
  fi
  rank=$((rank + 1))
done < <(printf '%s\n' "${candidates[@]:-}" | sort -nr)

mkdir -p "$THOIDAI_RETENTION_EVIDENCE_ROOT"
evidence="$THOIDAI_RETENTION_EVIDENCE_ROOT/$(date -u +%Y%m%dT%H%M%SZ)-$mode.tsv"
printf '%s\n' "${records[@]}" | tee "$evidence"
echo "EVIDENCE=$evidence"
if [[ "$mode" == apply ]]; then
  [[ "${THOIDAI_RETENTION_APPROVED:-0}" == 1 ]] || { echo 'retention apply requires THOIDAI_RETENTION_APPROVED=1' >&2; exit 1; }
  health_check || { echo 'health validation failed; refusing retention' >&2; exit 1; }
  for record in "${records[@]}"; do
    IFS=$'\t' read -r action path reason <<< "$record"
    [[ "$action" == DELETE ]] || continue
    real=$(realpath -m -- "$path")
    [[ "$real" == "$root"/* && -d "$real" ]] || { echo "unsafe retention target: $path" >&2; exit 1; }
    rm -rf -- "$real"
  done
  health_check || { echo 'health validation failed after retention' >&2; exit 1; }
fi