#!/usr/bin/env bash
set -Eeuo pipefail
artifact=${1:?usage: $0 <artifact>}
release_root=${THOIDAI_RELEASE_ROOT:-/opt/releases/thoidai-work}
lock_file=${THOIDAI_DEPLOY_LOCK:-/run/lock/thoidai-work-deploy.lock}
hard_min_free_kb=${THOIDAI_HARD_MIN_FREE_KB:-5242880}
estimated_headroom_kb=${THOIDAI_ESTIMATED_HEADROOM_KB:-1048576}
[[ -d "$artifact" && -f "$artifact/.release-meta" ]] || { echo "artifact missing metadata" >&2; exit 1; }
free_kb=$(df -Pk "$release_root" | awk 'NR==2 {print $4}')
if (( free_kb < hard_min_free_kb || free_kb - estimated_headroom_kb < hard_min_free_kb )); then
  echo "DEPLOY ABORTED"; echo "Free space: ${free_kb}KB"; echo "Required minimum: ${hard_min_free_kb}KB"; echo "Estimated build headroom: ${estimated_headroom_kb}KB"; exit 1
fi
exec 9>"$lock_file"
flock -n 9 || { echo "DEPLOY ABORTED: deploy lock unavailable" >&2; exit 1; }
if [[ "${THOIDAI_CANARY_ONLY:-0}" == 1 ]]; then echo "canary gate: PASS"; exit 0; fi
"$(dirname "$0")/nginx-supa-buffer-guard.sh"
new_release=${THOIDAI_NEW_RELEASE_PATH:-$release_root/$(basename "$artifact")}
[[ ! -e "$new_release" && ! -L "$new_release" ]] || { echo "release target already exists" >&2; exit 1; }
cp -a -- "$artifact" "$new_release"
install -d -o "${THOIDAI_SERVICE_USER:-thoidai-work}" -g "${THOIDAI_SERVICE_GROUP:-thoidai-work}" -m 0750 -- "$new_release/.next/cache"
chown "${THOIDAI_SERVICE_USER:-thoidai-work}:${THOIDAI_SERVICE_GROUP:-thoidai-work}" -- "$new_release/.next/cache"
current_target=$(readlink -f -- "$release_root/current")
[[ "$current_target" == "$release_root"/* && -d "$current_target" ]] || { echo "current release target invalid" >&2; exit 1; }
rollback_1_target=$(readlink -f -- "$release_root/rollback-1" 2>/dev/null || true)
previous_target=$(readlink -f -- "$release_root/previous" 2>/dev/null || true)
[[ -d "$rollback_1_target" ]] || rollback_1_target=$previous_target
rollback_2_target=$(readlink -f -- "$release_root/rollback-2" 2>/dev/null || true)
[[ -d "$rollback_2_target" ]] || rollback_2_target=$rollback_1_target
[[ -d "$rollback_1_target" && "$rollback_1_target" == "$release_root"/* ]] || rollback_1_target=$current_target
[[ -d "$rollback_2_target" && "$rollback_2_target" == "$release_root"/* ]] || rollback_2_target=$rollback_1_target
ln -sfn -- "$rollback_1_target" "$release_root/rollback-2.new"
mv -Tf -- "$release_root/rollback-2.new" "$release_root/rollback-2"
ln -sfn -- "$current_target" "$release_root/rollback-1.new"
mv -Tf -- "$release_root/rollback-1.new" "$release_root/rollback-1"
ln -sfn -- "$current_target" "$release_root/previous.new"
mv -Tf -- "$release_root/previous.new" "$release_root/previous"
ln -s -- "$new_release" "$release_root/current.new"
mv -Tf -- "$release_root/current.new" "$release_root/current"
systemctl restart "${THOIDAI_SERVICE:-thoidai-work.service}"
health_ok=0
for attempt in $(seq 1 30); do
  if systemctl is-active --quiet "${THOIDAI_SERVICE:-thoidai-work.service}" \
    && curl -fsS --max-time 15 -o /dev/null "${THOIDAI_HEALTH_URL:-http://127.0.0.1:3001/login}"; then
    health_ok=1
    break
  fi
  sleep 1
done
if (( ! health_ok )); then
  flock -u 9
  "$(dirname "$0")/rollback-application.sh"
  exit 1
fi
if [[ -n "${THOIDAI_SMOKE_COOKIE:-}" || -n "${THOIDAI_SMOKE_BEARER:-}" ]]; then
  if ! node scripts/contract-smoke.mjs; then
    flock -u 9
    "$(dirname "$0")/rollback-application.sh"
    exit 1
  fi
  if ! node scripts/production/browser-path-smoke.mjs; then
    flock -u 9
    "$(dirname "$0")/rollback-application.sh"
    exit 1
  fi
fi
echo "deploy-gate: PASS ($new_release)"
