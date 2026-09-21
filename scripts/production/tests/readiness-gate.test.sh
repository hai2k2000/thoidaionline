#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
BIN="$TMP/bin"
mkdir -p "$BIN" "$TMP/releases/current-release/.next" "$TMP/releases/current-release/node_modules/.bin"
printf build-id > "$TMP/releases/current-release/.next/BUILD_ID"
printf '{}' > "$TMP/releases/current-release/package.json"
printf '#!/usr/bin/env bash\n' > "$TMP/releases/current-release/node_modules/.bin/next"
chmod +x "$TMP/releases/current-release/node_modules/.bin/next"
ln -s "$TMP/releases/current-release" "$TMP/releases/current"

cat > "$BIN/systemctl" <<'EOF'
#!/usr/bin/env bash
if [[ "$1" == is-active ]]; then exit 0; fi
if [[ "$1" == show ]]; then
  if [[ "$2" == -p ]]; then
    property=$3
    case "$property" in
      CapabilityBoundingSet) [[ "${TEST_CAPABILITY_BOUNDING_SET_MISSING-}" == 1 ]] || printf 'CapabilityBoundingSet=%s\n' "${TEST_CAPABILITY_BOUNDING_SET-}" ;;
      AmbientCapabilities) [[ "${TEST_AMBIENT_CAPABILITIES_MISSING-}" == 1 ]] || printf 'AmbientCapabilities=%s\n' "${TEST_AMBIENT_CAPABILITIES-}" ;;
      NoNewPrivileges) [[ "${TEST_NO_NEW_PRIVILEGES_MISSING-}" == 1 ]] || printf 'NoNewPrivileges=%s\n' "${TEST_NO_NEW_PRIVILEGES-yes}" ;;
      PrivateTmp) [[ "${TEST_PRIVATE_TMP_MISSING-}" != 1 ]] || exit 1; printf 'PrivateTmp=%s\n' "${TEST_PRIVATE_TMP-yes}" ;;
      ProtectSystem) printf 'ProtectSystem=%s\n' "${TEST_PROTECT_SYSTEM-strict}" ;;
      ProtectHome) printf 'ProtectHome=%s\n' "${TEST_PROTECT_HOME-yes}" ;;
      RestrictAddressFamilies) printf 'RestrictAddressFamilies=%s\n' "${TEST_RESTRICT_ADDRESS_FAMILIES-AF_INET AF_INET6 AF_UNIX}" ;;
      MissingProperty) exit 1 ;;
      *) exit 1 ;;
    esac
    exit 0
  fi
  case "${3:-}" in
    ActiveState) printf '%s\n' "${TEST_ACTIVE_STATE:-active}" ;;
    SubState) printf '%s\n' "${TEST_SUB_STATE:-running}" ;;
    MainPID) printf '1234\n' ;;
    NRestarts)
      state_file=${TEST_NRESTARTS_FILE:-}
      if [[ -n "$state_file" ]]; then
        read -r value < "$state_file"
        printf '%s\n' "$value"
        printf '%s\n' "$((value + 1))" > "$state_file"
      else
        printf '%s\n' "${TEST_NRESTARTS:-0}"
      fi
      ;;
    WorkingDirectory) printf '%s\n' "$TEST_WORKING_DIRECTORY" ;;
    MemoryHigh) printf '%s\n' "${TEST_MEMORY_HIGH:-524288000}" ;;
    MemoryMax) printf '%s\n' "${TEST_MEMORY_MAX:-681574400}" ;;
    TasksMax) printf '%s\n' "${TEST_TASKS_MAX:-250}" ;;
    *) exit 1 ;;
  esac
  exit 0
fi
exit 1
EOF
cat > "$BIN/curl" <<'EOF'
#!/usr/bin/env bash
count_file=${TEST_HTTP_COUNT_FILE:-}
count=0
if [[ -n "$count_file" ]]; then
  count=$(cat "$count_file" 2>/dev/null || printf '0')
  printf '%s\n' "$((count + 1))" > "$count_file"
fi
if [[ -n "${TEST_HTTP_SEQUENCE:-}" ]]; then
  IFS=, read -r -a sequence <<<"$TEST_HTTP_SEQUENCE"
  index=$((count < ${#sequence[@]} ? count : ${#sequence[@]} - 1))
  printf '%s' "${sequence[$index]}"
else
  printf '%s' "${TEST_HTTP_CODE:-200}"
fi
EOF
cat > "$BIN/tcp-ready" <<'EOF'
#!/usr/bin/env bash
count_file=${TEST_TCP_COUNT_FILE:-}
count=0
if [[ -n "$count_file" ]]; then
  count=$(cat "$count_file" 2>/dev/null || printf '0')
  printf '%s\n' "$((count + 1))" > "$count_file"
fi
if [[ -n "${TEST_TCP_FAILS:-}" && "$count" -lt "$TEST_TCP_FAILS" ]]; then exit 1; fi
exit "${TEST_TCP_EXIT:-0}"
EOF
cat > "$BIN/env-verify" <<'EOF'
#!/usr/bin/env bash
[ -d "$1" ]
EOF
chmod +x "$BIN"/*

export PATH="$BIN:$PATH"
export THOIDAI_RELEASE_ROOT="$TMP/releases"
export THOIDAI_SYSTEMCTL_BIN="$BIN/systemctl"
export THOIDAI_CURL_BIN="$BIN/curl"
export THOIDAI_TCP_CHECK_BIN="$BIN/tcp-ready"
export THOIDAI_ENV_VERIFY_BIN="$BIN/env-verify"
export THOIDAI_SERVICE=thoidai-work.service
export THOIDAI_HEALTH_URL=http://test.invalid/login
export THOIDAI_READY_OBSERVATION_SEC=0
export THOIDAI_READY_TIMEOUT_SEC=1
export THOIDAI_READY_POLL_INTERVAL_SEC=0.01
export TEST_WORKING_DIRECTORY="$THOIDAI_RELEASE_ROOT/current"
source "$ROOT/scripts/production/release-common.sh"

validate_systemd_hardening

export TEST_CAPABILITY_BOUNDING_SET=CAP_NET_BIND_SERVICE
if validate_systemd_hardening >/dev/null 2>&1; then exit 1; fi
unset TEST_CAPABILITY_BOUNDING_SET

export TEST_CAPABILITY_BOUNDING_SET_MISSING=1
if validate_systemd_hardening >/dev/null 2>&1; then exit 1; fi
unset TEST_CAPABILITY_BOUNDING_SET_MISSING

export TEST_AMBIENT_CAPABILITIES=CAP_NET_BIND_SERVICE
if validate_systemd_hardening >/dev/null 2>&1; then exit 1; fi
unset TEST_AMBIENT_CAPABILITIES

export TEST_AMBIENT_CAPABILITIES_MISSING=1
if validate_systemd_hardening >/dev/null 2>&1; then exit 1; fi
unset TEST_AMBIENT_CAPABILITIES_MISSING

export TEST_NO_NEW_PRIVILEGES=
if validate_systemd_hardening >/dev/null 2>&1; then exit 1; fi
unset TEST_NO_NEW_PRIVILEGES

export TEST_NO_NEW_PRIVILEGES_MISSING=1
if validate_systemd_hardening >/dev/null 2>&1; then exit 1; fi
unset TEST_NO_NEW_PRIVILEGES_MISSING

export TEST_PRIVATE_TMP=
if validate_systemd_hardening >/dev/null 2>&1; then exit 1; fi
unset TEST_PRIVATE_TMP

if systemd_property_required MissingProperty >/dev/null 2>&1; then exit 1; fi

migration_readiness_check

printf '0\n' > "$TMP/tcp-count"
printf '0\n' > "$TMP/http-count"
export TEST_TCP_COUNT_FILE="$TMP/tcp-count" TEST_TCP_FAILS=2
export TEST_HTTP_COUNT_FILE="$TMP/http-count" TEST_HTTP_SEQUENCE=503,200
migration_readiness_check

printf '0\n' > "$TMP/tcp-count"
unset TEST_HTTP_SEQUENCE
export TEST_TCP_FAILS=999
if migration_readiness_check >/dev/null 2>&1; then exit 1; fi
unset TEST_TCP_FAILS

printf '0\n' > "$TMP/tcp-count"
printf '0\n' > "$TMP/http-count"
export TEST_HTTP_SEQUENCE=503,503,503
if migration_readiness_check >/dev/null 2>&1; then exit 1; fi
unset TEST_HTTP_SEQUENCE

export TEST_TCP_FAILS=999
timeout_start=$(date +%s)
if migration_readiness_check >/dev/null 2>"$TMP/timeout.err"; then exit 1; fi
timeout_elapsed=$(( $(date +%s) - timeout_start ))
(( timeout_elapsed < 3 ))
grep -q 'elapsed_ms=' "$TMP/timeout.err"
grep -q 'last_tcp=' "$TMP/timeout.err"
grep -q 'MainPID=' "$TMP/timeout.err"
grep -q 'NRestarts=' "$TMP/timeout.err"
unset TEST_TCP_FAILS

export TEST_ACTIVE_STATE=failed TEST_SUB_STATE=failed
if migration_readiness_check >/dev/null 2>&1; then exit 1; fi
unset TEST_ACTIVE_STATE TEST_SUB_STATE

export TEST_HTTP_CODE=503
if migration_readiness_check >/dev/null 2>&1; then exit 1; fi
unset TEST_HTTP_CODE

export TEST_WORKING_DIRECTORY="$TMP/releases/current-release"
if migration_readiness_check >/dev/null 2>&1; then exit 1; fi
export TEST_WORKING_DIRECTORY="$THOIDAI_RELEASE_ROOT/current"

export TEST_MEMORY_HIGH=1
if migration_readiness_check >/dev/null 2>&1; then exit 1; fi
unset TEST_MEMORY_HIGH

printf '0\n' > "$TMP/nrestarts"
export TEST_NRESTARTS_FILE="$TMP/nrestarts"
if migration_readiness_check >/dev/null 2>&1; then exit 1; fi
unset TEST_NRESTARTS_FILE

echo "PASS readiness-gate"
