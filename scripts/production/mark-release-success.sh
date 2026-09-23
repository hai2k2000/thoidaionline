#!/usr/bin/env bash
set -Eeuo pipefail

release=${1:?usage: $0 <release>}
service=${THOIDAI_SERVICE:-thoidai-work.service}
health_url=${THOIDAI_HEALTH_URL:-http://127.0.0.1:3001/login}
systemctl_bin=${THOIDAI_SYSTEMCTL_BIN:-systemctl}
curl_bin=${THOIDAI_CURL_BIN:-curl}
[[ -d "$release" && "$release" = /* ]] || { echo "invalid release path" >&2; exit 2; }
[[ -f "$release/.release-meta" ]] || { echo "managed metadata missing" >&2; exit 1; }
[[ "$($systemctl_bin show -P WorkingDirectory "$service")" = "$(realpath -m "$release")" ]] || { echo "service does not point to release" >&2; exit 1; }
"$systemctl_bin" is-active --quiet "$service"
"$curl_bin" -fsS --max-time 15 -o /dev/null "$health_url"
tmp="$release/.release-meta.new"
awk 'BEGIN { updated_health=0; updated_deploy=0 }
/^health_status=/ { print "health_status=pass"; updated_health=1; next }
/^deploy_status=/ { print "deploy_status=success"; updated_deploy=1; next }
{ print }
END { if (!updated_health) print "health_status=pass"; if (!updated_deploy) print "deploy_status=success" }' "$release/.release-meta" > "$tmp"
mv -f -- "$tmp" "$release/.release-meta"
printf 'release=%s\nvalidated_at=%s\nservice=%s\nhealth_url=%s\nhealth_status=pass\ndeploy_status=success\n' "$release" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$service" "$health_url" > "$release/.deploy-success"
chmod 0640 "$release/.deploy-success"
echo "release-success: PASS ($release)"
