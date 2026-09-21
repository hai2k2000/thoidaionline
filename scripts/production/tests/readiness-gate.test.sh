#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
BIN="$TMP/bin"
mkdir -p "$BIN" "$TMP/releases/current-release/.next" "$TMP/releases/current-release/node_modules"
printf build-id > "$TMP/releases/current-release/.next/BUILD_ID"
printf '{}' > "$TMP/releases/current-release/package.json"
ln -s "$TMP/releases/current-release" "$TMP/releases/current"

cat > "$BIN/systemctl" <<'EOF'
#!/usr/bin/env bash
if [[ "$1" == is-active ]]; then exit 0; fi
if [[ "$1" == show ]]; then
  case "${3:-}" in
    ActiveState) printf 'active\n' ;;
    SubState) printf 'running\n' ;;
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
printf '%s' "${TEST_HTTP_CODE:-200}"
EOF
cat > "$BIN/tcp-ready" <<'EOF'
#!/usr/bin/env bash
exit 0
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
export TEST_WORKING_DIRECTORY="$THOIDAI_RELEASE_ROOT/current"
source "$ROOT/scripts/production/release-common.sh"

migration_readiness_check

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
