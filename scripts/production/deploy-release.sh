#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/release-common.sh"

commit_ref=${1:?usage: $0 <commit-or-ref> [suffix]}
suffix=${2:-release}
acquire_lock
export THOIDAI_LOCK_HELD=1
disk_guard
mkdir -p "$THOIDAI_BUILD_ROOT" "$THOIDAI_RELEASE_ROOT"

commit=$(git -C "$THOIDAI_SOURCE_REPO" rev-parse --verify "$commit_ref^{commit}")
release_id="${commit:0:12}-$(printf '%s' "$suffix" | tr -cs 'A-Za-z0-9._-' '-')-$(date -u +%Y%m%dT%H%M%SZ)"
validate_release_id "$release_id"
build_worktree=$(mktemp -d "$THOIDAI_BUILD_ROOT/worktree.XXXXXX")
staged_release=$(mktemp -d "$THOIDAI_RELEASE_ROOT/.staged.XXXXXX")
snapshot=$(mktemp)
cleanup() {
  git -C "$THOIDAI_SOURCE_REPO" worktree remove --force "$build_worktree" >/dev/null 2>&1 || true
  [[ -z "$staged_release" ]] || rm -rf -- "$staged_release"
  rm -f -- "$snapshot"
}
trap cleanup EXIT

git -C "$THOIDAI_SOURCE_REPO" worktree add --detach "$build_worktree" "$commit" >/dev/null
if [[ -n "${THOIDAI_BUILD_COMMAND:-}" ]]; then (cd "$build_worktree" && bash -c "$THOIDAI_BUILD_COMMAND"); else (cd "$build_worktree" && npm ci --no-audit --no-fund && npm run build); fi

[[ -f "$build_worktree/.next/BUILD_ID" ]] || die "build has no BUILD_ID"
cp -a "$build_worktree/." "$staged_release/"
rm -rf -- "$staged_release/.git" "$staged_release/backups"
printf 'release_id=%s\ncommit=%s\nbranch=%s\ncreated_at=%s\ndeployed_at=\nbuild_id=%s\nsource_worktree=%s\n' \
  "$release_id" "$commit" "$commit_ref" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(cat "$build_worktree/.next/BUILD_ID")" "$build_worktree" > "$staged_release/.release-meta"
mv -Tf -- "$staged_release" "$THOIDAI_RELEASE_ROOT/$release_id"
staged_release=''
validate_release "$THOIDAI_RELEASE_ROOT/$release_id"

snapshot_links > "$snapshot"
old_current=$(awk -F= '$1=="current"{print $2}' "$snapshot")
old_previous=$(awk -F= '$1=="previous"{print $2}' "$snapshot")
atomic_link "$THOIDAI_RELEASE_ROOT/$release_id" "$THOIDAI_RELEASE_ROOT/current"
if [[ "${THOIDAI_ALLOW_RESTART:-0}" != 1 ]]; then restore_links "$snapshot"; die "production restart not authorized in implementation checkpoint"; fi

"$THOIDAI_SYSTEMCTL_BIN" restart "$THOIDAI_SERVICE"
if ! health_check; then
  restore_links "$snapshot"
  "$THOIDAI_SYSTEMCTL_BIN" restart "$THOIDAI_SERVICE" || true
  touch "$THOIDAI_RELEASE_ROOT/$release_id/.keep"
  die "deployment health failed; release retained for forensics"
fi

[[ -z "$old_previous" ]] || atomic_link "$old_previous" "$THOIDAI_RELEASE_ROOT/rollback-2"
[[ -z "$old_current" ]] || atomic_link "$old_current" "$THOIDAI_RELEASE_ROOT/previous"
sed -i "s/^deployed_at=.*/deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)/" "$THOIDAI_RELEASE_ROOT/$release_id/.release-meta"
"$SCRIPT_DIR/release-retention.sh" --apply
