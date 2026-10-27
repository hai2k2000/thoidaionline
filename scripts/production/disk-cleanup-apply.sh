#!/usr/bin/env bash
set -u -o pipefail
export GIT_OPTIONAL_LOCKS=0

RELEASE_ROOT=${RELEASE_ROOT:-/opt/releases/thoidai-work}
WORKTREE_ROOT=${WORKTREE_ROOT:-/opt/worktrees}
BUILD_ROOT=${BUILD_ROOT:-/opt/build}
EXTRA_BUILD_PATHS=${EXTRA_BUILD_PATHS:-'/opt/artifacts /opt/staging'}
EVIDENCE_ROOT=${EVIDENCE_ROOT:-/opt/ops/thoidai-work/cleanup-evidence}
CONFIG_GREP_PATHS=${CONFIG_GREP_PATHS:-'/etc/nginx /etc/systemd/system /etc/cron* /var/spool/cron'}
PROC_ROOT=${PROC_ROOT:-/proc}
ALLOWLIST=${ALLOWLIST:-}
MODE=VERIFY
[[ ${1:-} == --apply ]] && MODE=APPLY

declare -i WOULD=0 DELETED=0 SKIPPED=0 FAILED=0 BYTES_FREED=0
EVIDENCE_DIR=
ALLOWLIST_FILE=

human_size() { awk -v n="${1:-0}" 'BEGIN { u[1]="B";u[2]="KB";u[3]="MB";u[4]="GB";u[5]="TB"; i=1; while (n >= 1024 && i < 5) { n/=1024; i++ } printf "%.1f%s", n, u[i] }'; }
size_of() { local n; n=$(du -sb -- "$1" 2>/dev/null | awk 'NR==1 {print $1}') || n=0; [[ $n =~ ^[0-9]+$ ]] && printf '%s\n' "$n" || printf '0\n'; }
resolve() { readlink -f -- "$1" 2>/dev/null; }
is_forbidden() { case "$1" in /opt/ops|/opt/ops/*|*supabase*|*backups/managed*|*/ops-backups|*/ops-backups/*|*/build-evidence|*/build-evidence/*) return 0;; esac; return 1; }
protected_process() { local p=$1 x t; t=$(resolve "$p") || return 1; for x in "$PROC_ROOT"/[0-9]*/cwd "$PROC_ROOT"/[0-9]*/exe; do [[ -e $x ]] || continue; p=$(resolve "$x") || continue; [[ $p == "$t" || $p == "$t"/* ]] && return 0; done; return 1; }
protected_release_target() {
  local p=$1 link t parent; p=$(resolve "$p") || return 1; parent=$(dirname "$RELEASE_ROOT")
  for link in "$RELEASE_ROOT/current" "$RELEASE_ROOT/previous" "$RELEASE_ROOT"/rollback-* "$parent/current" "$parent/previous" "$parent"/rollback-*; do
    [[ -L $link ]] || continue; t=$(resolve "$link") || continue; [[ $p == "$t" || $p == "$t"/* ]] && return 0
  done
  return 1
}
config_referenced() {
  local p=$1 root; for root in $CONFIG_GREP_PATHS; do [[ -e $root || -d $root ]] || continue; grep -rlF -- "$p" $root 2>/dev/null | grep -q . && return 0; done; return 1;
}
allowed_path() {
  local group=$1 p=$2 root extra
  case "$group" in
    release) root=$RELEASE_ROOT; [[ "$p" == "$root"/* && "$p" != "$root"/*/* ]] && return 0;;
    worktree) root=$WORKTREE_ROOT; [[ "$p" == "$root"/* && "$p" != "$root"/*/* ]] && return 0;;
    build)
      root=$BUILD_ROOT; [[ "$p" == "$root"/* && "$p" != "$root"/*/* ]] && return 0
      for extra in $EXTRA_BUILD_PATHS; do [[ "$p" == "$extra" ]] && return 0; done;;
  esac
  return 1
}
check_path() {
  local group=$1 p=$2 real
  [[ $p == /* ]] || { printf '%s\n' path-not-absolute; return 1; }
  [[ $p != */../* && $p != */.. && $p != *'/.' ]] || { printf '%s\n' path-contains-parent; return 1; }
  [[ $p != *[*?[] ]] || { printf '%s\n' trailing-glob; return 1; }
  [[ -e $p || -L $p ]] || { printf '%s\n' missing; return 1; }
  [[ ! -L $p ]] || { printf '%s\n' symlink-path; return 1; }
  real=$(resolve "$p") || { printf '%s\n' unresolved; return 1; }
  [[ $real == "$p" ]] || { printf '%s\n' resolves-differently; return 1; }
  allowed_path "$group" "$p" || { printf '%s\n' path-outside-root; return 1; }
  is_forbidden "$p" && { printf '%s\n' never-list; return 1; }
  [[ $(basename -- "$p") != .keep && ! -e "$p/.keep" ]] || { printf '%s\n' .keep; return 1; }
  if [[ $group == release ]] && protected_release_target "$p"; then printf '%s\n' current-symlink-target; return 1; fi
  protected_process "$p" && { printf '%s\n' running-process; return 1; }
  config_referenced "$p" && { printf '%s\n' config-referenced; return 1; }
  if [[ $group == worktree ]]; then
    local status upstream ahead
    git -c safe.directory='*' -C "$p" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { printf '%s\n' not-a-worktree; return 1; }
    status=$(git -c safe.directory='*' -C "$p" status --porcelain 2>/dev/null || printf '?')
    [[ -z $status ]] || { printf '%s\n' dirty; return 1; }
    upstream=$(git -c safe.directory='*' -C "$p" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)
    [[ -n $upstream ]] || { printf '%s\n' no-upstream; return 1; }
    ahead=$(git -c safe.directory='*' -C "$p" rev-list --count "$upstream..HEAD" 2>/dev/null || printf '?')
    [[ $ahead == 0 ]] || { printf 'ahead=%s\n' "$ahead"; return 1; }
  fi
  return 0
}
load_allowlist() {
  if [[ -n ${ALLOWLIST_B64:-} ]]; then printf '%s' "$ALLOWLIST_B64" | base64 -d; return; fi
  if [[ -n $ALLOWLIST ]]; then cat -- "$ALLOWLIST"; return; fi
  # ALLOWLIST-EMBED
  return 1
}
evidence_before() {
  [[ $MODE == APPLY ]] || return 0
  local ts item group p bytes safe
  ts=$(date -u +%Y%m%dT%H%M%SZ); EVIDENCE_DIR="$EVIDENCE_ROOT/disk-2026-10-27-$ts"; mkdir -p -- "$EVIDENCE_DIR" || return 1
  df -h / > "$EVIDENCE_DIR/df-before.txt" || return 1
  while IFS=$'\t' read -r group p; do
    [[ -n $group && -n $p ]] || continue; safe=${p#/}; safe=${safe//\//_}; bytes=$(size_of "$p"); printf '%s\t%s\t%s\n' "$group" "$p" "$bytes" > "$EVIDENCE_DIR/${safe}.du"; ls -la -- "$p" > "$EVIDENCE_DIR/${safe}.ls" 2>&1 || true
    if [[ $group == worktree ]]; then git -c safe.directory='*' -C "$p" rev-parse HEAD > "$EVIDENCE_DIR/${safe}.head" 2>&1 || true; git -c safe.directory='*' -C "$p" branch --show-current > "$EVIDENCE_DIR/${safe}.branch" 2>&1 || true; git -c safe.directory='*' -C "$p" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' > "$EVIDENCE_DIR/${safe}.upstream" 2>&1 || true; elif [[ $group == release && -f $p/.release-meta ]]; then cp -p -- "$p/.release-meta" "$EVIDENCE_DIR/${safe}.release-meta"; fi
  done < "$ALLOWLIST_FILE"
}
main() {
  local group p reason bytes before
  [[ $MODE != APPLY || ${THOIDAI_DISK_CLEANUP_APPROVED:-} == APPROVE-DISK-CLEANUP-2026-10-27 ]] && true
  if [[ $MODE == APPLY && ${THOIDAI_DISK_CLEANUP_APPROVED:-} != APPROVE-DISK-CLEANUP-2026-10-27 ]]; then MODE=VERIFY; fi
  ALLOWLIST_FILE=$(mktemp) || { echo 'FAILED allowlist-temp' >&2; return 1; }
  trap 'rm -f -- "$ALLOWLIST_FILE"' EXIT
  load_allowlist > "$ALLOWLIST_FILE" || { echo 'FAILED allowlist' >&2; return 1; }
  printf '\n' >> "$ALLOWLIST_FILE"
  if [[ $MODE == APPLY ]] && ! evidence_before; then echo 'FAILED evidence-setup' >&2; return 1; fi
  if [[ $MODE == APPLY ]]; then cp -p -- "$ALLOWLIST_FILE" "$EVIDENCE_DIR/allowlist.tsv"; fi
  while IFS=$'\t' read -r group p; do
    [[ -n $group && -n $p ]] || continue
    if ! reason=$(check_path "$group" "$p"); then printf 'SKIP %s\t%s\t%s\n' "$reason" "$group" "$p"; ((SKIPPED+=1)); [[ $MODE == APPLY && -n $EVIDENCE_DIR ]] && printf 'SKIP\t%s\t%s\t%s\n' "$group" "$p" "$reason" >> "$EVIDENCE_DIR/results.tsv"; continue; fi
    if [[ $MODE != APPLY ]]; then printf 'WOULD-DELETE\t%s\t%s\n' "$group" "$p"; ((WOULD+=1)); continue; fi
    before=$(size_of "$p")
    if [[ $group == worktree ]]; then git -c safe.directory='*' -C "$p" worktree remove "$p" >/dev/null 2>&1 || { printf 'SKIP\t%s\t%s\tworktree-remove-failed\n' "$group" "$p"; ((SKIPPED+=1)); continue; }; else rm -rf --one-file-system -- "$p" || { printf 'FAILED\t%s\t%s\trm-failed\n' "$group" "$p"; ((FAILED+=1)); continue; }; fi
    printf 'DELETED\t%s\t%s\t%s\n' "$group" "$p" "$before" >> "$EVIDENCE_DIR/results.tsv"; printf 'DELETED\t%s\t%s\n' "$group" "$p"; ((DELETED+=1)); BYTES_FREED+=before
  done < "$ALLOWLIST_FILE"
  if [[ $MODE == APPLY ]]; then df -h / > "$EVIDENCE_DIR/df-after.txt"; fi
  printf 'SUMMARY deleted=%d skipped=%d failed=%d would-delete=%d bytes-freed=%d evidence=%s\n' "$DELETED" "$SKIPPED" "$FAILED" "$WOULD" "$BYTES_FREED" "${EVIDENCE_DIR:-none}"
}
main "$@" </dev/null
