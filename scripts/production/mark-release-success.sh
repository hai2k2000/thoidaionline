#!/usr/bin/env bash
set -Eeuo pipefail

release=${1:?usage: $0 <release>}
service=${THOIDAI_SERVICE:-thoidai-work.service}
health_url=${THOIDAI_HEALTH_URL:-http://127.0.0.1:3001/login}
systemctl_bin=${THOIDAI_SYSTEMCTL_BIN:-systemctl}
curl_bin=${THOIDAI_CURL_BIN:-curl}
[[ -d "$release" && "$release" = /* ]] || { echo "invalid release path" >&2; exit 2; }
[[ -f "$release/.release-meta" ]] || { echo "managed metadata missing" >&2; exit 1; }
service_working_dir=$(realpath -m -- "$($systemctl_bin show -P WorkingDirectory "$service")")
release_path=$(realpath -m -- "$release")
[[ "$service_working_dir" = "$release_path" ]] || { echo "service does not point to release" >&2; exit 1; }
"$systemctl_bin" is-active --quiet "$service"
"$curl_bin" -fsS --max-time 15 -o /dev/null "$health_url"
release_meta_sha256=$(sha256sum "$release/.release-meta" | awk '{print $1}')
manifest_sha256=$(awk '{print $1}' "$release/.artifact-manifest.sha256")
commit=$(awk -F= '$1=="commit" {print $2; exit}' "$release/.release-meta")
artifact_source_commit=$(awk -F= '$1=="artifact_source_commit" {print $2; exit}' "$release/.release-meta")
printf 'release=%s\nvalidated_at=%s\nservice=%s\nhealth_url=%s\nhealth_status=pass\ndeploy_status=success\ncommit=%s\nartifact_source_commit=%s\nrelease_meta_sha256=%s\nartifact_manifest_sha256=%s\n' \
  "$release" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$service" "$health_url" "$commit" "$artifact_source_commit" "$release_meta_sha256" "$manifest_sha256" > "$release/.deploy-success"
chmod 0640 "$release/.deploy-success"
echo "release-success: PASS ($release)"
