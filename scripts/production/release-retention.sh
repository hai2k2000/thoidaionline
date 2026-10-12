#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/release-common.sh"

mode=dry-run
exact_mode=0
manifest_path=''
manifest_sha256=''
mode_seen=0

while (($#)); do
  case "$1" in
    --dry-run)
      (( mode_seen == 0 )) || { die "dry-run/apply may be specified only once"; exit 2; }
      mode=dry-run
      mode_seen=1
      ;;
    --apply)
      (( mode_seen == 0 )) || { die "dry-run/apply may be specified only once"; exit 2; }
      mode=apply
      mode_seen=1
      ;;
    --manifest)
      (($# >= 2)) || { die "--manifest requires a path"; exit 2; }
      [[ -z "$manifest_path" ]] || { die "--manifest may be specified only once"; exit 2; }
      manifest_path=$2
      exact_mode=1
      shift
      ;;
    --sha256)
      (($# >= 2)) || { die "--sha256 requires a digest"; exit 2; }
      [[ -z "$manifest_sha256" ]] || { die "--sha256 may be specified only once"; exit 2; }
      manifest_sha256=${2,,}
      exact_mode=1
      shift
      ;;
    *)
      die "usage: $0 [--dry-run|--apply] [--manifest PATH --sha256 SHA256]"
      exit 2
      ;;
  esac
  shift
done

if (( exact_mode )); then
  [[ -n "$manifest_path" && -n "$manifest_sha256" ]] || {
    die "exact mode requires --manifest PATH and --sha256 SHA256"
    exit 2
  }
  [[ "$manifest_sha256" =~ ^[0-9a-f]{64}$ ]] || {
    die "manifest SHA256 must be 64 hexadecimal characters"
    exit 2
  }
fi

declare -A exact_expected_alloc=()
declare -A exact_expected_apparent=()
declare -A exact_expected_mtime=()
declare -A exact_expected_birth=()
declare -A exact_expected_provenance=()
declare -A exact_expected_build=()
declare -A exact_expected_fingerprint=()
declare -A exact_seen=()
declare -a exact_paths=()
declare -A exact_lifecycle=()
declare -A exact_lifecycle_links=()
declare -A exact_symlink_refs=()
exact_total_allocated=0
exact_root=''
exact_manifest_count=0
exact_manifest_snapshot=''
exact_manifest_source_fingerprint=''
exact_manifest_snapshot_sha256=''
exact_manifest_snapshot_fingerprint=''
exact_lifecycle_baseline_ready=0
exact_verify_sizes=0

exact_fail() {
  die "$1"
  exit 1
}

exact_cleanup_manifest_snapshot() {
  [[ -z "$exact_manifest_snapshot" ]] || rm -f -- "$exact_manifest_snapshot" || true
}

exact_file_fingerprint() {
  local path=${1:?path required} fingerprint
  fingerprint=$(stat -Lc '%d:%i:%F:%s:%Y:%W:%Z' -- "$path" 2>/dev/null) || return 1
  [[ -n "$fingerprint" ]] || return 1
  printf '%s\n' "$fingerprint"
}

exact_sha256_file() {
  local path=${1:?path required} digest
  command -v sha256sum >/dev/null 2>&1 || exact_fail "sha256sum is unavailable"
  digest=$(sha256sum -- "$path" | awk 'NR == 1 {print $1}') || exact_fail "unable to hash file: $path"
  [[ "$digest" =~ ^[0-9a-fA-F]{64}$ ]] || exact_fail "unable to read SHA256 for: $path"
  printf '%s\n' "${digest,,}"
}

exact_prepare_manifest() {
  local source_before source_after snapshot_digest source_digest
  [[ -f "$manifest_path" && ! -L "$manifest_path" ]] || exact_fail "manifest is not a regular non-symlink file: $manifest_path"
  manifest_path=$(realpath -e -- "$manifest_path") || exact_fail "manifest path cannot be resolved"
  exact_manifest_snapshot=$(mktemp "${TMPDIR:-/tmp}/thoidai-exact-manifest.XXXXXX") || exact_fail "unable to create manifest snapshot"
  trap exact_cleanup_manifest_snapshot EXIT

  source_before=$(exact_file_fingerprint "$manifest_path") || exact_fail "unable to fingerprint manifest"
  cp -- "$manifest_path" "$exact_manifest_snapshot" || exact_fail "unable to snapshot manifest"
  source_after=$(exact_file_fingerprint "$manifest_path") || exact_fail "unable to fingerprint manifest after snapshot"
  [[ "$source_before" == "$source_after" ]] || exact_fail "manifest changed while being snapshotted"
  chmod 400 -- "$exact_manifest_snapshot" || exact_fail "unable to protect manifest snapshot"

  snapshot_digest=$(exact_sha256_file "$exact_manifest_snapshot")
  source_digest=$(exact_sha256_file "$manifest_path")
  [[ "$snapshot_digest" == "$manifest_sha256" && "$source_digest" == "$manifest_sha256" ]] || exact_fail "manifest SHA256 mismatch"
  exact_manifest_source_fingerprint=$source_after
  exact_manifest_snapshot_sha256=$snapshot_digest
  exact_manifest_snapshot_fingerprint=$(exact_file_fingerprint "$exact_manifest_snapshot") || exact_fail "unable to fingerprint manifest snapshot"
}

exact_verify_manifest_source() {
  local current_fingerprint current_digest snapshot_digest snapshot_fingerprint
  [[ -f "$manifest_path" && ! -L "$manifest_path" ]] || exact_fail "manifest is no longer a regular file: $manifest_path"
  current_fingerprint=$(exact_file_fingerprint "$manifest_path") || exact_fail "unable to fingerprint manifest: $manifest_path"
  [[ "$current_fingerprint" == "$exact_manifest_source_fingerprint" ]] || exact_fail "manifest identity changed after approval"
  current_digest=$(exact_sha256_file "$manifest_path")
  [[ "$current_digest" == "$manifest_sha256" ]] || exact_fail "manifest SHA256 changed after approval"
  snapshot_digest=$(exact_sha256_file "$exact_manifest_snapshot")
  [[ "$snapshot_digest" == "$manifest_sha256" && "$snapshot_digest" == "$exact_manifest_snapshot_sha256" ]] || exact_fail "manifest snapshot hash changed"
  snapshot_fingerprint=$(exact_file_fingerprint "$exact_manifest_snapshot") || exact_fail "unable to fingerprint manifest snapshot"
  [[ "$snapshot_fingerprint" == "$exact_manifest_snapshot_fingerprint" ]] || exact_fail "manifest snapshot identity changed"
}

exact_parse_epoch() {
  local value=${1:?timestamp required} epoch
  if [[ "$value" == UNKNOWN ]]; then
    printf 'UNKNOWN\n'
    return
  fi
  epoch=$(date -d "$value" +%s 2>/dev/null) || exact_fail "manifest timestamp is invalid: $value"
  [[ "$epoch" =~ ^[0-9]+$ ]] || exact_fail "manifest timestamp is invalid: $value"
  printf '%s\n' "$epoch"
}

exact_add_decimal() {
  local value=${1:?decimal value required} normalized
  normalized=$value
  while [[ ${#normalized} -gt 1 && "$normalized" == 0* ]]; do
    normalized=${normalized#0}
  done
  exact_total_allocated=$((exact_total_allocated + 10#$normalized))
}

exact_protected_name() {
  local path=${1:?path required} component
  local -a components=()
  local relative=${path#"$exact_root"/}
  IFS='/' read -r -a components <<< "$relative"
  for component in "${components[@]}"; do
    case "${component,,}" in
      .keep|*provenance*|*evidence*|*backup*|*diagnostic*) return 0 ;;
    esac
  done
  return 1
}

exact_load_manifest() {
  local line type path apparent_bytes allocated_bytes mtime_iso birth_iso
  local provenance_sha build_id lifecycle_pointer other_symlink keep_file
  local process_ref open_fd_ref config_ref mount_ref container_ref classification reason extra
  local expected_root mtime_epoch birth_epoch

  [[ -n "$exact_manifest_snapshot" && -f "$exact_manifest_snapshot" ]] || exact_prepare_manifest
  exact_root=$(realpath -e -- "$THOIDAI_RELEASE_ROOT") || exact_fail "release root cannot be resolved: $THOIDAI_RELEASE_ROOT"
  [[ -d "$exact_root" ]] || exact_fail "release root is not a directory: $exact_root"

  local header=$'type\tpath\tapparent_bytes\tallocated_bytes\tmtime_iso\tbirth_iso\tprovenance_sha\tbuild_id\tlifecycle_pointer\tother_symlink\tkeep_file\tprocess_ref\topen_fd_ref\tconfig_ref\tmount_ref\tcontainer_ref\tclassification\treason'
  exact_manifest_count=0
  exact_total_allocated=0
  exact_expected_alloc=()
  exact_expected_apparent=()
  exact_expected_mtime=()
  exact_expected_birth=()
  exact_expected_provenance=()
  exact_expected_build=()
  exact_expected_fingerprint=()
  exact_seen=()
  exact_paths=()

  IFS= read -r line < "$exact_manifest_snapshot" || exact_fail "manifest is empty"
  [[ "$line" == "$header" ]] || exact_fail "manifest schema header does not match the required 18-column TSV"

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] || exact_fail "manifest contains a blank row"
    [[ "$line" != *$'\r'* ]] || exact_fail "manifest contains CRLF or carriage-return data"
    [[ "$line" != *$'\x1f'* ]] || exact_fail "manifest contains an unsupported control character"
    local line_without_tabs=${line//$'\t'/}
    local field_count=$(( ${#line} - ${#line_without_tabs} + 1 ))
    (( field_count == 18 )) || exact_fail "manifest row does not contain exactly 18 columns"
    type=''; path=''; apparent_bytes=''; allocated_bytes=''; mtime_iso=''; birth_iso=''
    provenance_sha=''; build_id=''; lifecycle_pointer=''; other_symlink=''; keep_file=''
    process_ref=''; open_fd_ref=''; config_ref=''; mount_ref=''; container_ref=''
    classification=''; reason=''; extra=''
    local encoded=${line//$'\t'/$'\x1f'}
    IFS=$'\x1f' read -r type path apparent_bytes allocated_bytes mtime_iso birth_iso \
      provenance_sha build_id lifecycle_pointer other_symlink keep_file process_ref \
      open_fd_ref config_ref mount_ref container_ref classification reason extra <<< "$encoded"
    [[ -z "$extra" && -n "$reason" ]] || exact_fail "manifest row does not contain exactly 18 columns"
    [[ "$type" == release ]] || exact_fail "manifest row has unsupported type: $type"
    [[ "$classification" == SAFE_CANDIDATE ]] || exact_fail "manifest row is not SAFE_CANDIDATE: $path"
    [[ "$allocated_bytes" =~ ^[0-9]+$ ]] || exact_fail "allocated_bytes is not numeric: $path"
    [[ "$apparent_bytes" =~ ^[0-9]+$ ]] || exact_fail "apparent_bytes is not numeric: $path"
    [[ "$mtime_iso" != UNKNOWN && "$birth_iso" != UNKNOWN ]] || exact_fail "manifest target lacks timestamp identity: $path"
    mtime_epoch=$(exact_parse_epoch "$mtime_iso")
    birth_epoch=$(exact_parse_epoch "$birth_iso")
    [[ "$provenance_sha" != '' && "$provenance_sha" != *$'\t'* && "$provenance_sha" != *$'\n'* ]] || exact_fail "manifest target lacks provenance identity: $path"
    [[ "$build_id" != '' && "$build_id" != *$'\t'* && "$build_id" != *$'\n'* ]] || exact_fail "manifest target lacks build identity: $path"
    [[ "$path" == /* ]] || exact_fail "manifest path is not absolute: $path"
    [[ "$path" != *$'\n'* && "$path" != *$'\r'* && "$path" != *$'\t'* ]] || exact_fail "manifest path contains control characters"
    [[ "$lifecycle_pointer" == NO && "$other_symlink" == NO && "$keep_file" == NO \
      && "$process_ref" == NO && "$open_fd_ref" == NO && "$config_ref" == NO \
      && "$mount_ref" == NO && "$container_ref" == NO ]] || exact_fail "manifest row carries a protected reference: $path"

    expected_root=$(realpath -e -- "$path") || exact_fail "manifest target is missing or unresolved: $path"
    [[ "$expected_root" == "$path" ]] || exact_fail "manifest target is not canonical: $path"
    [[ ! -L "$path" && -d "$path" ]] || exact_fail "manifest target is a symlink or not a directory: $path"
    assert_release_path "$path" || return 1
    exact_protected_name "$path" && exact_fail "manifest target is a protected provenance/evidence/backup path: $path"
    [[ -e "$path/.keep" || -L "$path/.keep" ]] && exact_fail "manifest target has .keep protection: $path"
    [[ -z "${exact_seen[$path]+present}" ]] || exact_fail "manifest contains duplicate target: $path"

    exact_seen[$path]=1
    exact_expected_alloc[$path]=$allocated_bytes
    exact_expected_apparent[$path]=$apparent_bytes
    exact_expected_mtime[$path]=$mtime_epoch
    exact_expected_birth[$path]=$birth_epoch
    exact_expected_provenance[$path]=$provenance_sha
    exact_expected_build[$path]=$build_id
    exact_expected_fingerprint[$path]=$(exact_file_fingerprint "$path") || exact_fail "unable to fingerprint manifest target: $path"
    exact_paths+=("$path")
    exact_manifest_count=$((exact_manifest_count + 1))
    exact_add_decimal "$allocated_bytes"
  done < <(tail -n +2 -- "$exact_manifest_snapshot")

  (( exact_manifest_count > 0 )) || exact_fail "manifest contains no targets"
  local path other
  for path in "${exact_paths[@]}"; do
    for other in "${exact_paths[@]}"; do
      [[ "$path" == "$other" ]] && continue
      [[ "$path" == "$other"/* || "$other" == "$path"/* ]] && exact_fail "manifest contains overlapping targets: $path and $other"
    done
  done
  local dirname_path
  for path in "${exact_paths[@]}"; do
    dirname_path=$(dirname -- "$path")
    [[ "$dirname_path" == "$exact_root" ]] || exact_fail "manifest target is not a direct release: $path"
  done
}

exact_load_lifecycle() {
  local name link target other manifest_path_value
  declare -A fresh_lifecycle=()
  declare -A fresh_links=()
  for name in current previous rollback-2; do
    link="$exact_root/$name"
    [[ -L "$link" ]] || exact_fail "lifecycle link is missing: $link"
    target=$(readlink -f -- "$link") || exact_fail "lifecycle link is broken: $link"
    [[ "$target" == "$exact_root"/* && -d "$target" && ! -L "$target" ]] || exact_fail "lifecycle link escapes release root: $link"
    [[ "$(dirname -- "$target")" == "$exact_root" ]] || exact_fail "lifecycle link is not a direct release: $link"
    for other in "${!fresh_lifecycle[@]}"; do
      [[ "$other" == "$target" ]] && exact_fail "lifecycle links resolve to the same release: $link"
    done
    for manifest_path_value in "${exact_paths[@]}"; do
      path_relation "$target" "$manifest_path_value" && exact_fail "lifecycle link overlaps manifest target: $link"
    done
    if (( exact_lifecycle_baseline_ready )); then
      [[ "${exact_lifecycle_links[$name]:-}" == "$target" ]] || exact_fail "lifecycle link changed during exact cleanup: $name"
    fi
    fresh_lifecycle[$target]=$name
    fresh_links[$name]=$target
  done
  exact_lifecycle=()
  exact_lifecycle_links=()
  for target in "${!fresh_lifecycle[@]}"; do exact_lifecycle[$target]=${fresh_lifecycle[$target]}; done
  for name in "${!fresh_links[@]}"; do exact_lifecycle_links[$name]=${fresh_links[$name]}; done
  exact_lifecycle_baseline_ready=1
}

exact_scan_symlinks() {
  local list_file link resolved path link_inside_target base
  list_file=$(mktemp "${TMPDIR:-/tmp}/thoidai-exact-links.XXXXXX") || exact_fail "unable to create symlink inspection list"
  if ! find -P "$exact_root" -xdev -type l -print0 > "$list_file"; then
    rm -f -- "$list_file"
    exact_fail "symlink inspection unavailable"
  fi
  exact_symlink_refs=()
  while IFS= read -r -d '' link; do
    base=$(basename -- "$link")
    case "$base" in current|previous|rollback-2) continue ;; esac
    link_inside_target=0
    for path in "${exact_paths[@]}"; do
      if [[ "$link" == "$path"/* ]]; then link_inside_target=1; break; fi
    done
    (( link_inside_target )) && continue
    # Resolve existing links canonically; for dangling links, lexical
    # resolution is enough to prove whether the missing target is unrelated.
    resolved=$(readlink -e -- "$link" 2>/dev/null || readlink -m -- "$link" 2>/dev/null) || {
      rm -f -- "$list_file"
      exact_fail "symlink inspection unavailable: $link"
    }
    [[ -n "$resolved" ]] || {
      rm -f -- "$list_file"
      exact_fail "symlink inspection unavailable: $link"
    }
    if [[ ! -e "$resolved" ]]; then
      for path in "${exact_paths[@]}"; do
        if path_relation "$resolved" "$path" || path_relation "$link" "$path"; then
          rm -f -- "$list_file"
          exact_fail "dangling symlink references exact target: $link"
        fi
      done
      continue
    fi
    for path in "${exact_paths[@]}"; do
      if path_relation "$resolved" "$path" || path_relation "$link" "$path"; then
        exact_symlink_refs[$path]="${exact_symlink_refs[$path]:+${exact_symlink_refs[$path]},}symlink:$link"
      fi
    done
  done < "$list_file"
  rm -f -- "$list_file"
}

exact_target_provenance() {
  local path=${1:?path required} value
  value=$(sed -n 's/^commit=//p;s/^artifact_source_commit=//p' "$path/.release-meta" 2>/dev/null | head -n 1) || return 1
  [[ -n "$value" ]] || { printf 'UNKNOWN\n'; return; }
  printf '%s\n' "${value:0:12}"
}

exact_target_build_id() {
  local path=${1:?path required} value meta_value='' next_value=''
  if [[ -f "$path/.release-meta" ]]; then
    meta_value=$(sed -n 's/^build_id=//p' "$path/.release-meta" | head -n 1) || return 1
  fi
  if [[ -f "$path/.next/BUILD_ID" ]]; then
    next_value=$(cat "$path/.next/BUILD_ID") || return 1
  fi
  [[ -z "$meta_value" || -z "$next_value" || "$meta_value" == "$next_value" ]] || return 1
  value=${meta_value:-$next_value}
  [[ -n "${value:-}" ]] || return 1
  printf '%s\n' "$value"
}

exact_target_timestamp() {
  local path=${1:?path required} field=${2:?field required} value
  case "$field" in
    mtime) value=$(stat -Lc '%Y' -- "$path") || return 1 ;;
    birth) value=$(stat -Lc '%W' -- "$path") || return 1 ;;
    *) return 1 ;;
  esac
  [[ "$value" =~ ^[0-9]+$ && "$value" != 0 ]] || return 1
  printf '%s\n' "$value"
}

exact_target_apparent_size() {
  local path=${1:?path required} value
  value=$(du -sx --apparent-size --block-size=1 -- "$path" 2>/dev/null | awk 'NR == 1 {print $1}') || return 1
  [[ "$value" =~ ^[0-9]+$ ]] || return 1
  printf '%s\n' "$value"
}

exact_allocated_size() {
  local path=${1:?path required} value
  command -v "${THOIDAI_DU_BIN:-du}" >/dev/null 2>&1 || return 1
  value=$("${THOIDAI_DU_BIN:-du}" -sx --block-size=1 -- "$path" 2>/dev/null | awk 'NR == 1 {print $1}') || return 1
  [[ "$value" =~ ^[0-9]+$ ]] || return 1
  printf '%s\n' "$value"
}

exact_verify_target_identity() {
  local path=${1:?path required} fingerprint mtime birth provenance build actual_alloc actual_apparent
  fingerprint=$(exact_file_fingerprint "$path") || exact_fail "unable to fingerprint target: $path"
  [[ "$fingerprint" == "${exact_expected_fingerprint[$path]}" ]] || exact_fail "target filesystem identity changed: $path"

  mtime=$(exact_target_timestamp "$path" mtime) || exact_fail "unable to inspect target mtime: $path"
  birth=$(exact_target_timestamp "$path" birth) || exact_fail "unable to inspect target birth time: $path"
  [[ "$mtime" == "${exact_expected_mtime[$path]}" ]] || exact_fail "target mtime changed: $path"
  [[ "$birth" == "${exact_expected_birth[$path]}" ]] || exact_fail "target birth time changed: $path"

  provenance=$(exact_target_provenance "$path") || exact_fail "unable to inspect target provenance: $path"
  if [[ "${exact_expected_provenance[$path]}" != UNKNOWN ]]; then
    [[ "$provenance" == "${exact_expected_provenance[$path]}" ]] || exact_fail "target provenance changed: $path"
  fi
  build=$(exact_target_build_id "$path") || exact_fail "unable to inspect target build id: $path"
  [[ "$build" == "${exact_expected_build[$path]}" ]] || exact_fail "target build id changed: $path"

  if (( exact_verify_sizes )); then
    actual_alloc=$(exact_allocated_size "$path") || exact_fail "unable to inspect allocated size: $path"
    actual_apparent=$(exact_target_apparent_size "$path") || exact_fail "unable to inspect apparent size: $path"
    [[ "$actual_alloc" == "$((10#${exact_expected_alloc[$path]}))" ]] || exact_fail "allocated size changed for $path"
    [[ "$actual_apparent" == "$((10#${exact_expected_apparent[$path]}))" ]] || exact_fail "apparent size changed for $path"
  fi
}

exact_validate_target() {
  local path=${1:?path required} resolved refs
  resolved=$(realpath -e -- "$path") || exact_fail "target disappeared or became unresolved: $path"
  [[ "$resolved" == "$path" && ! -L "$path" && -d "$path" ]] || exact_fail "target changed canonical identity: $path"
  [[ "$(dirname -- "$path")" == "$exact_root" ]] || exact_fail "target moved outside direct release scope: $path"
  [[ -z "${exact_lifecycle[$path]+protected}" ]] || exact_fail "target is now a lifecycle release (${exact_lifecycle[$path]}): $path"
  exact_protected_name "$path" && exact_fail "target became a protected path: $path"
  [[ ! -e "$path/.keep" && ! -L "$path/.keep" ]] || exact_fail "target gained .keep protection: $path"
  [[ -z "${exact_symlink_refs[$path]:-}" ]] || exact_fail "target is referenced by a symlink (${exact_symlink_refs[$path]}): $path"

  exact_verify_target_identity "$path"

  refs=$(path_reference "$path") || exact_fail "unable to inspect references for: $path"
  [[ "$refs" != inspection-unavailable ]] || exact_fail "reference inspection unavailable: $path"
  [[ -z "$refs" ]] || exact_fail "target is referenced ($refs): $path"
}

exact_authorize_apply() {
  [[ "${THOIDAI_OWNER_APPROVED_CLEANUP:-0}" == 1 ]] || exact_fail "exact apply requires THOIDAI_OWNER_APPROVED_CLEANUP=1"
  [[ -n "${THOIDAI_APPROVED_MANIFEST_SHA256:-}" ]] || exact_fail "exact apply requires THOIDAI_APPROVED_MANIFEST_SHA256"
  [[ "${THOIDAI_APPROVED_MANIFEST_SHA256,,}" == "$manifest_sha256" ]] || exact_fail "owner approval hash does not match the manifest SHA256"
}

run_exact() {
  local path fingerprint
  exact_prepare_manifest || return 1
  exact_load_manifest || return 1
  if [[ "$mode" == apply ]]; then exact_authorize_apply || return 1; fi
  exact_verify_sizes=1

  [[ "${THOIDAI_LOCK_HELD:-0}" == 1 ]] || acquire_lock || return 1
  [[ "${THOIDAI_LOCK_HELD:-0}" == 1 || -n "${THOIDAI_LOCK_FD:-}" ]] || exact_fail "cleanup lock is not held"
  exact_verify_manifest_source || return 1
  for path in "${exact_paths[@]}"; do
    fingerprint=$(exact_file_fingerprint "$path") || exact_fail "unable to fingerprint target under lock: $path"
    [[ "$fingerprint" == "${exact_expected_fingerprint[$path]}" ]] || exact_fail "target changed before cleanup lock: $path"
  done
  exact_scan_symlinks || return 1
  for path in "${exact_paths[@]}"; do
    exact_load_lifecycle || return 1
    exact_scan_symlinks || return 1
    exact_validate_target "$path" || return 1
  done

  for path in "${exact_paths[@]}"; do
    printf 'SELECT\t%s\t%s\n' "$path" "${exact_expected_alloc[$path]}"
  done
  printf 'EXACT_RESULT\tselected=%s\textra=0\tallocated_bytes=%s\tmanifest_sha256=%s\n' \
    "$exact_manifest_count" "$exact_total_allocated" "$manifest_sha256"

  if [[ "$mode" == apply ]]; then
    for path in "${exact_paths[@]}"; do
      exact_verify_manifest_source || return 1
      exact_load_lifecycle || return 1
      exact_scan_symlinks || return 1
      exact_validate_target "$path" || return 1
      exact_load_lifecycle || return 1
      exact_scan_symlinks || return 1
      exact_verify_manifest_source || return 1
      exact_verify_target_identity "$path" || return 1
      rm -rf -- "$path"
      [[ ! -e "$path" && ! -L "$path" ]] || exact_fail "failed to remove exact target: $path"
      log_event "DELETED path=$path"
    done
    health_check || exact_fail "health check failed after exact retention apply"
  fi
}

run_legacy() {
  mkdir -p "$THOIDAI_RELEASE_ROOT"
  declare -A lifecycle=()
  declare -A lifecycle_reason=()
  declare -A lifecycle_count=()
  links_complete=1
  for name in current previous rollback-2; do
    if [[ -L "$THOIDAI_RELEASE_ROOT/$name" ]]; then
      target=$(readlink -f -- "$THOIDAI_RELEASE_ROOT/$name" || true)
      if [[ -z "$target" || ! -d "$target" ]]; then links_complete=0; continue; fi
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
    printf 'CANDIDATE\t%s\told-unused\n' "$path"
  }

  entries=()
  while IFS= read -r -d '' path; do
    case "$(basename "$path")" in current|previous|rollback-2|ops-backups|build-evidence) continue ;; esac
    entries+=("$path")
  done < <(find "$THOIDAI_RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[A-Za-z0-9][A-Za-z0-9._-]{7,127}$' -print0 | sort -z)
  for path in "${entries[@]}"; do classify "$path"; done

  if [[ "$mode" = apply ]]; then
    [[ "${THOIDAI_OWNER_APPROVED_CLEANUP:-0}" = 1 || "${THOIDAI_TEST_MODE:-0}" = 1 ]] || { die "apply requires THOIDAI_OWNER_APPROVED_CLEANUP=1"; return 1; }
    [[ "${THOIDAI_LOCK_HELD:-0}" = 1 ]] || acquire_lock
    for path in "${entries[@]}"; do
      record=$(classify "$path")
      [[ "$record" == $'CANDIDATE\t'* ]] || continue
      rm -rf -- "$path"
      [[ ! -e "$path" ]] || die "failed to remove $path"
      log_event "DELETED path=$path"
    done
    health_check || die "health check failed after retention apply"
  fi
}

if (( exact_mode )); then
  run_exact
else
  run_legacy
fi
