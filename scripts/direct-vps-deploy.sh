#!/usr/bin/env bash
set -Eeuo pipefail

source_root=${1:?usage: direct-vps-deploy.sh <source-root>}
release_root=${THOIDAI_RELEASE_ROOT:-/opt/releases/thoidai-work}
service=${THOIDAI_SERVICE:-thoidai-work.service}
health_url=${THOIDAI_HEALTH_URL:-http://127.0.0.1:3001/login}
base_commit=${THOIDAI_DIRECT_VPS_BASE_COMMIT:-}
hard_min_free_kb=${THOIDAI_HARD_MIN_FREE_KB:-20971520}
headroom_kb=${THOIDAI_ESTIMATED_HEADROOM_KB:-1048576}
lock_file=${THOIDAI_DEPLOY_LOCK:-/run/lock/thoidai-work-deploy.lock}

[[ "${THOIDAI_DIRECT_VPS_APPROVED:-0}" == 1 ]] || { echo "direct VPS deployment requires THOIDAI_DIRECT_VPS_APPROVED=1" >&2; exit 1; }
[[ -d "$source_root/.git" || -f "$source_root/.git" ]] || { echo "source must be an independent Git workspace" >&2; exit 1; }
[[ "$source_root" != "/opt/thoidai-work"* ]] || { echo "active checkout is not an allowed build workspace" >&2; exit 1; }
[[ "$base_commit" =~ ^[0-9a-f]{40}$ ]] || { echo "direct VPS base commit is required" >&2; exit 1; }
[[ "$hard_min_free_kb" =~ ^[0-9]+$ && "$headroom_kb" =~ ^[0-9]+$ ]] || { echo "invalid disk guard" >&2; exit 1; }

cd "$source_root"
branch=$(git branch --show-current)
candidate=$(git rev-parse HEAD)
[[ "$branch" =~ ^codex/direct-vps-[A-Za-z0-9._-]+$ ]] || { echo "invalid direct VPS branch: $branch" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "source workspace must be clean" >&2; exit 1; }
git merge-base --is-ancestor "$base_commit" "$candidate" || { echo "candidate does not descend from production base" >&2; exit 1; }
if ! git rev-parse --verify integration/production >/dev/null 2>&1; then
  git fetch --no-tags origin integration/production:refs/remotes/origin/integration/production
  git branch integration/production refs/remotes/origin/integration/production
fi

allowed=(
  AGENTS.md DEPLOY_CHECKLIST.md
  scripts/check-release-baseline.mjs scripts/release-lineage.mjs scripts/release-lineage.test.mjs
  scripts/direct-vps-deploy.sh
  src/lib/taskRepository.ts
)
for file in $(git diff --name-only "$base_commit" "$candidate"); do
  ok=0
  for item in "${allowed[@]}"; do [[ "$file" == "$item" ]] && ok=1; done
  (( ok == 1 )) || { echo "direct VPS change outside allowlist: $file" >&2; exit 1; }
done

free_kb=$(df -Pk "$release_root" | awk 'NR==2 {print $4}')
(( free_kb >= hard_min_free_kb && free_kb - headroom_kb >= hard_min_free_kb )) || {
  echo "DEPLOY ABORTED"; echo "Free space: ${free_kb}KB"; echo "Required minimum: ${hard_min_free_kb}KB"; echo "Estimated headroom: ${headroom_kb}KB"; exit 1;
}

exec 9>"$lock_file"
flock -n 9 || { echo "DEPLOY ABORTED: deploy lock unavailable" >&2; exit 1; }

set -a
[[ -f /opt/thoidai-work/.env.production ]] && . /opt/thoidai-work/.env.production
set +a
export THOIDAI_DIRECT_VPS_APPROVED=1
export THOIDAI_DIRECT_VPS_BASE_COMMIT="$base_commit"
export THOIDAI_CURRENT_PRODUCTION_COMMIT="$base_commit"
export THOIDAI_RELEASE_BRANCH="$branch"
export THOIDAI_DIRECT_VPS_ALLOWED_FILES="$(IFS=,; echo "${allowed[*]}")"

npm ci --no-audit --no-fund
node --test src/lib/quickReportContract.test.mjs src/lib/quickReportHandler.test.mjs src/lib/quickReportServerContract.test.mjs src/lib/quickReportUiContract.test.mjs scripts/release-lineage.test.mjs
npm run build

build_id=$(tr -d '\r\n' < .next/BUILD_ID)
artifact_dir="/opt/build/direct-vps-artifacts/${build_id}-${candidate:0:12}"
[[ ! -e "$artifact_dir" ]] || { echo "artifact already exists: $artifact_dir" >&2; exit 1; }
export THOIDAI_BUILD_CONFIG=canonical-public
export THOIDAI_RUNTIME_ENV_MODEL=runtime-injected
STANDALONE_ARTIFACT_DIR="$artifact_dir" npm run package:standalone
node scripts/verify-standalone-artifact.mjs "$artifact_dir"
node scripts/verify-artifact-manifest.mjs "$artifact_dir"
node scripts/scan-artifact-secrets.mjs "$artifact_dir"

release_id="${build_id}-${candidate:0:12}-direct"
new_release="$release_root/$release_id"
[[ ! -e "$new_release" && ! -L "$new_release" ]] || { echo "release already exists: $new_release" >&2; exit 1; }
cp -a -- "$artifact_dir" "$new_release"
chown -R root:thoidai-work "$new_release"
chmod 0750 "$new_release"
install -d -o thoidai-work -g thoidai-work -m 0750 "$new_release/.next/cache"

read_pointer() { local name=$1 target; [[ -L "$release_root/$name" ]] || return 1; target=$(readlink -f -- "$release_root/$name"); [[ "$target" == "$release_root"/* && -d "$target" ]] || return 1; printf '%s' "$target"; }
current_target=$(read_pointer current); previous_target=$(read_pointer previous); rollback1_target=$(read_pointer rollback-1); rollback2_target=$(read_pointer rollback-2)
atomic_pointer() { local target=$1 name=$2 tmp="$release_root/$name.new"; rm -f -- "$tmp"; ln -s -- "$target" "$tmp"; mv -Tf -- "$tmp" "$release_root/$name"; }
restore() {
  set +e
  atomic_pointer "$current_target" current
  atomic_pointer "$previous_target" previous
  atomic_pointer "$rollback1_target" rollback-1
  atomic_pointer "$rollback2_target" rollback-2
  systemctl restart "$service"
  systemctl is-active --quiet "$service"
  curl -fsS --max-time 15 -o /dev/null "$health_url"
  set -e
}

atomic_pointer "$rollback1_target" rollback-2
atomic_pointer "$current_target" rollback-1
atomic_pointer "$current_target" previous
atomic_pointer "$new_release" current
if ! systemctl restart "$service" || ! systemctl is-active --quiet "$service" || ! curl -fsS --max-time 15 -o /dev/null "$health_url"; then
  echo "health failed; restoring previous release" >&2
  restore
  exit 1
fi

echo "direct-vps-deploy: PASS"
echo "commit=$candidate"
echo "release=$new_release"
echo "health_url=$health_url"
