#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(uname -s)" != Linux ]]; then
  echo "deploy-gate-fixtures: SKIP (requires POSIX symlink semantics; CI runs on Linux)"
  exit 0
fi

root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
release_root="$root/releases"
bin="$root/bin"
mkdir -p "$release_root" "$bin" "$root/artifact/.next" "$root/artifact/scripts/production"
printf 'build_config=canonical-public\nenv_model=symlink:/opt/thoidai-work/.env.local,/opt/thoidai-work/.env.production\n' > "$root/artifact/.release-meta"
touch "$root/artifact/verify-standalone-artifact.mjs"

cat > "$bin/node" <<'EOF'
#!/usr/bin/env bash
case "$(basename "$1")" in
  verify-standalone-artifact.mjs) exit 0 ;;
  contract-smoke.mjs) [[ "${FAIL_KIND:-}" != contract && "${FAIL_KIND:-}" != rollback && "${FAIL_KIND:-}" != concurrent ]] ;;
  browser-path-smoke.mjs) [[ "${FAIL_KIND:-}" != browser ]] ;;
  *) exit 0 ;;
esac
EOF
cat > "$bin/systemctl" <<'EOF'
#!/usr/bin/env bash
state=${FIXTURE_ROOT:?}/restart.count
case "$1" in
  restart)
    n=0; [[ -f "$state" ]] && n=$(cat "$state"); n=$((n + 1)); echo "$n" > "$state"
    if [[ "${FAIL_KIND:-}" == restart && "$n" == 1 ]]; then exit 1; fi
    if [[ "${FAIL_KIND:-}" == rollback && "$n" -ge 2 ]]; then exit 1; fi
    ;;
  is-active) exit 0 ;;
  *) exit 0 ;;
esac
EOF
cat > "$bin/curl" <<'EOF'
#!/usr/bin/env bash
state=${FIXTURE_ROOT:?}/curl.count
n=0; [[ -f "$state" ]] && n=$(cat "$state"); n=$((n + 1)); echo "$n" > "$state"
if [[ "${FAIL_KIND:-}" == health && "$n" == 1 ]]; then exit 1; fi
exit 0
EOF
cat > "$bin/ln" <<'EOF'
#!/usr/bin/env bash
if [[ "${FAIL_KIND:-}" == pointer && "$*" == *current.new ]]; then exit 1; fi
exec /usr/bin/ln "$@"
EOF
cat > "$bin/nginx-guard" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$bin/install" <<'EOF'
#!/usr/bin/env bash
mkdir -p "${@: -1}"
EOF
cat > "$bin/chown" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$bin/flock" <<'EOF'
#!/usr/bin/env bash
if [[ "${FIXTURE_LOCK_HELD:-0}" == 1 ]]; then exit 1; fi
exit 0
EOF
chmod +x "$bin"/*
touch "$root/contract-smoke.mjs" "$root/browser-path-smoke.mjs"

make_release() {
  local name=$1
  mkdir -p "$release_root/$name"
  printf '%s\n' "$name" > "$release_root/$name/release.txt"
}
make_release current-release
make_release previous-release
make_release rollback1-release
make_release rollback2-release
ln -s "$release_root/current-release" "$release_root/current"
ln -s "$release_root/previous-release" "$release_root/previous"
ln -s "$release_root/rollback1-release" "$release_root/rollback-1"
ln -s "$release_root/rollback2-release" "$release_root/rollback-2"

snapshot() {
  for name in current previous rollback-1 rollback-2; do readlink -f -- "$release_root/$name"; done
}
expected=$(snapshot)

run_failure() {
  local kind=$1
  rm -f "$root/restart.count" "$root/curl.count"
  PATH="$bin:$PATH" FAIL_KIND="$kind" FIXTURE_ROOT="$root" THOIDAI_HEALTH_ATTEMPTS=1 THOIDAI_RELEASE_ROOT="$release_root" THOIDAI_DEPLOY_LOCK="$root/deploy.lock" THOIDAI_DEPLOY_EVIDENCE_ROOT="$root/evidence" THOIDAI_NEW_RELEASE_PATH="$release_root/new-$kind" THOIDAI_NODE_BIN="$bin/node" THOIDAI_SYSTEMCTL_BIN="$bin/systemctl" THOIDAI_CURL_BIN="$bin/curl" THOIDAI_LN_BIN="$bin/ln" THOIDAI_INSTALL_BIN="$bin/install" THOIDAI_CHOWN_BIN="$bin/chown" THOIDAI_NGINX_GUARD_SCRIPT="$bin/nginx-guard" THOIDAI_CONTRACT_SMOKE_SCRIPT="$root/contract-smoke.mjs" THOIDAI_BROWSER_SMOKE_SCRIPT="$root/browser-path-smoke.mjs" THOIDAI_SMOKE_COOKIE=test bash scripts/production/deploy-gate.sh "$root/artifact" >/dev/null 2>"$root/$kind.err" && return 1
  [[ "$(snapshot)" == "$expected" ]] || { echo "pointer snapshot mismatch: $kind" >&2; return 1; }
}

for kind in restart health contract browser pointer; do run_failure "$kind"; done
run_failure rollback
cat "$root/rollback.err" >&2
grep -q 'CRITICAL: automatic rollback failed' "$root/rollback.err"
find "$root/evidence" -name 'rollback-failure-*.evidence' -print -quit | grep -q .

PATH="$bin:$PATH" FIXTURE_LOCK_HELD=1 THOIDAI_RELEASE_ROOT="$release_root" THOIDAI_DEPLOY_LOCK="$root/held.lock" THOIDAI_NEW_RELEASE_PATH="$release_root/new-concurrent" THOIDAI_NODE_BIN="$bin/node" THOIDAI_SYSTEMCTL_BIN="$bin/systemctl" THOIDAI_CURL_BIN="$bin/curl" THOIDAI_NGINX_GUARD_SCRIPT="$bin/nginx-guard" THOIDAI_CONTRACT_SMOKE_SCRIPT="$root/contract-smoke.mjs" THOIDAI_BROWSER_SMOKE_SCRIPT="$root/browser-path-smoke.mjs" THOIDAI_SMOKE_COOKIE=test bash scripts/production/deploy-gate.sh "$root/artifact" >/dev/null 2>"$root/concurrent.err" && exit 1
grep -q 'deploy lock unavailable' "$root/concurrent.err"

echo "deploy-gate-fixtures: PASS (restart health contract browser pointer rollback-failure)"

