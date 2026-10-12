#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TOOL="$SCRIPT_DIR/../release-retention.sh"
ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
BIN="$ROOT/bin"
RELEASES="$ROOT/releases"
mkdir -p "$BIN" "$RELEASES" "$ROOT/systemd"

cat > "$BIN/systemctl" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == is-active ]]; then exit 0; fi
exit 0
EOF
cat > "$BIN/curl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$BIN/no-ref" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
cat > "$BIN/no-open" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$BIN/no-mount" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$BIN/no-docker" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == ps ]]; then exit 0; fi
exit 0
EOF
cat > "$BIN/state-pgrep" <<'EOF'
#!/usr/bin/env bash
path="${!#}"
if [[ -f "$FAKE_REF_FILE" && "$(cat "$FAKE_REF_FILE")" == "$path" ]]; then exit 0; fi
exit 1
EOF
cat > "$BIN/state-lsof" <<'EOF'
#!/usr/bin/env bash
path="${!#}"
if [[ -f "$FAKE_REF_FILE" && "$(cat "$FAKE_REF_FILE")" == "$path" ]]; then
  printf 'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\nheld 42 root cwd DIR 0 0 0 %s\n' "$path"
fi
exit 0
EOF
cat > "$BIN/state-findmnt" <<'EOF'
#!/usr/bin/env bash
if [[ -f "$FAKE_REF_FILE" ]]; then
  path=$(cat "$FAKE_REF_FILE")
  printf '%s\n' "$path"
else
  printf '/\n'
fi
exit 0
EOF
cat > "$BIN/state-docker" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == ps ]]; then
  if [[ -f "$FAKE_REF_FILE" ]]; then printf 'container-1\n'; fi
  exit 0
fi
if [[ "${1:-}" == inspect ]]; then
  path=$(cat "$FAKE_REF_FILE")
  printf '%s\n' "$path"
  exit 0
fi
exit 0
EOF
cat > "$BIN/failing-inspector" <<'EOF'
#!/usr/bin/env bash
exit 2
EOF
cat > "$BIN/nested-findmnt" <<'EOF'
#!/usr/bin/env bash
for arg in "$@"; do
  if [[ "$arg" == --submounts ]]; then
    printf '/\n%s/subtree\n' "${NESTED_MOUNT_TARGET:?}"
    exit 0
  fi
done
for arg in "$@"; do
  if [[ "$arg" == -T || "$arg" == --target ]]; then
    printf '/\n'
    exit 0
  fi
done
printf '/\n%s/subtree\n' "${NESTED_MOUNT_TARGET:?}"
EOF
cat > "$BIN/grep" <<'EOF'
#!/usr/bin/env bash
if [[ "${FAIL_CONFIG_GREP:-0}" == 1 ]]; then
  for arg in "$@"; do
    [[ "$arg" == "$THOIDAI_SYSTEMD_ROOT" ]] && exit 2
  done
fi
exec /usr/bin/grep "$@"
EOF
cat > "$BIN/flock" <<'EOF'
#!/usr/bin/env bash
if [[ "${FAIL_FLOCK:-0}" == 1 ]]; then exit 1; fi
exec /usr/bin/flock "$@"
EOF
cat > "$BIN/tail" <<'EOF'
#!/usr/bin/env bash
if [[ -n "${FAKE_MANIFEST_PATH:-}" && "${*: -1}" == "$FAKE_MANIFEST_PATH" ]]; then
  exec /usr/bin/tail -n +2 -- "$FAKE_ALTERED_MANIFEST"
fi
exec /usr/bin/tail "$@"
EOF
cat > "$BIN/identity-pgrep" <<'EOF'
#!/usr/bin/env bash
count=0
[[ ! -f "$IDENTITY_COUNT_FILE" ]] || count=$(cat "$IDENTITY_COUNT_FILE")
count=$((count + 1))
printf '%s\n' "$count" > "$IDENTITY_COUNT_FILE"
if (( count == 1 )); then
  mv -- "$IDENTITY_RELEASE" "${IDENTITY_RELEASE}.original"
  mkdir -p "$IDENTITY_RELEASE/.next"
  printf 'replacement-build\n' > "$IDENTITY_RELEASE/.next/BUILD_ID"
  printf 'commit=badbadbadbadbadbadbadbadbadbadbadbadbadb\nbuild_id=replacement-build\n' > "$IDENTITY_RELEASE/.release-meta"
fi
exit 1
EOF
cat > "$BIN/lifecycle-pgrep" <<'EOF'
#!/usr/bin/env bash
count=0
[[ ! -f "$LIFECYCLE_COUNT_FILE" ]] || count=$(cat "$LIFECYCLE_COUNT_FILE")
count=$((count + 1))
printf '%s\n' "$count" > "$LIFECYCLE_COUNT_FILE"
if (( count == 4 )); then
  ln -sfn -- "$LIFECYCLE_RACE_SECOND" "$THOIDAI_RELEASE_ROOT/current"
fi
exit 1
EOF
cat > "$BIN/rm" <<'EOF'
#!/usr/bin/env bash
if [[ -n "${LIFECYCLE_RACE_FIRST:-}" && -n "${LIFECYCLE_RACE_SECOND:-}" ]]; then
  for arg in "$@"; do
    if [[ "$arg" == "$LIFECYCLE_RACE_FIRST" ]]; then
      ln -sfn -- "$LIFECYCLE_RACE_SECOND" "$THOIDAI_RELEASE_ROOT/current"
      break
    fi
  done
fi
exec /usr/bin/rm "$@"
EOF
chmod +x "$BIN"/*
export FAKE_REF_FILE="$ROOT/ref-target"

export THOIDAI_SYSTEMCTL_BIN="$BIN/systemctl"
export THOIDAI_CURL_BIN="$BIN/curl"
export THOIDAI_RELEASE_ROOT="$RELEASES"
export THOIDAI_SYSTEMD_ROOT="$ROOT/systemd"
export THOIDAI_NGINX_ROOT="$ROOT/nginx"
export THOIDAI_PGREP_BIN="$BIN/no-ref"
export THOIDAI_LSOF_BIN="$BIN/no-open"
export THOIDAI_FINDMNT_BIN="$BIN/no-mount"
export THOIDAI_DOCKER_BIN="$BIN/no-docker"
export THOIDAI_LOCK_FILE="$ROOT/lock"
mkdir -p "$THOIDAI_NGINX_ROOT"

make_release() {
  local path=${1:?path required} build_id=${2:-build-$(basename "$1")}
  mkdir -p "$path/.next"
  printf '%s\n' "$build_id" > "$path/.next/BUILD_ID"
  printf 'commit=%040d\nbuild_id=%s\n' 1 "$build_id" > "$path/.release-meta"
}

for name in extra-c-0000003 current-release-0004 previous-release-0005 rollback-release-0006; do
  make_release "$RELEASES/$name"
done
for index in $(seq -w 1 37); do
  make_release "$RELEASES/approved-release-$index-0000001"
done
FIRST_APPROVED="$RELEASES/approved-release-01-0000001"
LAST_APPROVED="$RELEASES/approved-release-37-0000001"
ln -s "$RELEASES/current-release-0004" "$RELEASES/current"
ln -s "$RELEASES/previous-release-0005" "$RELEASES/previous"
ln -s "$RELEASES/rollback-release-0006" "$RELEASES/rollback-2"

MANIFEST="$ROOT/manifest.tsv"
HEADER=$'type\tpath\tapparent_bytes\tallocated_bytes\tmtime_iso\tbirth_iso\tprovenance_sha\tbuild_id\tlifecycle_pointer\tother_symlink\tkeep_file\tprocess_ref\topen_fd_ref\tconfig_ref\tmount_ref\tcontainer_ref\tclassification\treason'
manifest_row() {
  local path=${1:?path required} leading_zero=${2:-0}
  local apparent allocated mtime birth provenance build_id
  apparent=$(du -sx --apparent-size --block-size=1 -- "$path" | awk '{print $1}')
  allocated=$(du -sx --block-size=1 -- "$path" | awk '{print $1}')
  mtime=$(date --date="@$(stat -c %Y -- "$path")" --iso-8601=seconds)
  birth=$(date --date="@$(stat -c %W -- "$path")" --iso-8601=seconds)
  provenance=$(sed -n 's/^commit=//p' "$path/.release-meta" | head -1 | cut -c1-12)
  build_id=$(cat "$path/.next/BUILD_ID")
  if [[ "$leading_zero" == 1 ]]; then
    apparent="000$apparent"
    allocated="000$allocated"
  fi
  printf 'release\t%s\t%s\t%s\t%s\t%s\t%s\t%s\tNO\tNO\tNO\tNO\tNO\tNO\tNO\tNO\tSAFE_CANDIDATE\told-unused\n' \
    "$path" "$apparent" "$allocated" "$mtime" "$birth" "$provenance" "$build_id"
}

printf '%s\n' "$HEADER" > "$MANIFEST"
for index in $(seq -w 1 37); do
  leading_zero=0
  [[ "$index" == 01 ]] && leading_zero=1
  manifest_row "$RELEASES/approved-release-$index-0000001" "$leading_zero" >> "$MANIFEST"
done
HASH=$(sha256sum "$MANIFEST" | awk '{print $1}')
EXPECTED_ALLOCATED=$(awk -F '\t' 'NR > 1 { value=$4; sub(/^0+/, "", value); if (value == "") value=0; total += value } END { printf "%.0f", total }' "$MANIFEST")

single_manifest() {
  local path=${1:?path required} output=${2:?output required}
  printf '%s\n' "$HEADER" > "$output"
  manifest_row "$path" >> "$output"
}

expect_fail() {
  if "$@" >/dev/null 2>&1; then
    echo "unexpected success: $*" >&2
    exit 1
  fi
}

out=$("$TOOL" --manifest "$MANIFEST" --sha256 "$HASH" --dry-run)
echo "$out" | grep -q $'SELECT\t'$FIRST_APPROVED
echo "$out" | grep -q $'SELECT\t'$LAST_APPROVED
[[ $(grep -c '^SELECT' <<< "$out") == 37 ]]
! echo "$out" | grep -q extra-c-0000003
echo "$out" | grep -q $'EXACT_RESULT\tselected=37\textra=0\tallocated_bytes='$EXPECTED_ALLOCATED$'\tmanifest_sha256='$HASH

SYMLINK_TARGET="$RELEASES/approved-release-06-0000001"
ln -s -- "$SYMLINK_TARGET" "$RELEASES/alias-to-approved-0000001"
single_manifest "$SYMLINK_TARGET" "$ROOT/other-symlink.tsv"
symlink_hash=$(sha256sum "$ROOT/other-symlink.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/other-symlink.tsv" --sha256 "$symlink_hash" --dry-run
rm -f -- "$RELEASES/alias-to-approved-0000001"

expect_fail "$TOOL" --manifest "$MANIFEST" --sha256 "$(printf '0%.0s' {1..64})" --dry-run
expect_fail "$TOOL" --manifest "$MANIFEST" --sha256 "$HASH" --apply

single_manifest "$RELEASES/current-release-0004" "$ROOT/current.tsv"
current_hash=$(sha256sum "$ROOT/current.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/current.tsv" --sha256 "$current_hash" --dry-run
for lifecycle_name in previous rollback-2; do
  lifecycle_target=$(readlink -f "$RELEASES/$lifecycle_name")
  single_manifest "$lifecycle_target" "$ROOT/$lifecycle_name.tsv"
  lifecycle_hash=$(sha256sum "$ROOT/$lifecycle_name.tsv" | awk '{print $1}')
  expect_fail "$TOOL" --manifest "$ROOT/$lifecycle_name.tsv" --sha256 "$lifecycle_hash" --dry-run
done

make_release "$RELEASES/parent-release-0000012"
single_manifest "$RELEASES/parent-release-0000012" "$ROOT/parent.tsv"
make_release "$RELEASES/parent-release-0000012/child"
manifest_row "$RELEASES/parent-release-0000012/child" >> "$ROOT/parent.tsv"
parent_hash=$(sha256sum "$ROOT/parent.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/parent.tsv" --sha256 "$parent_hash" --dry-run

single_manifest "$RELEASES/approved-release-02-0000001" "$ROOT/reference.tsv"
sed -i 's/SAFE_CANDIDATE\told-unused/SAFE_CANDIDATE\told-unused/' "$ROOT/reference.tsv"
reference_hash=$(sha256sum "$ROOT/reference.tsv" | awk '{print $1}')
expect_fail env THOIDAI_PGREP_BIN="$BIN/missing-pgrep" "$TOOL" --manifest "$ROOT/reference.tsv" --sha256 "$reference_hash" --dry-run

single_manifest "$RELEASES/approved-release-03-0000001" "$ROOT/process-flag.tsv"
sed -i $'s/\tNO\tNO\tNO\tNO\tNO\tNO\tNO\tNO\tSAFE_CANDIDATE/\tNO\tNO\tNO\tYES\tNO\tNO\tNO\tNO\tSAFE_CANDIDATE/' "$ROOT/process-flag.tsv"
process_hash=$(sha256sum "$ROOT/process-flag.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/process-flag.tsv" --sha256 "$process_hash" --dry-run

single_manifest "$RELEASES/approved-release-05-0000001" "$ROOT/traversal.tsv"
sed -i "s#$RELEASES/approved-release-05-0000001#$RELEASES/approved-release-05-0000001/../approved-release-05-0000001#" "$ROOT/traversal.tsv"
traversal_hash=$(sha256sum "$ROOT/traversal.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/traversal.tsv" --sha256 "$traversal_hash" --dry-run

for reference_kind in process open mount container config; do
  reference_target="$RELEASES/approved-release-04-0000001"
  single_manifest "$reference_target" "$ROOT/$reference_kind.tsv"
  printf '%s\n' "$reference_target" > "$FAKE_REF_FILE"
  case "$reference_kind" in
    process)
      expect_fail env THOIDAI_PGREP_BIN="$BIN/state-pgrep" "$TOOL" --manifest "$ROOT/$reference_kind.tsv" --sha256 "$(sha256sum "$ROOT/$reference_kind.tsv" | awk '{print $1}')" --dry-run
      ;;
    open)
      expect_fail env THOIDAI_LSOF_BIN="$BIN/state-lsof" "$TOOL" --manifest "$ROOT/$reference_kind.tsv" --sha256 "$(sha256sum "$ROOT/$reference_kind.tsv" | awk '{print $1}')" --dry-run
      ;;
    mount)
      expect_fail env THOIDAI_FINDMNT_BIN="$BIN/state-findmnt" "$TOOL" --manifest "$ROOT/$reference_kind.tsv" --sha256 "$(sha256sum "$ROOT/$reference_kind.tsv" | awk '{print $1}')" --dry-run
      ;;
    container)
      expect_fail env THOIDAI_DOCKER_BIN="$BIN/state-docker" "$TOOL" --manifest "$ROOT/$reference_kind.tsv" --sha256 "$(sha256sum "$ROOT/$reference_kind.tsv" | awk '{print $1}')" --dry-run
      ;;
    config)
      printf '%s\n' "$reference_target" > "$ROOT/systemd/reference.conf"
      expect_fail "$TOOL" --manifest "$ROOT/$reference_kind.tsv" --sha256 "$(sha256sum "$ROOT/$reference_kind.tsv" | awk '{print $1}')" --dry-run
      rm -f "$ROOT/systemd/reference.conf"
      ;;
  esac
  rm -f "$FAKE_REF_FILE"
done

NESTED_MOUNT_TARGET="$RELEASES/approved-release-07-0000001"
single_manifest "$NESTED_MOUNT_TARGET" "$ROOT/nested-mount.tsv"
nested_mount_hash=$(sha256sum "$ROOT/nested-mount.tsv" | awk '{print $1}')
expect_fail env THOIDAI_FINDMNT_BIN="$BIN/nested-findmnt" NESTED_MOUNT_TARGET="$NESTED_MOUNT_TARGET" "$TOOL" --manifest "$ROOT/nested-mount.tsv" --sha256 "$nested_mount_hash" --dry-run

for failing_kind in pgrep lsof findmnt docker; do
  failing_target="$RELEASES/approved-release-08-0000001"
  single_manifest "$failing_target" "$ROOT/failed-$failing_kind.tsv"
  failing_hash=$(sha256sum "$ROOT/failed-$failing_kind.tsv" | awk '{print $1}')
  case "$failing_kind" in
    pgrep) failing_var=THOIDAI_PGREP_BIN ;;
    lsof) failing_var=THOIDAI_LSOF_BIN ;;
    findmnt) failing_var=THOIDAI_FINDMNT_BIN ;;
    docker) failing_var=THOIDAI_DOCKER_BIN ;;
  esac
  expect_fail env "$failing_var=$BIN/failing-inspector" "$TOOL" --manifest "$ROOT/failed-$failing_kind.tsv" --sha256 "$failing_hash" --dry-run
done

CONFIG_FAILURE_TARGET="$RELEASES/approved-release-09-0000001"
single_manifest "$CONFIG_FAILURE_TARGET" "$ROOT/config-failure.tsv"
config_failure_hash=$(sha256sum "$ROOT/config-failure.tsv" | awk '{print $1}')
expect_fail env PATH="$BIN:$PATH" FAIL_CONFIG_GREP=1 "$TOOL" --manifest "$ROOT/config-failure.tsv" --sha256 "$config_failure_hash" --dry-run

RACE_TARGET="$RELEASES/approved-release-10-0000001"
single_manifest "$RACE_TARGET" "$ROOT/race.tsv"
single_manifest "$RELEASES/extra-c-0000003" "$ROOT/altered-race.tsv"
race_hash=$(sha256sum "$ROOT/race.tsv" | awk '{print $1}')
if race_out=$(env PATH="$BIN:$PATH" FAKE_MANIFEST_PATH="$ROOT/race.tsv" FAKE_ALTERED_MANIFEST="$ROOT/altered-race.tsv" "$TOOL" --manifest "$ROOT/race.tsv" --sha256 "$race_hash" --dry-run 2>/dev/null) \
  && grep -q $'SELECT\t'$RACE_TARGET <<< "$race_out" \
  && ! grep -q extra-c-0000003 <<< "$race_out"; then
  :
else
  echo "manifest bytes were not pinned to the approved hash" >&2
  exit 1
fi

IDENTITY_TARGET="$RELEASES/identity-metadata-0000020"
make_release "$IDENTITY_TARGET"
single_manifest "$IDENTITY_TARGET" "$ROOT/identity.tsv"
identity_hash=$(sha256sum "$ROOT/identity.tsv" | awk '{print $1}')
printf 'changed-build\n' > "$IDENTITY_TARGET/.next/BUILD_ID"
touch "$IDENTITY_TARGET"
expect_fail "$TOOL" --manifest "$ROOT/identity.tsv" --sha256 "$identity_hash" --dry-run

IDENTITY_RACE_TARGET="$RELEASES/identity-race-0000021"
make_release "$IDENTITY_RACE_TARGET"
single_manifest "$IDENTITY_RACE_TARGET" "$ROOT/identity-race.tsv"
identity_race_hash=$(sha256sum "$ROOT/identity-race.tsv" | awk '{print $1}')
IDENTITY_COUNT_FILE="$ROOT/identity-count"
expect_fail env THOIDAI_OWNER_APPROVED_CLEANUP=1 THOIDAI_APPROVED_MANIFEST_SHA256="$identity_race_hash" \
  THOIDAI_PGREP_BIN="$BIN/identity-pgrep" IDENTITY_COUNT_FILE="$IDENTITY_COUNT_FILE" IDENTITY_RELEASE="$IDENTITY_RACE_TARGET" \
  "$TOOL" --manifest "$ROOT/identity-race.tsv" --sha256 "$identity_race_hash" --apply
if [[ -d "${IDENTITY_RACE_TARGET}.original" ]]; then
  /usr/bin/rm -rf -- "$IDENTITY_RACE_TARGET"
  mv -- "${IDENTITY_RACE_TARGET}.original" "$IDENTITY_RACE_TARGET"
fi

NESTED_LIFECYCLE_PARENT="$RELEASES/nested-lifecycle-parent-0000022"
make_release "$NESTED_LIFECYCLE_PARENT"
make_release "$NESTED_LIFECYCLE_PARENT/nested"
ln -sfn -- "$NESTED_LIFECYCLE_PARENT/nested" "$RELEASES/current"
make_release "$RELEASES/approved-release-14-0000001"
single_manifest "$RELEASES/approved-release-14-0000001" "$ROOT/nested-lifecycle.tsv"
nested_lifecycle_hash=$(sha256sum "$ROOT/nested-lifecycle.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/nested-lifecycle.tsv" --sha256 "$nested_lifecycle_hash" --dry-run
ln -sfn -- "$RELEASES/current-release-0004" "$RELEASES/current"

LIFECYCLE_CONFLICT_TARGET="$RELEASES/lifecycle-conflict-0000023"
make_release "$LIFECYCLE_CONFLICT_TARGET"
make_release "$LIFECYCLE_CONFLICT_TARGET/nested"
ln -sfn -- "$LIFECYCLE_CONFLICT_TARGET/nested" "$RELEASES/current"
single_manifest "$LIFECYCLE_CONFLICT_TARGET" "$ROOT/lifecycle-conflict.tsv"
lifecycle_conflict_hash=$(sha256sum "$ROOT/lifecycle-conflict.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/lifecycle-conflict.tsv" --sha256 "$lifecycle_conflict_hash" --dry-run
ln -sfn -- "$RELEASES/current-release-0004" "$RELEASES/current"

LIFECYCLE_RACE_FIRST="$RELEASES/lifecycle-race-a-0000016"
LIFECYCLE_RACE_SECOND="$RELEASES/lifecycle-race-b-0000017"
make_release "$LIFECYCLE_RACE_FIRST"
make_release "$LIFECYCLE_RACE_SECOND"
printf '%s\n' "$HEADER" > "$ROOT/lifecycle-race.tsv"
manifest_row "$LIFECYCLE_RACE_FIRST" >> "$ROOT/lifecycle-race.tsv"
manifest_row "$LIFECYCLE_RACE_SECOND" >> "$ROOT/lifecycle-race.tsv"
lifecycle_race_hash=$(sha256sum "$ROOT/lifecycle-race.tsv" | awk '{print $1}')
LIFECYCLE_COUNT_FILE="$ROOT/lifecycle-count"
expect_fail env THOIDAI_PGREP_BIN="$BIN/lifecycle-pgrep" LIFECYCLE_COUNT_FILE="$LIFECYCLE_COUNT_FILE" LIFECYCLE_RACE_SECOND="$LIFECYCLE_RACE_SECOND" \
  THOIDAI_OWNER_APPROVED_CLEANUP=1 THOIDAI_APPROVED_MANIFEST_SHA256="$lifecycle_race_hash" \
  "$TOOL" --manifest "$ROOT/lifecycle-race.tsv" --sha256 "$lifecycle_race_hash" --apply
ln -sfn -- "$RELEASES/current-release-0004" "$RELEASES/current"

INHERITED_LOCK_TARGET="$RELEASES/approved-release-15-0000001"
single_manifest "$INHERITED_LOCK_TARGET" "$ROOT/inherited-lock.tsv"
inherited_lock_hash=$(sha256sum "$ROOT/inherited-lock.tsv" | awk '{print $1}')
env PATH="$BIN:$PATH" FAIL_FLOCK=1 THOIDAI_LOCK_HELD=1 \
  "$TOOL" --manifest "$ROOT/inherited-lock.tsv" --sha256 "$inherited_lock_hash" --dry-run

out_repeat=$("$TOOL" --manifest "$MANIFEST" --sha256 "$HASH" --dry-run)
[[ "$out_repeat" == "$out" ]]

APPLY_RELEASE="$RELEASES/apply-only-0000008"
make_release "$APPLY_RELEASE"
single_manifest "$APPLY_RELEASE" "$ROOT/apply.tsv"
apply_hash=$(sha256sum "$ROOT/apply.tsv" | awk '{print $1}')
THOIDAI_OWNER_APPROVED_CLEANUP=1 THOIDAI_APPROVED_MANIFEST_SHA256="$apply_hash" "$TOOL" --manifest "$ROOT/apply.tsv" --sha256 "$apply_hash" --apply >/dev/null
[[ ! -e "$APPLY_RELEASE" ]]

(
  exec 9>"$ROOT/held.lock"
  flock -n 9
  THOIDAI_LOCK_FILE="$ROOT/held.lock" expect_fail "$TOOL" --manifest "$MANIFEST" --sha256 "$HASH" --dry-run
) 9>"$ROOT/held.lock"

PARTIAL_A="$RELEASES/partial-a-0000013"
PARTIAL_B="$RELEASES/partial-b-0000014"
make_release "$PARTIAL_A"
make_release "$PARTIAL_B"
printf '%s\n' "$HEADER" > "$ROOT/partial.tsv"
manifest_row "$PARTIAL_A" >> "$ROOT/partial.tsv"
manifest_row "$PARTIAL_B" >> "$ROOT/partial.tsv"
partial_hash=$(sha256sum "$ROOT/partial.tsv" | awk '{print $1}')
printf '%s\n' "$PARTIAL_B" > "$FAKE_REF_FILE"
expect_fail env THOIDAI_OWNER_APPROVED_CLEANUP=1 THOIDAI_APPROVED_MANIFEST_SHA256="$partial_hash" THOIDAI_PGREP_BIN="$BIN/state-pgrep" "$TOOL" --manifest "$ROOT/partial.tsv" --sha256 "$partial_hash" --apply
[[ -d "$PARTIAL_A" && -d "$PARTIAL_B" ]]
rm -f "$FAKE_REF_FILE"

AUTH_RELEASE="$RELEASES/auth-mismatch-0000015"
make_release "$AUTH_RELEASE"
single_manifest "$AUTH_RELEASE" "$ROOT/auth-mismatch.tsv"
auth_hash=$(sha256sum "$ROOT/auth-mismatch.tsv" | awk '{print $1}')
expect_fail env THOIDAI_OWNER_APPROVED_CLEANUP=1 THOIDAI_APPROVED_MANIFEST_SHA256="$(printf '0%.0s' {1..64})" "$TOOL" --manifest "$ROOT/auth-mismatch.tsv" --sha256 "$auth_hash" --apply
[[ -d "$AUTH_RELEASE" ]]

cp "$MANIFEST" "$ROOT/altered.tsv"
printf '\n' >> "$ROOT/altered.tsv"
expect_fail "$TOOL" --manifest "$ROOT/altered.tsv" --sha256 "$HASH" --dry-run

cp "$MANIFEST" "$ROOT/duplicate.tsv"
tail -n 1 "$MANIFEST" >> "$ROOT/duplicate.tsv"
duplicate_hash=$(sha256sum "$ROOT/duplicate.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/duplicate.tsv" --sha256 "$duplicate_hash" --dry-run

cp "$MANIFEST" "$ROOT/relative.tsv"
sed -i "s#$FIRST_APPROVED#relative-release-0000001#" "$ROOT/relative.tsv"
relative_hash=$(sha256sum "$ROOT/relative.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/relative.tsv" --sha256 "$relative_hash" --dry-run

mkdir -p "$RELEASES/provenance-proof-0000007"
make_release "$RELEASES/provenance-proof-0000007"
cp "$MANIFEST" "$ROOT/provenance.tsv"
sed -i "s#$FIRST_APPROVED#$RELEASES/provenance-proof-0000007#" "$ROOT/provenance.tsv"
provenance_hash=$(sha256sum "$ROOT/provenance.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/provenance.tsv" --sha256 "$provenance_hash" --dry-run

mkdir -p "$RELEASES/keep-release-0000009"
make_release "$RELEASES/keep-release-0000009"
touch "$RELEASES/keep-release-0000009/.keep"
cp "$MANIFEST" "$ROOT/keep.tsv"
sed -i "s#$FIRST_APPROVED#$RELEASES/keep-release-0000009#" "$ROOT/keep.tsv"
keep_hash=$(sha256sum "$ROOT/keep.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/keep.tsv" --sha256 "$keep_hash" --dry-run

cp "$MANIFEST" "$ROOT/missing.tsv"
rm -rf -- "$FIRST_APPROVED"
missing_hash=$(sha256sum "$ROOT/missing.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/missing.tsv" --sha256 "$missing_hash" --dry-run

mkdir -p "$ROOT/escape-target-0000010"
ln -s "$ROOT/escape-target-0000010" "$RELEASES/escape-link-0000011"
cp "$MANIFEST" "$ROOT/escape.tsv"
sed -i "s#$FIRST_APPROVED#$RELEASES/escape-link-0000011#" "$ROOT/escape.tsv"
escape_hash=$(sha256sum "$ROOT/escape.tsv" | awk '{print $1}')
expect_fail "$TOOL" --manifest "$ROOT/escape.tsv" --sha256 "$escape_hash" --dry-run

expect_fail env THOIDAI_OWNER_APPROVED_CLEANUP=1 THOIDAI_APPROVED_MANIFEST_SHA256="$apply_hash" "$TOOL" --manifest "$ROOT/apply.tsv" --sha256 "$apply_hash" --apply

echo PASS exact-manifest-release-retention
