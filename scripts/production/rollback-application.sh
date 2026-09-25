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
ln -s -- "$previous" "$release_root/current.rollback.new"
mv -Tf -- "$release_root/current.rollback.new" "$release_root/current"
systemctl restart "$service"
systemctl is-active --quiet "$service"
curl -fsS --max-time 15 -o /dev/null "$health_url"
echo "application-rollback: PASS ($previous)"
