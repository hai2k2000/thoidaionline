#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat >&2 <<'EOF'
usage:
  deploy-vps-first.sh dry-run <source-root>
  deploy-vps-first.sh build <source-root> <staging-artifact>
  deploy-vps-first.sh verify-only <staging-artifact>
  deploy-vps-first.sh activate <staging-artifact> <approved-release-id>
EOF
  exit 2
}

mode=${1:-}
case "$mode" in dry-run|build|verify-only|activate) ;; *) usage ;; esac
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd "$script_dir/../.." && pwd)
release_root=${THOIDAI_RELEASE_ROOT:-/opt/releases/thoidai-work}
source_root=${2:-}
export THOIDAI_DISK_GUARD_CONFIG=${THOIDAI_DISK_GUARD_CONFIG:-/opt/thoidai-work/deploy/disk-guard.conf}

resolve_path() { readlink -f -- "$1" 2>/dev/null || realpath -m -- "$1"; }
require_absolute_dir() {
  [[ "$1" = /* && -d "$1" && ! -L "$1" ]] || { echo "VPS-FIRST=BLOCKED reason=invalid-directory path=$1" >&2; exit 1; }
}
assert_staging_safety() {
  local artifact_path release_path pointer pointer_path
  require_absolute_dir "$1"
  artifact_path=$(resolve_path "$1")
  release_path=$(resolve_path "$release_root")
  [[ "$artifact_path" != "$release_path" && "$artifact_path" != "$release_path"/* ]] || { echo "VPS-FIRST=BLOCKED reason=staging-inside-release-root" >&2; exit 1; }
  for pointer in current previous rollback-1 rollback-2; do
    if [[ -L "$release_root/$pointer" ]]; then
      pointer_path=$(resolve_path "$release_root/$pointer")
      [[ "$artifact_path" != "$pointer_path" ]] || { echo "VPS-FIRST=BLOCKED reason=protected-pointer-$pointer" >&2; exit 1; }
    fi
  done
}

verify_artifact() {
  local artifact=$1
  assert_staging_safety "$artifact"
  THOIDAI_DEPLOYMENT_PROFILE=thoidai-work-vps-first node "$artifact/verify-standalone-artifact.mjs" "$artifact"
  grep -Fxq 'deployment_profile=thoidai-work-vps-first' "$artifact/.release-meta" || { echo "VPS-FIRST=BLOCKED reason=profile-metadata-mismatch" >&2; exit 1; }
  # Source the canonical guard, then evaluate the real target filesystem.
  source "$repo_root/scripts/production/disk-guard.sh"
  local free_kb
  free_kb=$(df -Pk "$release_root" | awk 'NR==2 {print $4}')
  disk_guard_require "$free_kb" "$THOIDAI_DISK_DEFAULT_HEADROOM_KB" "verify"
  node "$repo_root/scripts/scan-artifact-secrets.mjs" "$artifact"
  echo "VPS-FIRST=PASS mode=verify-only artifact=$(resolve_path "$artifact") production=unchanged"
}

case "$mode" in
  dry-run)
    require_absolute_dir "$source_root"
    source_path=$(resolve_path "$source_root")
    current_path=$(resolve_path "$release_root/current")
    [[ "$source_path" != "$current_path" ]] || { echo "VPS-FIRST=BLOCKED reason=source-is-active-release" >&2; exit 1; }
    source "$repo_root/scripts/production/disk-guard.sh"
    free_kb=$(df -Pk "$release_root" | awk 'NR==2 {print $4}')
    disk_guard_require "$free_kb" "$THOIDAI_DISK_DEFAULT_HEADROOM_KB" "dry-run"
    for pointer in current previous rollback-1 rollback-2; do
      [[ -L "$release_root/$pointer" ]] || { echo "VPS-FIRST=BLOCKED reason=missing-pointer-$pointer" >&2; exit 1; }
    done
    if [[ -r "$source_root/.git/config" ]]; then
      branch=$(git -C "$source_root" branch --show-current 2>/dev/null || true)
      commit=$(git -C "$source_root" rev-parse HEAD 2>/dev/null || true)
      [[ "$commit" =~ ^[0-9a-f]{40}$ ]] || { echo "VPS-FIRST=BLOCKED reason=source-commit-missing" >&2; exit 1; }
      echo "VPS-FIRST=PASS mode=dry-run source=$source_path branch=${branch:-detached} commit=$commit production=unchanged"
    else
      echo "VPS-FIRST=PASS mode=dry-run source=$source_path production=unchanged"
    fi
    ;;
  build)
    artifact=${3:-}
    require_absolute_dir "$source_root"
    [[ -n "$artifact" && "$artifact" = /* && ! -e "$artifact" && ! -L "$artifact" ]] || { echo "VPS-FIRST=BLOCKED reason=invalid-new-artifact-path" >&2; exit 1; }
    source_path=$(resolve_path "$source_root")
    current_path=$(resolve_path "$release_root/current")
    [[ "$source_path" != "$current_path" ]] || { echo "VPS-FIRST=BLOCKED reason=source-is-active-release" >&2; exit 1; }
    current_commit=$(awk -F= '$1=="commit" {print $2; exit}' "$current_path/.release-meta" 2>/dev/null || true)
    [[ "$current_commit" =~ ^[0-9a-f]{40}$ ]] || { echo "VPS-FIRST=BLOCKED reason=current-production-commit-missing" >&2; exit 1; }
    export THOIDAI_DEPLOYMENT_PROFILE=thoidai-work-vps-first
    export THOIDAI_BUILD_CONFIG=${THOIDAI_BUILD_CONFIG:-canonical-public}
    export THOIDAI_RUNTIME_ENV_MODEL=${THOIDAI_RUNTIME_ENV_MODEL:-symlink:/opt/thoidai-work/.env.local,/opt/thoidai-work/.env.production}
    export THOIDAI_CURRENT_PRODUCTION_COMMIT=${THOIDAI_CURRENT_PRODUCTION_COMMIT:-$current_commit}
    export THOIDAI_INTEGRATION_BRANCH=${THOIDAI_INTEGRATION_BRANCH:-vps-local}
    export THOIDAI_INTEGRATION_COMMIT=${THOIDAI_INTEGRATION_COMMIT:-$current_commit}
    export THOIDAI_REMOTE_HEAD=${THOIDAI_REMOTE_HEAD:-$(git -C "$source_root" rev-parse HEAD)}
    bash "$repo_root/scripts/production/build-standalone-release.sh" "$source_root" "$artifact"
    verify_artifact "$artifact"
    ;;
  verify-only)
    verify_artifact "$source_root"
    ;;
  activate)
    approved_release=${3:-}
    [[ "${THOIDAI_VPS_DEPLOY_APPROVED:-0}" == 1 ]] || { echo "VPS-FIRST=BLOCKED reason=owner-approval-required" >&2; exit 1; }
    [[ -n "$approved_release" && "$(basename "$source_root")" == "$approved_release" ]] || { echo "VPS-FIRST=BLOCKED reason=approved-release-mismatch" >&2; exit 1; }
    verify_artifact "$source_root"
    THOIDAI_EXTERNAL_DEPLOY_APPROVED=1 THOIDAI_NEW_RELEASE_PATH="$release_root/$approved_release" bash "$repo_root/scripts/production/deploy-gate.sh" "$source_root"
    ;;
esac
