#!/usr/bin/env bash
set -Eeuo pipefail

artifact=${1:?usage: $0 <artifact>}
release_root=${THOIDAI_RELEASE_ROOT:-/opt/releases/thoidai-work}
lock_file=${THOIDAI_DEPLOY_LOCK:-/run/lock/thoidai-work-deploy.lock}
systemctl_bin=${THOIDAI_SYSTEMCTL_BIN:-systemctl}
curl_bin=${THOIDAI_CURL_BIN:-curl}
node_bin=${THOIDAI_NODE_BIN:-node}
ln_bin=${THOIDAI_LN_BIN:-ln}
mv_bin=${THOIDAI_MV_BIN:-mv}
install_bin=${THOIDAI_INSTALL_BIN:-install}
chown_bin=${THOIDAI_CHOWN_BIN:-chown}
chmod_bin=${THOIDAI_CHMOD_BIN:-chmod}
runuser_bin=${THOIDAI_RUNUSER_BIN:-runuser}
cp_bin=${THOIDAI_CP_BIN:-cp}
service=${THOIDAI_SERVICE:-thoidai-work.service}
health_url=${THOIDAI_HEALTH_URL:-http://127.0.0.1:3001/login}
health_attempts=${THOIDAI_HEALTH_ATTEMPTS:-30}
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
nginx_guard=${THOIDAI_NGINX_GUARD_SCRIPT:-$script_dir/nginx-supa-buffer-guard.sh}
rbac_gate=${THOIDAI_RBAC_ROLLBACK_GATE:-$script_dir/check-rbac-rollback-compatibility.sh}

hard_min_free_kb=${THOIDAI_HARD_MIN_FREE_KB:-20971520}
estimated_headroom_kb=${THOIDAI_ESTIMATED_HEADROOM_KB:-1048576}
[[ "$hard_min_free_kb" =~ ^[0-9]+$ && "$estimated_headroom_kb" =~ ^[0-9]+$ ]] || { echo "DEPLOY ABORTED: invalid disk gate values" >&2; exit 1; }
[[ -d "$artifact" && -f "$artifact/.release-meta" ]] || { echo "artifact missing metadata" >&2; exit 1; }
artifact_commit=$(awk -F= '$1=="commit" {print $2; exit}' "$artifact/.release-meta")
smoke_waived=0
free_kb=$(df -Pk "$release_root" | awk 'NR==2 {print $4}')
if (( free_kb < hard_min_free_kb || free_kb - estimated_headroom_kb < hard_min_free_kb )); then
  echo "DEPLOY ABORTED"
  echo "Free space: ${free_kb}KB"
  echo "Required minimum: ${hard_min_free_kb}KB"
  echo "Estimated build headroom: ${estimated_headroom_kb}KB"
  exit 1
fi

exec 9>"$lock_file"
flock -n 9 || { echo "DEPLOY ABORTED: deploy lock unavailable" >&2; exit 1; }
if [[ "${THOIDAI_CANARY_ONLY:-0}" == 1 ]]; then echo "canary gate: PASS"; exit 0; fi
"$nginx_guard"

new_release=${THOIDAI_NEW_RELEASE_PATH:-$release_root/$(basename "$artifact")}
[[ ! -e "$new_release" && ! -L "$new_release" ]] || { echo "release target already exists" >&2; exit 1; }
"$node_bin" "$artifact/verify-standalone-artifact.mjs" "$artifact"
build_config=$(awk -F= '$1=="build_config" {print $2; exit}' "$artifact/.release-meta")
[[ "$build_config" == canonical-public ]] || { echo "DEPLOY ABORTED: artifact build config is not canonical-public" >&2; exit 1; }
if [[ "${THOIDAI_AUTHENTICATED_SMOKE_WAIVER:-0}" == 1 ]]; then
  approval_path=${THOIDAI_DEPLOY_EXCEPTION_APPROVAL:-}
  readiness_path=${THOIDAI_RBAC_READINESS_EVIDENCE:-}
  waiver_evidence=${THOIDAI_DEPLOY_EXCEPTION_EVIDENCE:-${THOIDAI_DEPLOY_EVIDENCE_ROOT:-/var/lib/thoidai-work/deploy-evidence}/rbac-v2-smoke-waiver-$(date -u +%Y%m%dT%H%M%SZ).evidence}
  [[ -n "$approval_path" ]] || { echo "DEPLOY ABORTED: controlled smoke-waiver approval is required" >&2; exit 1; }
  [[ -n "$readiness_path" ]] || { echo "DEPLOY ABORTED: RBAC readiness evidence is required" >&2; exit 1; }
else
  [[ -n "${THOIDAI_SMOKE_COOKIE:-}" || -n "${THOIDAI_SMOKE_BEARER:-}" ]] || { echo "DEPLOY ABORTED: authenticated smoke credentials are required" >&2; exit 1; }
fi
"$cp_bin" -a -- "$artifact" "$new_release"
"$node_bin" "$new_release/verify-standalone-artifact.mjs" "$new_release"
service_user=${THOIDAI_SERVICE_USER:-thoidai-work}
service_group=${THOIDAI_SERVICE_GROUP:-thoidai-work}
if [[ -L "$new_release" || ! -d "$new_release" ]]; then
  echo "DEPLOY ABORTED: release directory is not a regular directory" >&2
  exit 1
fi
# The ZIP/extraction boundary can preserve a root-only top-level mode. Normalize
# only that directory; application files stay immutable and secrets stay private.
"$chown_bin" "root:${service_group}" -- "$new_release"
"$chmod_bin" 0750 -- "$new_release"
cache_path="$new_release/.next/cache"
[[ ! -L "$cache_path" ]] || { echo "DEPLOY ABORTED: runtime cache path must not be a symlink" >&2; exit 1; }
"$install_bin" -d -o "$service_user" -g "$service_group" -m 0750 -- "$cache_path"
"$chown_bin" "$service_user:$service_group" -- "$cache_path"
env_model=$(awk -F= '$1=="env_model" {print $2; exit}' "$new_release/.release-meta")
if [[ "$env_model" == runtime-injected ]]; then
  shared_root=${THOIDAI_SHARED_ROOT:-/opt/thoidai-work}
  for name in .env.local .env.production; do
    [[ -f "$shared_root/$name" ]] || { echo "runtime environment file missing: $shared_root/$name" >&2; exit 1; }
    [[ ! -e "$new_release/$name" && ! -L "$new_release/$name" ]] || { echo "DEPLOY ABORTED: runtime environment path already exists" >&2; exit 1; }
    ln -s -- "$shared_root/$name" "$new_release/$name"
  done
fi
permission_check() {
  local expression=$1 path=$2
  "$runuser_bin" -u "$service_user" -- test "$expression" "$path"
}
parent=$new_release
while [[ "$parent" != / ]]; do
  permission_check -x "$parent" || { echo "DEPLOY ABORTED: service user cannot traverse $parent" >&2; exit 1; }
  parent=$(dirname "$parent")
done
for required_dir in .next .next/server node_modules; do
  permission_check -x "$new_release/$required_dir" || { echo "DEPLOY ABORTED: service user cannot traverse runtime path $required_dir" >&2; exit 1; }
done
for required_file in server.js .next/BUILD_ID .env.local .env.production; do
  permission_check -r "$new_release/$required_file" || { echo "DEPLOY ABORTED: service user cannot read runtime path $required_file" >&2; exit 1; }
done
permission_check -w "$cache_path" || { echo "DEPLOY ABORTED: service user cannot write runtime cache" >&2; exit 1; }
"$runuser_bin" -u "$service_user" -- "$node_bin" -e 'require.resolve("next/package.json", { paths: [process.argv[1]] })' "$new_release" || { echo "DEPLOY ABORTED: service user cannot resolve standalone runtime modules" >&2; exit 1; }

read_pointer() {
  local name=$1 target
  [[ -L "$release_root/$name" ]] || { echo "DEPLOY ABORTED: lifecycle pointer missing: $name" >&2; return 1; }
  target=$(readlink -f -- "$release_root/$name" 2>/dev/null || true)
  [[ "$target" == "$release_root"/* && -d "$target" ]] || { echo "DEPLOY ABORTED: lifecycle pointer invalid: $name" >&2; return 1; }
  printf '%s' "$target"
}

current_target=$(read_pointer current) || exit 1
previous_target=$(read_pointer previous) || exit 1
rollback_1_target=$(read_pointer rollback-1) || exit 1
rollback_2_target=$(read_pointer rollback-2) || exit 1
THOIDAI_RBAC_ROLLBACK_TARGET_PATH="$current_target" "$rbac_gate" || { echo "DEPLOY ABORTED: RBAC rollback compatibility gate failed for rollback target" >&2; exit 1; }

if [[ "${THOIDAI_AUTHENTICATED_SMOKE_WAIVER:-0}" == 1 ]]; then
  exception_validator="$artifact/scripts/production/controlled-deploy-exception.mjs"
  [[ -f "$exception_validator" ]] || { echo "DEPLOY ABORTED: artifact is missing the controlled exception validator" >&2; exit 1; }
  "$node_bin" "$exception_validator" "$approval_path" "$artifact_commit" "$waiver_evidence" "$readiness_path" || { echo "DEPLOY ABORTED: controlled smoke-waiver approval or RBAC readiness evidence is invalid, stale, or already used" >&2; exit 1; }
  smoke_waived=1
fi

rollback_snapshot() {
  local rollback_status=0
  set +e
  rm -f -- "$release_root/current.rollback.new" "$release_root/previous.rollback.new" "$release_root/rollback-1.rollback.new" "$release_root/rollback-2.rollback.new"
  "$ln_bin" -sfn -- "$current_target" "$release_root/current.rollback.new" && "$mv_bin" -Tf -- "$release_root/current.rollback.new" "$release_root/current" || rollback_status=1
  "$ln_bin" -sfn -- "$previous_target" "$release_root/previous.rollback.new" && "$mv_bin" -Tf -- "$release_root/previous.rollback.new" "$release_root/previous" || rollback_status=1
  "$ln_bin" -sfn -- "$rollback_1_target" "$release_root/rollback-1.rollback.new" && "$mv_bin" -Tf -- "$release_root/rollback-1.rollback.new" "$release_root/rollback-1" || rollback_status=1
  "$ln_bin" -sfn -- "$rollback_2_target" "$release_root/rollback-2.rollback.new" && "$mv_bin" -Tf -- "$release_root/rollback-2.rollback.new" "$release_root/rollback-2" || rollback_status=1
  "$systemctl_bin" restart "$service" || rollback_status=1
  "$systemctl_bin" is-active --quiet "$service" || rollback_status=1
  "$curl_bin" -fsS --max-time 15 -o /dev/null "$health_url" || rollback_status=1
  for pointer in current previous rollback-1 rollback-2; do
    expected="${current_target}"
    [[ "$pointer" == previous ]] && expected="$previous_target"
    [[ "$pointer" == rollback-1 ]] && expected="$rollback_1_target"
    [[ "$pointer" == rollback-2 ]] && expected="$rollback_2_target"
    actual=$(readlink -f -- "$release_root/$pointer" 2>/dev/null || true)
    [[ "$actual" == "$expected" ]] || rollback_status=1
  done
  if (( rollback_status != 0 )); then
    printf 'CRITICAL: automatic rollback failed; snapshot current=%s previous=%s rollback-1=%s rollback-2=%s\n' \
      "$current_target" "$previous_target" "$rollback_1_target" "$rollback_2_target" >&2
  else
    echo "automatic rollback: PASS (full pointer snapshot restored)" >&2
  fi
  set -e
  return "$rollback_status"
}

fail_after_mutation() {
  local reason=$1
  echo "DEPLOY ABORTED: $reason" >&2
  if ! THOIDAI_RBAC_ROLLBACK_TARGET_PATH="$current_target" "$rbac_gate"; then
    echo "CRITICAL: automatic rollback blocked by RBAC compatibility gate" >&2
    exit 1
  fi
  local rollback_status=0
  rollback_snapshot || rollback_status=$?
  if (( rollback_status != 0 )); then
    local evidence_root=${THOIDAI_DEPLOY_EVIDENCE_ROOT:-/var/lib/thoidai-work/deploy-evidence}
    mkdir -p -- "$evidence_root" 2>/dev/null || true
    {
      printf 'event=automatic-rollback-failure\nreason=%s\nrollback_status=%s\n' "$reason" "$rollback_status"
      printf 'recorded_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      printf 'snapshot_current=%s\nsnapshot_previous=%s\nsnapshot_rollback_1=%s\nsnapshot_rollback_2=%s\n' \
        "$current_target" "$previous_target" "$rollback_1_target" "$rollback_2_target"
      for name in current previous rollback-1 rollback-2; do
        printf 'observed_%s=%s\n' "$name" "$(readlink -f -- "$release_root/$name" 2>/dev/null || echo missing)"
      done
    } > "$evidence_root/rollback-failure-$(date -u +%Y%m%dT%H%M%SZ)-$$.evidence" 2>/dev/null || true
    echo "CRITICAL: production health is not proven after rollback failure" >&2
  fi
  exit 1
}

atomic_pointer() {
  local target=$1 name=$2 tmp="$release_root/$2.new"
  rm -f -- "$tmp" || return 1
  "$ln_bin" -sfn -- "$target" "$tmp" || return 1
  "$mv_bin" -Tf -- "$tmp" "$release_root/$name" || return 1
}

if ! atomic_pointer "$rollback_1_target" rollback-2; then
  fail_after_mutation "lifecycle pointer mutation failed"
fi
if ! atomic_pointer "$current_target" rollback-1; then
  fail_after_mutation "lifecycle pointer mutation failed"
fi
if ! atomic_pointer "$current_target" previous; then
  fail_after_mutation "lifecycle pointer mutation failed"
fi
if ! atomic_pointer "$new_release" current; then
  fail_after_mutation "lifecycle pointer mutation failed"
fi

if ! "$systemctl_bin" restart "$service"; then
  fail_after_mutation "service restart failed"
fi
health_ok=0
for attempt in $(seq 1 "$health_attempts"); do
  if "$systemctl_bin" is-active --quiet "$service" && "$curl_bin" -fsS --max-time 15 -o /dev/null "$health_url"; then
    health_ok=1
    break
  fi
  sleep 1
done
if (( ! health_ok )); then
  fail_after_mutation "service health check failed"
fi
if (( smoke_waived == 0 )); then
  if ! "$node_bin" "${THOIDAI_CONTRACT_SMOKE_SCRIPT:-scripts/contract-smoke.mjs}"; then
    fail_after_mutation "authenticated contract smoke failed"
  fi
  if ! "$node_bin" "${THOIDAI_BROWSER_SMOKE_SCRIPT:-scripts/production/browser-path-smoke.mjs}"; then
    fail_after_mutation "browser-path smoke failed"
  fi
else
  echo "AUTHENTICATED_SMOKE=WAIVED"
fi
echo "deploy-gate: PASS ($new_release)"
