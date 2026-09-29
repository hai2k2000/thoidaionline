#!/usr/bin/env bash
set -Eeuo pipefail
: "${THOIDAI_MANAGED_SOURCE_EXCEPTION:=}"
path=${1:?usage: $0 <worktree>}; real=$(realpath -m -- "$path")
case "$THOIDAI_MANAGED_SOURCE_EXCEPTION" in immutable-build|production-checkout) printf 'MANAGED_SOURCE_OK\texception=%s\tpath=%s\n' "$THOIDAI_MANAGED_SOURCE_EXCEPTION" "$real"; exit 0;; esac
meta=$(git -C "$real" rev-parse --git-path thoidai-lifecycle 2>/dev/null | xargs realpath -m 2>/dev/null) || { echo "ERROR: not a git worktree: $real" >&2; exit 1; }
expected=$(git -C "$real" rev-parse --git-path thoidai-lifecycle 2>/dev/null | xargs realpath -m 2>/dev/null); [[ "$meta" == "$expected" ]] || { echo 'ERROR: invalid lifecycle metadata path' >&2; exit 1; }
[[ -f "$meta" ]] || { echo "ERROR: unmanaged worktree blocked: $real" >&2; exit 1; }
for key in schema_version path branch commit created_at purpose lifecycle_state; do grep -q "^${key}=" "$meta" || { echo "ERROR: lifecycle metadata missing $key" >&2; exit 1; }; done
schema=$(awk -F= '$1=="schema_version"{print $2}' "$meta"); [[ "$schema" == 1 ]] || { echo 'ERROR: unsupported lifecycle schema' >&2; exit 1; }
created_at=$(awk -F= '$1=="created_at"{print substr($0,index($0,"=")+1)}' "$meta"); [[ "$created_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] && date -u -d "$created_at" >/dev/null 2>&1 || { echo 'ERROR: invalid created_at' >&2; exit 1; }
last_used_at=$(awk -F= '$1=="last_used_at"{print substr($0,index($0,"=")+1)}' "$meta"); [[ -z "$last_used_at" || "$last_used_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || { echo 'ERROR: invalid last_used_at' >&2; exit 1; }
meta_path=$(awk -F= '$1=="path"{print substr($0,index($0,"=")+1)}' "$meta"); [[ "$(realpath -m "$meta_path")" == "$real" ]] || { echo 'ERROR: lifecycle path mismatch' >&2; exit 1; }
branch=$(awk -F= '$1=="branch"{print substr($0,index($0,"=")+1)}' "$meta"); commit=$(awk -F= '$1=="commit"{print substr($0,index($0,"=")+1)}' "$meta"); state=$(awk -F= '$1=="lifecycle_state"{print $2}' "$meta")
git -C "$real" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo 'ERROR: not a git worktree' >&2; exit 1; }
[[ "$(git -C "$real" rev-parse HEAD)" == "$commit" ]] || { echo 'ERROR: lifecycle commit mismatch' >&2; exit 1; }
[[ "$(git -C "$real" symbolic-ref --short -q HEAD || echo detached)" == "$branch" ]] || { echo 'ERROR: lifecycle branch mismatch' >&2; exit 1; }
case "$state" in ACTIVE|IDLE|READY_FOR_CLEANUP|PROTECTED) ;; *) echo 'ERROR: invalid lifecycle state' >&2; exit 1;; esac
printf 'MANAGED_SOURCE_OK\tpath=%s\tstate=%s\tbranch=%s\tcommit=%s\n' "$real" "$state" "$branch" "$commit"
