#!/usr/bin/env bash
set -Eeuo pipefail

: "${THOIDAI_RELEASE_ROOT:=/opt/releases/thoidai-work}"
: "${THOIDAI_SOURCE_REPO:=/opt/thoidai-work}"
: "${THOIDAI_BUILD_ROOT:=/opt/build/thoidai-work}"
: "${THOIDAI_WORKTREE_ROOT:=/opt/worktrees}"
: "${THOIDAI_SYSTEMD_ROOT:=/etc/systemd/system}"
: "${THOIDAI_SERVICE:=thoidai-work.service}"
: "${THOIDAI_HEALTH_URL:=http://127.0.0.1:3001/login}"
: "${THOIDAI_LOCK_FILE:=/run/lock/thoidai-work-deploy.lock}"
: "${THOIDAI_DESIRED_FREE_GIB:=15}"
: "${THOIDAI_HARD_MIN_FREE_GIB:=10}"
: "${THOIDAI_ESTIMATED_RELEASE_GIB:=2}"
: "${THOIDAI_SYSTEMCTL_BIN:=systemctl}"
: "${THOIDAI_CURL_BIN:=curl}"
: "${THOIDAI_PGREP_BIN:=pgrep}"
: "${THOIDAI_LSOF_BIN:=lsof}"
: "${THOIDAI_FINDMNT_BIN:=findmnt}"
: "${THOIDAI_DOCKER_BIN:=docker}"
: "${THOIDAI_TCP_CHECK_BIN:=}"
: "${THOIDAI_ENV_VERIFY_BIN:=/opt/ops/thoidai-work/verify-release-env.sh}"
: "${THOIDAI_TCP_HOST:=127.0.0.1}"
: "${THOIDAI_TCP_PORT:=3001}"
: "${THOIDAI_READY_TIMEOUT_SEC:=15}"
: "${THOIDAI_READY_OBSERVATION_SEC:=5}"

die() { echo "ERROR: $*" >&2; return 1; }
log_event() { printf '%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

validate_release_id() {
  [[ "${1:-}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$ ]] || { die "invalid release id"; return 1; }
  case "$1" in current|previous|rollback-2|ops-backups|build-evidence) die "reserved release id";; esac
}

assert_release_path() {
  local path=${1:?path required} real root
  root=$(realpath -m -- "$THOIDAI_RELEASE_ROOT")
  real=$(realpath -m -- "$path")
  [[ "$real" == "$root"/* ]] || { die "path outside release root: $path"; return 1; }
}

resolve_link_target() {
  local link=${1:?link required} target
  [[ -L "$link" ]] || { die "missing lifecycle link: $link"; return 1; }
  target=$(readlink -f -- "$link") || { die "broken lifecycle link: $link"; return 1; }
  assert_release_path "$target" || return 1
  [[ -d "$target" ]] || { die "link target is not a directory: $target"; return 1; }
  printf '%s\n' "$target"
}

atomic_link() {
  local target=${1:?target required} link=${2:?link required} tmp
  target=$(realpath -m -- "$target")
  [[ -d "$target" ]] || { die "link target missing: $target"; return 1; }
  assert_release_path "$target" || return 1
  tmp="${link}.new"
  [[ ! -e "$tmp" && ! -L "$tmp" ]] || { die "temporary link exists: $tmp"; return 1; }
  ln -s -- "$target" "$tmp"
  mv -Tf -- "$tmp" "$link"
}

snapshot_links() {
  local name target
  for name in current previous rollback-2; do
    target=""
    if [[ -L "$THOIDAI_RELEASE_ROOT/$name" ]]; then target=$(readlink -f -- "$THOIDAI_RELEASE_ROOT/$name" || true); fi
    printf '%s=%s\n' "$name" "$target"
  done
}

restore_links() {
  local snapshot=${1:?snapshot required} name target
  while IFS='=' read -r name target; do
    [[ "$name" =~ ^(current|previous|rollback-2)$ ]] || continue
    if [[ -n "$target" ]]; then atomic_link "$target" "$THOIDAI_RELEASE_ROOT/$name"; elif [[ -L "$THOIDAI_RELEASE_ROOT/$name" ]]; then rm -f -- "$THOIDAI_RELEASE_ROOT/$name"; fi
  done < "$snapshot"
}

acquire_lock() {
  mkdir -p "$(dirname "$THOIDAI_LOCK_FILE")"
  exec {THOIDAI_LOCK_FD}>"$THOIDAI_LOCK_FILE"
  flock -n "$THOIDAI_LOCK_FD" || { die "another lifecycle operation is running"; return 1; }
}

free_gib() {
  local path=${1:-/} blocks size
  read -r blocks size < <(df -Pk -- "$path" | awk 'NR==2 {print $4, $2}')
  awk -v b="$blocks" -v s="$size" 'BEGIN {printf "%.3f\n", b/1024/1024}'
}

disk_guard() {
  local free required
  free=$(free_gib /)
  required=$(awk -v h="$THOIDAI_HARD_MIN_FREE_GIB" -v e="$THOIDAI_ESTIMATED_RELEASE_GIB" 'BEGIN {print h+e}')
  if awk -v f="$free" -v r="$required" 'BEGIN {exit !(f < r)}'; then die "disk guard: free=${free}GiB required=${required}GiB"; return 1; fi
  log_event "DISK_GUARD free=${free}GiB desired=${THOIDAI_DESIRED_FREE_GIB}GiB estimated=${THOIDAI_ESTIMATED_RELEASE_GIB}GiB"
}

validate_release() {
  local release=${1:?release required}
  assert_release_path "$release" || return 1
  [[ -d "$release" && -f "$release/.next/BUILD_ID" && -f "$release/package.json" && -d "$release/node_modules" ]] || { die "invalid release: $release"; return 1; }
}

validate_bootstrap_release() {
  local release=${1:?release required}
  validate_release "$release" || return 1
  [[ -x "$release/node_modules/.bin/next" ]] || { die "runtime dependency missing: $release/node_modules/.bin/next"; return 1; }
  [[ -x "$THOIDAI_ENV_VERIFY_BIN" ]] || { die "env verifier missing: $THOIDAI_ENV_VERIFY_BIN"; return 1; }
  "$THOIDAI_ENV_VERIFY_BIN" "$(realpath -m -- "$release")" || { die "release environment validation failed: $release"; return 1; }
}

validate_bootstrap_mapping() {
  [[ $# -eq 3 ]] || { die "bootstrap mapping requires current, previous, and rollback-2"; return 1; }
  local release
  for release in "$@"; do
    validate_bootstrap_release "$release" || return 1
  done
}

health_check() {
  "$THOIDAI_SYSTEMCTL_BIN" is-active --quiet "$THOIDAI_SERVICE" || return 1
  "$THOIDAI_CURL_BIN" -fsS --max-time 15 -o /dev/null "$THOIDAI_HEALTH_URL"
}

systemd_property() {
  local property=${1:?property required}
  "$THOIDAI_SYSTEMCTL_BIN" show -P "$property" "$THOIDAI_SERVICE"
}

tcp_ready() {
  if [[ -n "$THOIDAI_TCP_CHECK_BIN" ]]; then
    "$THOIDAI_TCP_CHECK_BIN" "$THOIDAI_TCP_HOST" "$THOIDAI_TCP_PORT" "$THOIDAI_READY_TIMEOUT_SEC"
    return
  fi
  timeout "$THOIDAI_READY_TIMEOUT_SEC" bash -c "</dev/tcp/$THOIDAI_TCP_HOST/$THOIDAI_TCP_PORT"
}

migration_readiness_check() {
  local expected_current actual_workdir expected_workdir before_restarts after_restarts login_code
  expected_current="$THOIDAI_RELEASE_ROOT/current"

  [[ "$(systemd_property ActiveState)" == active ]] || { die "readiness: service is not active"; return 1; }
  [[ "$(systemd_property SubState)" == running ]] || { die "readiness: service is not running"; return 1; }

  tcp_ready || { die "readiness: TCP $THOIDAI_TCP_HOST:$THOIDAI_TCP_PORT is not ready"; return 1; }
  login_code=$("$THOIDAI_CURL_BIN" -sS --max-time "$THOIDAI_READY_TIMEOUT_SEC" -o /dev/null -w '%{http_code}' "$THOIDAI_HEALTH_URL") || {
    die "readiness: $THOIDAI_HEALTH_URL request failed"; return 1;
  }
  [[ "$login_code" == 200 ]] || { die "readiness: $THOIDAI_HEALTH_URL returned HTTP $login_code, expected 200"; return 1; }

  actual_workdir=$(systemd_property WorkingDirectory)
  [[ "$actual_workdir" == "$expected_current" ]] || {
    die "readiness: WorkingDirectory is $actual_workdir, expected $expected_current"; return 1;
  }
  expected_workdir=$(readlink -f -- "$expected_current") || { die "readiness: current link is missing or broken"; return 1; }
  [[ "$(readlink -f -- "$actual_workdir")" == "$expected_workdir" ]] || {
    die "readiness: WorkingDirectory does not resolve through $expected_current"; return 1;
  }

  validate_bootstrap_release "$expected_workdir" || { die "readiness: current release validation failed"; return 1; }

  [[ "$(systemd_property MemoryHigh)" == 524288000 ]] || { die "readiness: MemoryHigh is not 500M"; return 1; }
  [[ "$(systemd_property MemoryMax)" == 681574400 ]] || { die "readiness: MemoryMax is not 650M"; return 1; }
  [[ "$(systemd_property TasksMax)" == 250 ]] || { die "readiness: TasksMax is not 250"; return 1; }

  before_restarts=$(systemd_property NRestarts)
  sleep "$THOIDAI_READY_OBSERVATION_SEC"
  after_restarts=$(systemd_property NRestarts)
  [[ "$before_restarts" == "$after_restarts" ]] || {
    die "readiness: NRestarts changed during ${THOIDAI_READY_OBSERVATION_SEC}s observation ($before_restarts -> $after_restarts)"; return 1;
  }
  log_event "READINESS_PASS service=$THOIDAI_SERVICE current=$expected_workdir nrestarts=$after_restarts"
}

path_reference() {
  local path=${1:?path required} output='' required
  command -v "$THOIDAI_PGREP_BIN" >/dev/null 2>&1 || { printf 'inspection-unavailable\n'; return; }
  if "$THOIDAI_PGREP_BIN" -af -- "$path" >/dev/null 2>&1; then output=process; fi
  required=("$THOIDAI_LSOF_BIN" "$THOIDAI_FINDMNT_BIN" "$THOIDAI_DOCKER_BIN")
  for tool in "${required[@]}"; do command -v "$tool" >/dev/null 2>&1 || { printf 'inspection-unavailable\n'; return; }; done
  if "$THOIDAI_LSOF_BIN" +D "$path" 2>/dev/null | tail -n +2 | grep -q .; then output=${output:+$output,}open-file; fi
  if grep -R -l --fixed-strings "$path" "$THOIDAI_SYSTEMD_ROOT" /etc/nginx 2>/dev/null | head -1 | grep -q .; then output=${output:+$output,}systemd; fi
  mount_output=$("$THOIDAI_FINDMNT_BIN" -rn -T "$path" 2>/dev/null) || { printf 'inspection-unavailable\n'; return; }
  if grep -F "$path" <<<"$mount_output" >/dev/null; then output=${output:+$output,}mount; fi
  container_ids=$("$THOIDAI_DOCKER_BIN" ps -aq 2>/dev/null) || { printf 'inspection-unavailable\n'; return; }
  if [[ -n "$container_ids" ]]; then
    mounts=$("$THOIDAI_DOCKER_BIN" inspect $container_ids --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' 2>/dev/null) || { printf 'inspection-unavailable\n'; return; }
    if grep -Fx "$path" <<<"$mounts" >/dev/null; then output=${output:+$output,}container; fi
  fi
  printf '%s\n' "$output"
}
