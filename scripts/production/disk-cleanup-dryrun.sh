#!/usr/bin/env bash
set -u -o pipefail
export GIT_OPTIONAL_LOCKS=0 GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0='*'

RELEASE_ROOT=${RELEASE_ROOT:-/opt/releases/thoidai-work}
WORKTREE_ROOT=${WORKTREE_ROOT:-/opt/worktrees}
BUILD_PATHS=${BUILD_PATHS:-'/opt/build/* /opt/artifacts /opt/thoidai-work-artifacts /opt/staging'}
MIN_AGE_DAYS=${MIN_AGE_DAYS:-7}
SKIP_DOCKER=${SKIP_DOCKER:-0}

declare -A CANDIDATE_BYTES
is_forbidden() {
  case "$1" in
    /opt/ops/*|/opt/ops|*supabase*thoidai-work*|*thoidai-work*supabase*) return 0 ;;
  esac
  return 1
}

human_size() {
  awk -v n="${1:-0}" 'BEGIN { if (n == "?") { print "?"; exit } u[1]="B";u[2]="KB";u[3]="MB";u[4]="GB";u[5]="TB"; i=1; while (n >= 1024 && i < 5) { n/=1024; i++ } printf "%.1f%s", n, u[i] }'
}
size_of() {
  local p=$1 n
  n=$(timeout 120 du -sb -- "$p" 2>/dev/null | awk 'NR==1 {print $1}') || n=
  [[ $n =~ ^[0-9]+$ ]] && printf '%s\n' "$n" || printf '?\n'
}
mtime_epoch() { stat -c %Y -- "$1" 2>/dev/null || printf '0\n'; }
protected_process() {
  local p=$1 x target
  target=$(readlink -f -- "$p" 2>/dev/null) || return 1
  for x in /proc/[0-9]*/cwd /proc/[0-9]*/exe; do
    [[ -e $x ]] || continue
    p=$(readlink -f -- "$x" 2>/dev/null) || continue
    [[ $p == "$target" || $p == "$target"/* ]] && return 0
  done
  return 1
}
release_target() {
  local p t link parent raw
  parent=$(dirname -- "$RELEASE_ROOT")
  case "$1" in "$RELEASE_ROOT/current"|"$RELEASE_ROOT/previous"|"$RELEASE_ROOT"/rollback-*|"$parent/current"|"$parent/previous"|"$parent"/rollback-*) return 0 ;; esac
  for link in "$RELEASE_ROOT/current" "$RELEASE_ROOT/previous" "$parent/current" "$parent/previous"; do
    [[ -L $link ]] || continue
    raw=$(readlink -- "$link" 2>/dev/null || true)
    [[ "$(basename -- "$raw")" == "$(basename -- "$1")" ]] && return 0
    t=$(readlink -f -- "$link" 2>/dev/null) || continue
    p=$(readlink -f -- "$1" 2>/dev/null) || continue
    [[ $p == "$t" || $p == "$t"/* ]] && return 0
  done
  for link in "$RELEASE_ROOT"/rollback-* "$parent"/rollback-*; do
    [[ -L $link ]] || continue
    t=$(readlink -f -- "$link" 2>/dev/null) || continue
    p=$(readlink -f -- "$1" 2>/dev/null) || continue
    [[ $p == "$t" || $p == "$t"/* ]] && return 0
  done
  return 1
}
emit() {
  local group=$1 verdict=$2 path=$3 reason=$4 bytes human
  if [[ -e $path || -L $path ]]; then bytes=$(size_of "$path"); else bytes=?; fi
  human=$(human_size "$bytes")
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$group" "$verdict" "$bytes" "$human" "$path" "$reason"
  if [[ $verdict == CANDIDATE && $bytes =~ ^[0-9]+$ ]]; then CANDIDATE_BYTES[$group]=$(( ${CANDIDATE_BYTES[$group]:-0} + bytes )); fi
}
release_scan() {
  local d now cutoff newest=() reason link target_name=
  now=$(date +%s); cutoff=$((now - MIN_AGE_DAYS*86400))
  while IFS= read -r -d '' d; do
    reason=
    if is_forbidden "$d"; then reason=never-list
    elif [[ -L $d ]]; then reason=release-symlink-target
    elif release_target "$d"; then reason=release-symlink-target
    elif [[ -e $d/.keep ]]; then reason=.keep
    elif protected_process "$d"; then reason=running-process
    elif (( $(mtime_epoch "$d") > cutoff )); then reason=newer-than-min-age
    else newest+=("$(mtime_epoch "$d") $d")
    fi
    [[ -n $reason ]] && emit release KEEP "$d" "$reason"
  done < <(find -P "$RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
  if ((${#newest[@]})); then
    while IFS= read -r line; do
      d=${line#* }; emit release KEEP "$d" "among-5-newest"
    done < <(printf '%s\n' "${newest[@]}" | sort -rn | head -n 5)
    while IFS= read -r line; do
      d=${line#* }; emit release CANDIDATE "$d" "old-unprotected-unused"
    done < <(printf '%s\n' "${newest[@]}" | sort -rn | tail -n +6)
  fi
}
worktree_scan() {
  local d status branch upstream ahead reason
  while IFS= read -r -d '' d; do
    if ! git -C "$d" rev-parse --is-inside-work-tree >/dev/null 2>&1; then emit worktree KEEP "$d" "not-a-worktree"; continue; fi
    reason=
    status=$(git -C "$d" status --porcelain 2>/dev/null || printf '?')
    branch=$(git -C "$d" symbolic-ref --quiet --short HEAD 2>/dev/null || printf detached)
    upstream=$(git -C "$d" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)
    ahead=0
    if [[ -n $upstream ]]; then ahead=$(git -C "$d" rev-list --count "$upstream..HEAD" 2>/dev/null || printf '?'); else ahead=?; fi
    [[ -n $status ]] && reason=dirty
    [[ $branch == detached ]] && reason=${reason:+$reason,}detached
    [[ -z $upstream ]] && reason=${reason:+$reason,}no-upstream
    [[ $ahead != 0 && $ahead != ? ]] && reason=${reason:+$reason,}ahead=$ahead
    protected_process "$d" && reason=${reason:+$reason,}running-process
    [[ -e $d/.keep ]] && reason=${reason:+$reason,}.keep
    (( $(mtime_epoch "$d") > $(($(date +%s)-MIN_AGE_DAYS*86400)) )) && reason=${reason:+$reason,}newer-than-min-age
    if [[ -z $reason && -n $upstream && $ahead == 0 ]]; then emit worktree CANDIDATE "$d" "clean,upstream=$upstream,ahead=0"; else emit worktree KEEP "$d" "${reason:-unknown}"; fi
  done < <(find "$WORKTREE_ROOT" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
}
build_scan() {
  local p reason
  for p in $BUILD_PATHS; do
    [[ -e $p || -L $p ]] || continue
    reason=
    if is_forbidden "$p"; then reason=never-list
    elif [[ -e $p/.keep ]]; then reason=.keep
    elif protected_process "$p"; then reason=running-process
    elif (( $(mtime_epoch "$p") > $(($(date +%s)-MIN_AGE_DAYS*86400)) )); then reason=newer-than-min-age
    elif release_target "$p"; then reason=release-symlink-target
    fi
    if [[ -n $reason ]]; then emit build KEEP "$p" "$reason"; else emit build CANDIDATE "$p" old-unreferenced; fi
  done
}
docker_scan() {
  local v id line name labels reason
  command -v docker >/dev/null 2>&1 || return 0
  while IFS= read -r v; do
    [[ -n $v ]] || continue; name=$v; reason=unknown-owner
    labels=$(docker volume inspect --format '{{.Name}} {{range $k,$v := .Labels}}{{$k}}={{$v}} {{end}}' "$v" 2>/dev/null || true)
    if [[ $labels == *supabase* && $labels == *thoidai-work* && ! $labels =~ (test|disposable|drill|rehearsal|tmp) ]]; then reason=production
    elif [[ $labels == *thoidai-work* && $labels =~ (test|disposable|drill|rehearsal|tmp) ]]; then emit docker CANDIDATE "$v" "dangling-thoidai-test"; continue
    elif [[ $labels == *project=* && $labels != *thoidai-work* ]]; then reason=other-project
    elif [[ $v =~ (thoidai|test|disposable|drill) ]]; then reason=unknown-owner
    fi
    emit docker KEEP "$v" "$reason"
  done < <(docker volume ls -qf dangling=true 2>/dev/null)
  while IFS= read -r line; do [[ -n $line ]] && emit docker CANDIDATE "$line" dangling-image; done < <(docker images -f dangling=true --format '{{.ID}}' 2>/dev/null)
  while IFS= read -r line; do [[ -n $line ]] && emit docker KEEP "$line" 'unused-but-tagged (owner decides)'; done < <(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null)
  while IFS= read -r id; do [[ -n $id ]] && emit docker KEEP "$id" 'stopped; remove after 2026-11-02 per policy'; done < <(docker ps -aqf status=exited 2>/dev/null)
}
main() {
  release_scan; worktree_scan; build_scan
  [[ $SKIP_DOCKER == 1 ]] || docker_scan
  local g total=0 bytes
  for g in release worktree build docker; do bytes=${CANDIDATE_BYTES[$g]:-0}; printf 'SUMMARY\t%s\tCANDIDATE_COUNT_BYTES\t%s\t%s\t%s\n' "$g" "$bytes" "$(human_size "$bytes")" "candidate-total"; total=$((total+bytes)); done
  printf 'SUMMARY\tgrand\tCANDIDATE_COUNT_BYTES\t%s\t%s\tgrand-total\n' "$total" "$(human_size "$total")"
}
main "$@" </dev/null
