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
: "${THOIDAI_READY_TIMEOUT_SEC:=30}"
: "${THOIDAI_READY_OBSERVATION_SEC:=5}"
: "${THOIDAI_READY_POLL_INTERVAL_SEC:=0.5}"
: "${THOIDAI_TCP_PROBE_TIMEOUT_SEC:=1}"

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

systemd_property_required() {
  local property=${1:?property required} line
  line=$("$THOIDAI_SYSTEMCTL_BIN" show -p "$property" "$THOIDAI_SERVICE") || {
    die "systemd property query failed: $property"
    return 1
  }
  [[ "$line" == "$property="* ]] || {
    die "systemd property missing: $property"
    return 1
  }
  printf '%s\n' "${line#*=}"
}

validate_systemd_property() {
  local property=${1:?property required} expected=${2:?expected value required} value
  value=$(systemd_property_required "$property") || return 1
  case "$expected" in
    __EMPTY__)
      [[ -z "$value" ]] || { die "systemd property $property is non-empty"; return 1; }
      ;;
    *)
      [[ "$value" == "$expected" ]] || { die "systemd property $property is $value, expected $expected"; return 1; }
      ;;
  esac
}

validate_systemd_hardening() {
  validate_systemd_property CapabilityBoundingSet __EMPTY__ || return 1
  validate_systemd_property AmbientCapabilities __EMPTY__ || return 1
  validate_systemd_property NoNewPrivileges yes || return 1
  validate_systemd_property PrivateTmp yes || return 1
  validate_systemd_property ProtectSystem strict || return 1
  validate_systemd_property ProtectHome yes || return 1
  validate_systemd_property RestrictAddressFamilies 'AF_INET AF_INET6 AF_UNIX' || return 1
}

tcp_ready() {
  if [[ -n "$THOIDAI_TCP_CHECK_BIN" ]]; then
    "$THOIDAI_TCP_CHECK_BIN" "$THOIDAI_TCP_HOST" "$THOIDAI_TCP_PORT" "$THOIDAI_TCP_PROBE_TIMEOUT_SEC"
    return
  fi
  timeout "$THOIDAI_TCP_PROBE_TIMEOUT_SEC" bash -c "</dev/tcp/$THOIDAI_TCP_HOST/$THOIDAI_TCP_PORT"
}

migration_readiness_check() {
  local expected_current actual_workdir expected_workdir before_restarts after_restarts login_code
  local started_ms deadline_ms now_ms_value elapsed_ms active_state sub_state
  local baseline_pid current_pid last_tcp='not-checked' last_http='not-checked'
  expected_current="$THOIDAI_RELEASE_ROOT/current"
  started_ms=$(date +%s%3N)
  deadline_ms=$((started_ms + THOIDAI_READY_TIMEOUT_SEC * 1000))
  baseline_pid=$(systemd_property MainPID || printf '0')
  before_restarts=$(systemd_property NRestarts || printf 'unknown')

  while :; do
    now_ms_value=$(date +%s%3N)
    elapsed_ms=$((now_ms_value - started_ms))
    active_state=$(systemd_property ActiveState || printf 'unknown')
    sub_state=$(systemd_property SubState || printf 'unknown')
    current_pid=$(systemd_property MainPID || printf '0')
    after_restarts=$(systemd_property NRestarts || printf 'unknown')

    [[ "$active_state" == failed || "$sub_state" == failed ]] && {
      die "readiness: service entered failed state active=$active_state sub=$sub_state elapsed_ms=$elapsed_ms MainPID=$current_pid NRestarts=$after_restarts"; return 1;
    }
    if [[ "$before_restarts" =~ ^[0-9]+$ && "$after_restarts" =~ ^[0-9]+$ ]] && (( after_restarts > before_restarts )); then
      die "readiness: NRestarts increased during startup elapsed_ms=$elapsed_ms ($before_restarts -> $after_restarts)"; return 1;
    fi

    if [[ "$active_state" == active && "$sub_state" == running ]]; then
      if tcp_ready; then
        last_tcp=ready
        login_code=$("$THOIDAI_CURL_BIN" -sS --max-time "$THOIDAI_TCP_PROBE_TIMEOUT_SEC" -o /dev/null -w '%{http_code}' "$THOIDAI_HEALTH_URL" 2>/dev/null) || login_code=connection-error
        last_http=$login_code
        [[ "$login_code" == 200 ]] && break
      else
        last_tcp=refused
      fi
    else
      last_tcp="service-$active_state/$sub_state"
      last_http=not-attempted
    fi

    (( now_ms_value >= deadline_ms )) && {
      die "readiness: timeout elapsed_ms=$elapsed_ms last_tcp=$last_tcp last_http=$last_http active=$active_state sub=$sub_state MainPID=$current_pid NRestarts=$after_restarts"; return 1;
    }
    sleep "$THOIDAI_READY_POLL_INTERVAL_SEC"
  done

  [[ "$current_pid" =~ ^[1-9][0-9]*$ ]] || { die "readiness: MainPID is invalid after startup: $current_pid"; return 1; }
  [[ "$baseline_pid" == 0 || "$baseline_pid" == "$current_pid" ]] || {
    die "readiness: MainPID changed during startup ($baseline_pid -> $current_pid)"; return 1;
  }

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
  validate_systemd_hardening || { die "readiness: systemd hardening validation failed"; return 1; }

  before_restarts=$(systemd_property NRestarts)
  baseline_pid=$current_pid
  sleep "$THOIDAI_READY_OBSERVATION_SEC"
  after_restarts=$(systemd_property NRestarts)
  [[ "$before_restarts" == "$after_restarts" ]] || {
    die "readiness: NRestarts changed during ${THOIDAI_READY_OBSERVATION_SEC}s observation ($before_restarts -> $after_restarts)"; return 1;
  }
  current_pid=$(systemd_property MainPID)
  [[ "$current_pid" == "$baseline_pid" ]] || { die "readiness: MainPID changed during stability observation ($baseline_pid -> $current_pid)"; return 1; }
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
