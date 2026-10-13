#!/usr/bin/env bash
set -Eeuo pipefail
release_root=${THOIDAI_RELEASE_ROOT:-/opt/releases/thoidai-work}
service=${THOIDAI_SERVICE:-thoidai-work.service}
health_url=${THOIDAI_HEALTH_URL:-http://127.0.0.1:3001/login}
lock_file=${THOIDAI_DEPLOY_LOCK:-/run/lock/thoidai-work-deploy.lock}
exec 9>"$lock_file"
flock -n 9 || { echo "rollback aborted: deploy lock unavailable" >&2; exit 1; }
previous=$(readlink -f -- "$release_root/previous")
[[ "$previous" == "$release_root"/* && -d "$previous" ]] || { echo "rollback target invalid" >&2; exit 1; }
current_target=${THOIDAI_ROLLBACK_CURRENT_TARGET:-$previous}
previous_target=${THOIDAI_ROLLBACK_PREVIOUS_TARGET:-}
rollback_1_target=${THOIDAI_ROLLBACK_1_TARGET:-}
rollback_2_target=${THOIDAI_ROLLBACK_2_TARGET:-}
for target in "$current_target" ${previous_target:+"$previous_target"} ${rollback_1_target:+"$rollback_1_target"} ${rollback_2_target:+"$rollback_2_target"}; do
  [[ "$target" == "$release_root"/* && -d "$target" ]] || { echo "rollback target invalid: $target" >&2; exit 1; }
done
set_link() {
  local target=$1 name=$2
  ln -s -- "$target" "$release_root/$name.new"
  mv -Tf -- "$release_root/$name.new" "$release_root/$name"
}
set_link "$current_target" current
if [[ -n "$previous_target" ]]; then
  set_link "$previous_target" previous
  set_link "$rollback_1_target" rollback-1
  set_link "$rollback_2_target" rollback-2
fi
systemctl restart "$service"
systemctl is-active --quiet "$service"
curl -fsS --max-time 15 -o /dev/null "$health_url"
echo "application-rollback: PASS ($previous)"
