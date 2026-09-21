#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
export THOIDAI_RELEASE_ROOT="$ROOT/releases"
export THOIDAI_SYSTEMD_ROOT="$ROOT/systemd"
export THOIDAI_LOCK_FILE="$ROOT/deploy.lock"
export THOIDAI_TEST_MODE=1
mkdir -p "$THOIDAI_RELEASE_ROOT" "$THOIDAI_SYSTEMD_ROOT"

source "$(dirname "$0")/../release-common.sh"

fail() { echo "FAIL: $*" >&2; exit 1; }
assert_eq() { [ "$1" = "$2" ] || fail "expected '$2', got '$1'"; }
assert_status() { if "$@" >/dev/null 2>&1; then fail "expected failure: $*"; fi; }

mkdir -p "$THOIDAI_RELEASE_ROOT/release-a-0001" "$THOIDAI_RELEASE_ROOT/release-b-0002" "$THOIDAI_RELEASE_ROOT/release-c-0003"
atomic_link "$THOIDAI_RELEASE_ROOT/release-a-0001" "$THOIDAI_RELEASE_ROOT/current"
atomic_link "$THOIDAI_RELEASE_ROOT/release-b-0002" "$THOIDAI_RELEASE_ROOT/previous"
atomic_link "$THOIDAI_RELEASE_ROOT/release-c-0003" "$THOIDAI_RELEASE_ROOT/rollback-2"
assert_eq "$(resolve_link_target "$THOIDAI_RELEASE_ROOT/current")" "$THOIDAI_RELEASE_ROOT/release-a-0001"
assert_eq "$(resolve_link_target "$THOIDAI_RELEASE_ROOT/previous")" "$THOIDAI_RELEASE_ROOT/release-b-0002"
assert_eq "$(resolve_link_target "$THOIDAI_RELEASE_ROOT/rollback-2")" "$THOIDAI_RELEASE_ROOT/release-c-0003"
assert_status atomic_link /tmp "$THOIDAI_RELEASE_ROOT/current"
assert_status validate_release_id 'bad/name'
assert_status assert_release_path "$ROOT/outside"

exec {held_fd}>"$THOIDAI_LOCK_FILE"
flock -n "$held_fd"
if acquire_lock >/dev/null 2>&1; then fail "lock contention was not rejected"; fi
flock -u "$held_fd"

echo "PASS release-common"
