#!/usr/bin/env bash
set -Eeuo pipefail

mode=${1:---verify-only}
[[ "$mode" == --verify-only || "$mode" == --activate ]] || { echo "usage: $0 [--verify-only|--activate]" >&2; exit 2; }

repo_root=$(git rev-parse --show-toplevel)
remote_name=${THOIDAI_GIT_REMOTE:-origin}
canonical_branch=${THOIDAI_INTEGRATION_BRANCH:-integration/production}
target_commit=${THOIDAI_TARGET_COMMIT:-}
target_host=${THOIDAI_TARGET_HOST:-10.66.0.1}
target_port=${THOIDAI_TARGET_PORT:-24700}
target_user=${THOIDAI_TARGET_USER:-root}
release_root=${THOIDAI_RELEASE_ROOT:-/opt/releases/thoidai-work}
shared_root=${THOIDAI_SHARED_ROOT:-/opt/thoidai-work}
hard_min_free_kb=${THOIDAI_HARD_MIN_FREE_KB:-20971520}
worktree=$(mktemp -d "${TMPDIR:-/tmp}/thoidai-local-build.XXXXXX")
artifact="$worktree/artifact"
archive="$worktree/artifact.tar"
remote_dir=""

cleanup() {
  git -C "$repo_root" worktree remove --force "$worktree/source" >/dev/null 2>&1 || true
  rm -rf -- "$worktree"
}
trap cleanup EXIT

git -C "$repo_root" fetch "$remote_name" "$canonical_branch"
canonical_ref="refs/remotes/$remote_name/$canonical_branch"
canonical_commit=$(git -C "$repo_root" rev-parse "$canonical_ref")
if [[ -n "$target_commit" && "$target_commit" != "$canonical_commit" ]]; then
  echo "target commit does not match canonical branch: target=$target_commit canonical=$canonical_commit" >&2
  exit 1
fi
target_commit=${target_commit:-$canonical_commit}
git -C "$repo_root" worktree add --detach "$worktree/source" "$target_commit"

cd "$worktree/source"
export THOIDAI_RELEASE_BRANCH="$canonical_branch"
export THOIDAI_INTEGRATION_COMMIT="$target_commit"
export THOIDAI_REMOTE_HEAD="$target_commit"
export THOIDAI_RUNTIME_ENV_MODEL=runtime-injected
export THOIDAI_BUILD_CONFIG=canonical-public

remote_state=$(ssh -p "$target_port" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes "$target_user@$target_host" \
  "set -e; test -f '$release_root/current/.release-meta'; awk -F= '\$1==\"commit\"{print \"current_production_commit=\"\$2} \$1==\"env_model\"{print \"active_env_model=\"\$2}' '$release_root/current/.release-meta'; df -Pk '$release_root' | awk 'NR==2{print \"release_root_free_kb=\"\$4}'")
current_production_commit=$(printf '%s\n' "$remote_state" | sed -n 's/^current_production_commit=//p')
release_root_free_kb=$(printf '%s\n' "$remote_state" | sed -n 's/^release_root_free_kb=//p')
[[ "$current_production_commit" =~ ^[0-9a-f]{40}$ ]] || { echo "active production commit metadata missing" >&2; exit 1; }
[[ "$release_root_free_kb" =~ ^[0-9]+$ && "$release_root_free_kb" -ge "$hard_min_free_kb" ]] || { echo "VPS disk gate failed: free_kb=$release_root_free_kb required=$hard_min_free_kb" >&2; exit 1; }
export THOIDAI_CURRENT_PRODUCTION_COMMIT=${THOIDAI_CURRENT_PRODUCTION_COMMIT:-$current_production_commit}

[[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" && -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]] || {
  echo "canonical-public build requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the local environment" >&2
  exit 1
}
[[ ! -e .env.local && ! -e .env.production ]] || {
  echo "refusing to build from a worktree containing runtime environment files" >&2
  exit 1
}

npm ci --no-audit --no-fund
npm run check:release
npx tsc --noEmit
npx eslint scripts/package-standalone.mjs scripts/artifact-manifest.mjs scripts/materialize-artifact-symlinks.mjs scripts/verify-artifact-manifest.mjs scripts/verify-standalone-artifact.mjs scripts/scan-artifact-secrets.mjs
npm run build
STANDALONE_ARTIFACT_DIR="$artifact" npm run package:standalone
node scripts/materialize-artifact-symlinks.mjs "$artifact"
rm -f "$artifact/.artifact-manifest.json" "$artifact/.artifact-manifest.sha256"
node scripts/artifact-manifest.mjs "$artifact"
node scripts/verify-standalone-artifact.mjs "$artifact"
node scripts/verify-artifact-manifest.mjs "$artifact"
node scripts/scan-artifact-secrets.mjs "$artifact"

tar -cf "$archive" -C "$artifact" .
local_archive_sha=$(sha256sum "$archive" | awk '{print $1}')
remote_stamp=$(date -u +%Y%m%dT%H%M%SZ)
remote_dir="$release_root/.staging/quick-report-$target_commit-$remote_stamp"
ssh -p "$target_port" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes "$target_user@$target_host" \
  "test ! -e '$remote_dir' && mkdir -m 0750 '$remote_dir'"
scp -P "$target_port" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes "$archive" \
  "$target_user@$target_host:$remote_dir/artifact.tar"
ssh -p "$target_port" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes "$target_user@$target_host" \
  "set -Eeuo pipefail; d='$remote_dir'; test \"\$(sha256sum \"\$d/artifact.tar\" | awk '{print \$1}')\" = '$local_archive_sha'; tar -xf \"\$d/artifact.tar\" -C \"\$d\"; rm -f \"\$d/artifact.tar\"; node \"\$d/verify-standalone-artifact.mjs\" \"\$d\"; node \"\$d/verify-artifact-manifest.mjs\" \"\$d\"; echo LOCAL_DEPLOY_VERIFY_PASS"

if [[ "$mode" == --activate ]]; then
  [[ "${THOIDAI_EXTERNAL_DEPLOY_APPROVED:-0}" == 1 ]] || { echo "activation requires THOIDAI_EXTERNAL_DEPLOY_APPROVED=1" >&2; exit 1; }
  ssh -tt -p "$target_port" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes "$target_user@$target_host" \
    "bash --noprofile --norc -s" <<EOF
set -Eeuo pipefail
artifact="$remote_dir"
printf 'Credential type [cookie/bearer]: ' >/dev/tty
IFS= read -r credential_type </dev/tty
case "\$credential_type" in
  cookie) printf 'Complete Cookie header (hidden): ' >/dev/tty; IFS= read -r -s THOIDAI_SMOKE_COOKIE </dev/tty; printf '\\n' >/dev/tty; export THOIDAI_SMOKE_COOKIE ;;
  bearer) printf 'Bearer token only (hidden): ' >/dev/tty; IFS= read -r -s THOIDAI_SMOKE_BEARER </dev/tty; printf '\\n' >/dev/tty; export THOIDAI_SMOKE_BEARER ;;
  *) echo 'choose cookie or bearer' >&2; exit 2 ;;
esac
THOIDAI_EXTERNAL_DEPLOY_APPROVED=1 THOIDAI_SHARED_ROOT="$shared_root" THOIDAI_RELEASE_ROOT="$release_root" \
  "$shared_root/scripts/production/deploy-external-artifact.sh" "\$artifact" "$target_commit" --activate
EOF
fi
echo "local-deploy: PASS (mode=$mode commit=$target_commit remote=$target_user@$target_host:$target_port staging=$remote_dir)"
