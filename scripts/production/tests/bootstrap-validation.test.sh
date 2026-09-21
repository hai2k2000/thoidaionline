#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/releases/valid-release/.next" "$TMP/releases/valid-release/node_modules/.bin" "$TMP/outside/.next" "$TMP/outside/node_modules/.bin"
printf build-id > "$TMP/releases/valid-release/.next/BUILD_ID"
printf '{}' > "$TMP/releases/valid-release/package.json"
printf '#!/usr/bin/env bash\n' > "$TMP/releases/valid-release/node_modules/.bin/next"
chmod +x "$TMP/releases/valid-release/node_modules/.bin/next"
printf build-id > "$TMP/outside/.next/BUILD_ID"
printf '{}' > "$TMP/outside/package.json"

cat > "$TMP/env-verify" <<'EOF'
#!/usr/bin/env bash
[[ "${TEST_ENV_FAIL:-0}" != 1 && -d "$1" ]]
EOF
chmod +x "$TMP/env-verify"

export THOIDAI_RELEASE_ROOT="$TMP/releases"
export THOIDAI_ENV_VERIFY_BIN="$TMP/env-verify"
source "$ROOT/scripts/production/release-common.sh"

validate_bootstrap_release "$TMP/releases/valid-release"
validate_bootstrap_mapping "$TMP/releases/valid-release" "$TMP/releases/valid-release" "$TMP/releases/valid-release"
if validate_bootstrap_release "$TMP/outside" >/dev/null 2>&1; then exit 1; fi
if validate_bootstrap_mapping "$TMP/releases/valid-release" "$TMP/outside" "$TMP/releases/valid-release" >/dev/null 2>&1; then exit 1; fi
export TEST_ENV_FAIL=1
if validate_bootstrap_release "$TMP/releases/valid-release" >/dev/null 2>&1; then exit 1; fi
echo "PASS bootstrap-validation"
