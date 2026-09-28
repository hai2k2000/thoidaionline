#!/usr/bin/env bash
set -Eeuo pipefail
: "${THOIDAI_WORKTREE_ROOT:=/opt/worktrees}"
: "${THOIDAI_BUILD_ROOT:=/opt/build/thoidai-work}"
: "${THOIDAI_RELEASE_ROOT:=/opt/releases/thoidai-work}"
: "${THOIDAI_DF_BIN:=df}"
: "${THOIDAI_WORKTREE_MAX_TOTAL_BYTES:=21474836480}"
: "${THOIDAI_BUILD_MAX_TOTAL_BYTES:=8589934592}"
: "${THOIDAI_RELEASE_MAX_TOTAL_BYTES:=8589934592}"
: "${THOIDAI_MIN_FREE_DISK_BYTES:=10737418240}"
: "${THOIDAI_MAX_ACTIVE_WORKTREES:=32}"
kind=${1:?usage: $0 <worktree|build|release> <new-path>}; target=${2:-}
case "$kind" in worktree) root=$THOIDAI_WORKTREE_ROOT; budget=$THOIDAI_WORKTREE_MAX_TOTAL_BYTES;; build) root=$THOIDAI_BUILD_ROOT; budget=$THOIDAI_BUILD_MAX_TOTAL_BYTES;; release) root=$THOIDAI_RELEASE_ROOT; budget=$THOIDAI_RELEASE_MAX_TOTAL_BYTES;; *) echo invalid-kind >&2; exit 2;; esac
free_kib=$($THOIDAI_DF_BIN -Pk / | awk 'NR==2 {print $4}')
[[ "$free_kib" =~ ^[0-9]+$ ]] || { echo 'ERROR: free disk ambiguous' >&2; exit 1; }
free_bytes=$((free_kib*1024)); (( free_bytes >= THOIDAI_MIN_FREE_DISK_BYTES )) || { echo "ERROR: free disk budget exceeded free=$free_bytes minimum=$THOIDAI_MIN_FREE_DISK_BYTES" >&2; exit 1; }
used=$(du -sx --bytes -- "$root" 2>/dev/null | awk 'NR==1{print $1}') || { echo 'ERROR: category size unavailable' >&2; exit 1; }
[[ "$used" =~ ^[0-9]+$ ]] || { echo 'ERROR: category size ambiguous' >&2; exit 1; }
[[ "$target" != "$root"/* || ! -e "$target" ]] || { echo 'ERROR: target already exists' >&2; exit 1; }
(( used < budget )) || { echo "ERROR: $kind budget exceeded used=$used budget=$budget" >&2; exit 1; }
if [[ "$kind" == worktree ]]; then count=$(find "$root" -mindepth 1 -maxdepth 1 -type d | wc -l); (( count < THOIDAI_MAX_ACTIVE_WORKTREES )) || { echo 'ERROR: active worktree budget exceeded' >&2; exit 1; }; fi
printf 'BUDGET_OK\tkind=%s\tused=%s\tbudget=%s\tfree_bytes=%s\n' "$kind" "$used" "$budget" "$free_bytes"