#!/usr/bin/env bash
set -Eeuo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
script="$root/scripts/production/deploy-vps-first.sh"
[[ -f "$script" ]] || { echo "contract: deploy-vps-first.sh missing" >&2; exit 1; }
grep -q 'THOIDAI_DEPLOYMENT_PROFILE=thoidai-work-vps-first' "$script"
grep -q 'mode=dry-run' "$script"
grep -q 'owner-approval-required' "$script"
grep -q 'source-is-active-release' "$script"
grep -q 'staging-inside-release-root' "$script"
grep -q 'deploy-gate.sh' "$script"
grep -q 'scan-artifact-secrets.mjs' "$script"
grep -q 'risk_test_evidence=automated-tests-pass' "$root/scripts/production/deploy-external-artifact.sh" || grep -q 'risk artifact lacks required automated test evidence' "$root/scripts/production/deploy-external-artifact.sh"
grep -q 'risk_test_evidence=automated-tests-pass' "$root/scripts/production/deploy-gate.sh"
grep -q 'THOIDAI_DISK_GUARD_CONFIG' "$root/scripts/production/disk-guard.sh"
grep -q '"deploy:vps-first"' "$root/package.json"
echo "vps-first-contract: PASS"
