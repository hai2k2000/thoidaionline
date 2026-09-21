#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
BIN="$ROOT/bin"
mkdir -p "$BIN" "$ROOT/repo" "$ROOT/releases" "$ROOT/systemd"
cat > "$BIN/systemctl" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  is-active) exit 0 ;;
  restart) exit 0 ;;
  show) echo 0 ;;
  *) exit 0 ;;
esac
EOF
cat > "$BIN/curl" <<'EOF'
#!/usr/bin/env bash
if [ "${FAKE_HEALTH_FAIL:-0}" = 1 ]; then exit 22; fi
printf '200'
EOF
chmod +x "$BIN/systemctl" "$BIN/curl"
export PATH="$BIN:$PATH"
export THOIDAI_SYSTEMCTL_BIN="$BIN/systemctl"
export THOIDAI_CURL_BIN="$BIN/curl"
export THOIDAI_RELEASE_ROOT="$ROOT/releases"
export THOIDAI_SOURCE_REPO="$ROOT/repo"
export THOIDAI_BUILD_ROOT="$ROOT/build"
export THOIDAI_SYSTEMD_ROOT="$ROOT/systemd"
export THOIDAI_LOCK_FILE="$ROOT/lock"
export THOIDAI_HEALTH_URL=http://test.invalid/login
export THOIDAI_TEST_MODE=1
export THOIDAI_ALLOW_RESTART=1
export THOIDAI_BUILD_COMMAND='mkdir -p .next node_modules; printf build-id > .next/BUILD_ID; printf "{}" > package.json'
export THOIDAI_RETENTION_SCRIPT="$ROOT/no-retention"
printf '#!/usr/bin/env bash\nexit 0\n' > "$THOIDAI_RETENTION_SCRIPT"
chmod +x "$THOIDAI_RETENTION_SCRIPT"

git -C "$ROOT/repo" init -q
git -C "$ROOT/repo" config user.email test@example.invalid
git -C "$ROOT/repo" config user.name test
printf '{"name":"fixture"}\n' > "$ROOT/repo/package.json"
git -C "$ROOT/repo" add package.json
git -C "$ROOT/repo" commit -qm initial
commit=$(git -C "$ROOT/repo" rev-parse HEAD)

for id in current-release-0001 previous-release-0002 rollback-release-0003; do
  mkdir -p "$THOIDAI_RELEASE_ROOT/$id/.next" "$THOIDAI_RELEASE_ROOT/$id/node_modules"
  printf build-id > "$THOIDAI_RELEASE_ROOT/$id/.next/BUILD_ID"
  printf '{}' > "$THOIDAI_RELEASE_ROOT/$id/package.json"
done
ln -s "$THOIDAI_RELEASE_ROOT/current-release-0001" "$THOIDAI_RELEASE_ROOT/current"
ln -s "$THOIDAI_RELEASE_ROOT/previous-release-0002" "$THOIDAI_RELEASE_ROOT/previous"
ln -s "$THOIDAI_RELEASE_ROOT/rollback-release-0003" "$THOIDAI_RELEASE_ROOT/rollback-2"

"$(dirname "$0")/../deploy-release.sh" "$commit" >/dev/null
[ "$(readlink -f "$THOIDAI_RELEASE_ROOT/current")" != "$THOIDAI_RELEASE_ROOT/current-release-0001" ]
[ "$(readlink -f "$THOIDAI_RELEASE_ROOT/previous")" = "$THOIDAI_RELEASE_ROOT/current-release-0001" ]
[ "$(readlink -f "$THOIDAI_RELEASE_ROOT/rollback-2")" = "$THOIDAI_RELEASE_ROOT/previous-release-0002" ]

before=$(readlink -f "$THOIDAI_RELEASE_ROOT/current")
export FAKE_HEALTH_FAIL=1
if "$(dirname "$0")/../deploy-release.sh" "$commit" >/dev/null 2>&1; then exit 1; fi
[ "$(readlink -f "$THOIDAI_RELEASE_ROOT/current")" = "$before" ]
unset FAKE_HEALTH_FAIL

"$(dirname "$0")/../rollback-release.sh" >/dev/null
[ "$(readlink -f "$THOIDAI_RELEASE_ROOT/current")" = "$THOIDAI_RELEASE_ROOT/current-release-0001" ]

echo "PASS deploy-rollback"
