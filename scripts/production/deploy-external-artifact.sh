#!/usr/bin/env bash
set -Eeuo pipefail

artifact=${1:?usage: $0 <artifact-dir> <expected-commit> [--verify-only|--activate]}
expected_commit=${2:?usage: $0 <artifact-dir> <expected-commit> [--verify-only|--activate]}
mode=${3:---verify-only}
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
shared_root=${THOIDAI_SHARED_ROOT:-/opt/thoidai-work}

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
[[ "$risk_class" != low || "$risk_test_evidence" == automated-tests-pass ]] || { echo "low-risk artifact lacks automated test evidence" >&2; exit 1; }

if [[ "$mode" == --verify-only ]]; then
  echo "external-artifact: PASS (verify-only, production unchanged)"
  exit 0
fi

[[ "${THOIDAI_EXTERNAL_DEPLOY_APPROVED:-0}" == 1 ]] || { echo "production activation requires THOIDAI_EXTERNAL_DEPLOY_APPROVED=1" >&2; exit 1; }
[[ "$build_config" == canonical-public ]] || { echo "production activation rejects non-canonical public build config: ${build_config:-missing}" >&2; exit 1; }
echo "authenticated smoke: OPTIONAL (not an activation gate)"
for name in .env.local .env.production; do [[ -f "$shared_root/$name" ]] || { echo "runtime environment file missing: $shared_root/$name" >&2; exit 1; }; done

exec "$script_dir/deploy-gate.sh" "$artifact"
