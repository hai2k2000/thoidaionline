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
mkdir -p "$release_root" "$bin" "$root/artifact/.next/server" "$root/artifact/node_modules/next" "$root/artifact/scripts/production" "$root/shared"
chmod 755 "$root" "$release_root" "$root/shared"
chmod 700 "$root/artifact"
printf 'commit=4fcd766d3b96a261297d9bd1d121c41a8a211f62\nbuild_config=canonical-public\nenv_model=runtime-injected\n' > "$root/artifact/.release-meta"
touch "$root/artifact/verify-standalone-artifact.mjs" "$root/artifact/server.js" "$root/artifact/.next/BUILD_ID" "$root/artifact/node_modules/next/package.json" "$root/shared/.env.local" "$root/shared/.env.production"

cat > "$bin/node" <<'EOF'
#!/usr/bin/env bash
case "$(basename "$1")" in
  verify-standalone-artifact.mjs) exit 0 ;;
  controlled-deploy-exception.mjs) echo "RBAC readiness evidence is required" >&2; exit 1 ;;
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
printf 'ln %s\n' "$*" >> "${FIXTURE_ROOT:?}/mutation.log"
case "${FAIL_KIND:-}" in
  ln-rollback-2) [[ "$*" == *rollback-2.new ]] && exit 1 ;;
  ln-rollback-1) [[ "$*" == *rollback-1.new ]] && exit 1 ;;
  ln-previous) [[ "$*" == *previous.new ]] && exit 1 ;;
  ln-current) [[ "$*" == *current.new ]] && exit 1 ;;
esac
exec /usr/bin/ln "$@"
EOF
cat > "$bin/mv" <<'EOF'
#!/usr/bin/env bash
printf 'mv %s\n' "$*" >> "${FIXTURE_ROOT:?}/mutation.log"
case "${FAIL_KIND:-}" in
  mv-rollback-2) [[ "$*" == *rollback-2.new* ]] && exit 1 ;;
  mv-rollback-1) [[ "$*" == *rollback-1.new* ]] && exit 1 ;;
  mv-previous) [[ "$*" == *previous.new* ]] && exit 1 ;;
  mv-current) [[ "$*" == *current.new* ]] && exit 1 ;;
esac
exec /usr/bin/mv "$@"
EOF
cat > "$bin/nginx-guard" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$bin/rbac-gate" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$bin/install" <<'EOF'
#!/usr/bin/env bash
target=${@: -1}
mkdir -p "$target"
chmod 750 "$target"
EOF
cat > "$bin/chown" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$bin/runuser" <<'EOF'
#!/usr/bin/env bash
shift 2
[[ "$1" == -- ]] && shift
if [[ "$1" != test ]]; then exec "$@"; fi
op=$2
path=$3
mode=$(stat -c %a "$path" 2>/dev/null || echo 000)
case "$op" in
  -x) [[ "$mode" == 750 || "$mode" == 755 || "$mode" == 1777 ]] ;;
  -r) [[ "$mode" != 700 && "$mode" != 710 ]] ;;
  -w) [[ "$mode" == 750 || "$mode" == 770 || "$mode" == 775 ]] ;;
  *) exit 1 ;;
esac
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
  local expected_result=${2:-pass}
  rm -f "$root/restart.count" "$root/curl.count" "$root/mutation.log"
  PATH="$bin:$PATH" FAIL_KIND="$kind" FIXTURE_ROOT="$root" THOIDAI_SHARED_ROOT="$root/shared" THOIDAI_HEALTH_ATTEMPTS=1 THOIDAI_RELEASE_ROOT="$release_root" THOIDAI_DEPLOY_LOCK="$root/deploy.lock" THOIDAI_DEPLOY_EVIDENCE_ROOT="$root/evidence" THOIDAI_NEW_RELEASE_PATH="$release_root/new-$kind" THOIDAI_NODE_BIN="$bin/node" THOIDAI_SYSTEMCTL_BIN="$bin/systemctl" THOIDAI_CURL_BIN="$bin/curl" THOIDAI_LN_BIN="$bin/ln" THOIDAI_MV_BIN="$bin/mv" THOIDAI_INSTALL_BIN="$bin/install" THOIDAI_CHOWN_BIN="$bin/chown" THOIDAI_RUNUSER_BIN="$bin/runuser" THOIDAI_NGINX_GUARD_SCRIPT="$bin/nginx-guard" THOIDAI_RBAC_ROLLBACK_GATE="$bin/rbac-gate" THOIDAI_CONTRACT_SMOKE_SCRIPT="$root/contract-smoke.mjs" THOIDAI_BROWSER_SMOKE_SCRIPT="$root/browser-path-smoke.mjs" THOIDAI_SMOKE_COOKIE=test bash scripts/production/deploy-gate.sh "$root/artifact" >"$root/$kind.out" 2>"$root/$kind.err" && return 1
  [[ "$(snapshot)" == "$expected" ]] || { echo "pointer snapshot mismatch: $kind" >&2; return 1; }
  ! grep -q 'deploy-gate: PASS' "$root/$kind.out"
  case "$kind" in
    ln-rollback-2|mv-rollback-2)
      ! grep -q 'rollback-1.new' "$root/mutation.log"
      ! grep -q 'previous.new' "$root/mutation.log"
      ! grep -q 'current.new' "$root/mutation.log"
      ;;
    ln-rollback-1|mv-rollback-1)
      ! grep -q 'previous.new' "$root/mutation.log"
      ! grep -q 'current.new' "$root/mutation.log"
      ;;
    ln-previous|mv-previous)
      ! grep -q 'current.new' "$root/mutation.log"
      ;;
  esac
  if [[ "$expected_result" == pass ]]; then
    grep -q 'automatic rollback: PASS' "$root/$kind.err" || {
      cat "$root/$kind.err" >&2
      return 1
    }
  fi
}

for kind in restart health contract browser ln-rollback-2 mv-rollback-2 ln-rollback-1 mv-rollback-1 ln-previous mv-previous ln-current mv-current; do run_failure "$kind"; done
run_failure rollback critical
cat "$root/rollback.err" >&2
grep -q 'CRITICAL: automatic rollback failed' "$root/rollback.err"
find "$root/evidence" -name 'rollback-failure-*.evidence' -print -quit | grep -q .

flock -n "$root/held.lock" -c 'sleep 2' &
holder=$!
sleep 0.2
PATH="$bin:$PATH" THOIDAI_RELEASE_ROOT="$release_root" THOIDAI_DEPLOY_LOCK="$root/held.lock" THOIDAI_NEW_RELEASE_PATH="$release_root/new-concurrent" THOIDAI_NODE_BIN="$bin/node" THOIDAI_SYSTEMCTL_BIN="$bin/systemctl" THOIDAI_CURL_BIN="$bin/curl" THOIDAI_NGINX_GUARD_SCRIPT="$bin/nginx-guard" THOIDAI_RBAC_ROLLBACK_GATE="$bin/rbac-gate" THOIDAI_CONTRACT_SMOKE_SCRIPT="$root/contract-smoke.mjs" THOIDAI_BROWSER_SMOKE_SCRIPT="$root/browser-path-smoke.mjs" THOIDAI_SMOKE_COOKIE=test bash scripts/production/deploy-gate.sh "$root/artifact" >/dev/null 2>"$root/concurrent.err" && exit 1
grep -q 'deploy lock unavailable' "$root/concurrent.err"
wait "$holder"

rm -f "$root/mutation.log"
printf '{}' > "$root/approval.json"
if PATH="$bin:$PATH" FIXTURE_ROOT="$root" THOIDAI_RELEASE_ROOT="$release_root" THOIDAI_DEPLOY_LOCK="$root/waiver.lock" THOIDAI_NEW_RELEASE_PATH="$release_root/new-waiver-missing-readiness" THOIDAI_NODE_BIN="$bin/node" THOIDAI_SYSTEMCTL_BIN="$bin/systemctl" THOIDAI_CURL_BIN="$bin/curl" THOIDAI_NGINX_GUARD_SCRIPT="$bin/nginx-guard" THOIDAI_RBAC_ROLLBACK_GATE="$bin/rbac-gate" THOIDAI_AUTHENTICATED_SMOKE_WAIVER=1 THOIDAI_DEPLOY_EXCEPTION_APPROVAL="$root/approval.json" bash scripts/production/deploy-gate.sh "$root/artifact" >"$root/waiver.out" 2>"$root/waiver.err"; then
  echo "waiver accepted missing RBAC readiness evidence" >&2
  exit 1
fi
grep -q 'RBAC readiness evidence is required' "$root/waiver.err"
[[ "$(snapshot)" == "$expected" ]]
[[ ! -s "$root/mutation.log" ]]

# A root-only copied release must fail before the one-time waiver validator or
# any lifecycle pointer mutation when permission normalization is ineffective.
cat > "$bin/chmod-noop" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$bin/chmod-noop"
rm -f "$root/mutation.log" "$root/waiver-consumed"
touch "$root/readiness.json"
if PATH="$bin:$PATH" FIXTURE_ROOT="$root" THOIDAI_SHARED_ROOT="$root/shared" THOIDAI_RELEASE_ROOT="$release_root" THOIDAI_DEPLOY_LOCK="$root/permission.lock" THOIDAI_NEW_RELEASE_PATH="$release_root/new-permission-denied" THOIDAI_NODE_BIN="$bin/node" THOIDAI_SYSTEMCTL_BIN="$bin/systemctl" THOIDAI_CURL_BIN="$bin/curl" THOIDAI_LN_BIN="$bin/ln" THOIDAI_MV_BIN="$bin/mv" THOIDAI_INSTALL_BIN="$bin/install" THOIDAI_CHOWN_BIN="$bin/chown" THOIDAI_CHMOD_BIN="$bin/chmod-noop" THOIDAI_RUNUSER_BIN="$bin/runuser" THOIDAI_NGINX_GUARD_SCRIPT="$bin/nginx-guard" THOIDAI_RBAC_ROLLBACK_GATE="$bin/rbac-gate" THOIDAI_AUTHENTICATED_SMOKE_WAIVER=1 THOIDAI_DEPLOY_EXCEPTION_APPROVAL="$root/approval.json" THOIDAI_RBAC_READINESS_EVIDENCE="$root/readiness.json" bash scripts/production/deploy-gate.sh "$root/artifact" >"$root/permission.out" 2>"$root/permission.err"; then
  echo "permission preflight accepted a root-only release" >&2
  exit 1
fi
grep -q 'service user cannot traverse' "$root/permission.err"
[[ "$(snapshot)" == "$expected" ]]
[[ ! -s "$root/mutation.log" ]]
[[ ! -e "$root/waiver-consumed" ]]

echo "deploy-gate-fixtures: PASS (permission preflight, restart health contract browser per-pointer ln/mv fail-closed rollback and real flock contention)"

