#!/usr/bin/env bash
set -Eeuo pipefail

artifact=${1:?usage: $0 <artifact-dir> <expected-commit> [--verify-only|--activate]}
expected_commit=${2:?usage: $0 <artifact-dir> <expected-commit> [--verify-only|--activate]}
mode=${3:---verify-only}
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
shared_root=${THOIDAI_SHARED_ROOT:-/opt/thoidai-work}
release_root=${THOIDAI_RELEASE_ROOT:-/opt/releases/thoidai-work}

resolve_path() { readlink -f -- "$1" 2>/dev/null || realpath -m -- "$1"; }
artifact_path=$(resolve_path "$artifact")
release_root_path=$(resolve_path "$release_root")
[[ -d "$artifact" && ! -L "$artifact" ]] || { echo "staging safety: BLOCK (not a regular directory)" >&2; exit 1; }
[[ "$artifact_path" != "$release_root_path" && "$artifact_path" != "$release_root_path"/* ]] || { echo "staging safety: BLOCK (inside release root)" >&2; exit 1; }
for pointer in current previous rollback-1 rollback-2; do
  if [[ -L "$release_root/$pointer" ]]; then
    pointer_path=$(resolve_path "$release_root/$pointer")
    [[ "$artifact_path" != "$pointer_path" ]] || { echo "staging safety: BLOCK (matches protected pointer $pointer)" >&2; exit 1; }
  fi
done

staging_marker="${artifact}.codex-staging-owner"
cleanup_staging() {
  local marker_path staging_path
  [[ "$mode" == --activate ]] || return 0
  [[ -f "$staging_marker" ]] || { echo "staging cleanup: SKIP (ownership marker missing)" >&2; return 0; }
  staging_path=$(resolve_path "$artifact")
  [[ "$staging_path" == "$artifact_path" ]] || { echo "staging cleanup: SKIP (path changed)" >&2; return 0; }
  [[ "$staging_path" != "$release_root_path" && "$staging_path" != "$release_root_path"/* ]] || { echo "staging cleanup: BLOCK (release-root path)" >&2; return 0; }
  [[ "$staging_path" != "$(resolve_path "$release_root/current")" && "$staging_path" != "$(resolve_path "$release_root/previous")" && "$staging_path" != "$(resolve_path "$release_root/rollback-1")" && "$staging_path" != "$(resolve_path "$release_root/rollback-2")" ]] || { echo "staging cleanup: BLOCK (protected release)" >&2; return 0; }
  marker_path=$(cat "$staging_marker" 2>/dev/null || true)
  [[ "$marker_path" == "artifact=$artifact_path" ]] || { echo "staging cleanup: SKIP (ownership mismatch)" >&2; return 0; }
  rm -rf -- "$staging_path"
  rm -f -- "$staging_marker"
  echo "staging cleanup: PASS ($staging_path)"
}

[[ "$mode" == --verify-only || "$mode" == --activate ]] || { echo "invalid mode: $mode" >&2; exit 2; }
[[ "$expected_commit" =~ ^[0-9a-f]{40}$ ]] || { echo "expected commit must be a full SHA" >&2; exit 2; }
[[ -d "$artifact" && "$artifact" = /* ]] || { echo "artifact must be an absolute directory" >&2; exit 2; }

node "$artifact/verify-standalone-artifact.mjs" "$artifact"
actual_commit=$(awk -F= '$1=="commit" {print $2; exit}' "$artifact/.release-meta")
source_commit=$(awk -F= '$1=="artifact_source_commit" {print $2; exit}' "$artifact/.release-meta")
env_model=$(awk -F= '$1=="env_model" {print $2; exit}' "$artifact/.release-meta")
build_config=$(awk -F= '$1=="build_config" {print $2; exit}' "$artifact/.release-meta")
risk_class=$(awk -F= '$1=="risk_class" {print $2; exit}' "$artifact/.release-meta")
risk_test_evidence=$(awk -F= '$1=="risk_test_evidence" {print $2; exit}' "$artifact/.release-meta")
[[ "$actual_commit" == "$expected_commit" && "$source_commit" == "$expected_commit" ]] || { echo "artifact provenance does not match expected commit" >&2; exit 1; }
[[ "$env_model" == runtime-injected ]] || { echo "external artifact must use env_model=runtime-injected" >&2; exit 1; }
[[ "$risk_class" == low || "$risk_class" == high ]] || { echo "artifact risk classification is missing or invalid" >&2; exit 1; }
[[ "$risk_test_evidence" == automated-tests-pass ]] || { echo "${risk_class}-risk artifact lacks required automated test evidence (expected risk_test_evidence=automated-tests-pass)" >&2; exit 1; }
disk_guard_config=${THOIDAI_DISK_GUARD_CONFIG:-$artifact/deploy/disk-guard.conf}
[[ -r "$disk_guard_config" ]] || { echo "artifact disk guard config missing: $disk_guard_config" >&2; exit 1; }

if [[ "$mode" == --verify-only ]]; then
  echo "external-artifact: PASS (verify-only, production unchanged)"
  exit 0
fi

[[ "${THOIDAI_EXTERNAL_DEPLOY_APPROVED:-0}" == 1 ]] || { echo "production activation requires THOIDAI_EXTERNAL_DEPLOY_APPROVED=1" >&2; exit 1; }
[[ "$build_config" == canonical-public ]] || { echo "production activation rejects non-canonical public build config: ${build_config:-missing}" >&2; exit 1; }
if [[ -e "$staging_marker" || -L "$staging_marker" ]]; then
  echo "staging safety: BLOCK (ownership marker already exists)" >&2
  exit 1
fi
( umask 077; set -C; printf 'artifact=%s\n' "$artifact_path" > "$staging_marker" ) || { echo "staging safety: BLOCK (cannot create ownership marker)" >&2; exit 1; }
echo "authenticated smoke: OPTIONAL (not an activation gate)"
for name in .env.local .env.production; do [[ -f "$shared_root/$name" ]] || { echo "runtime environment file missing: $shared_root/$name" >&2; exit 1; }; done

set +e
"$script_dir/deploy-gate.sh" "$artifact"
deploy_status=$?
set -e
if (( deploy_status == 0 )); then cleanup_staging; else rm -f -- "$staging_marker"; fi
exit "$deploy_status"
