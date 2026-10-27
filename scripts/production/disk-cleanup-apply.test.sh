#!/usr/bin/env bash
set -u -o pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/scripts/production/disk-cleanup-apply.sh"
TMP=$(mktemp -d)
trap 'rm -rf -- "$TMP"' EXIT

assert() { if ! "$@"; then echo "ASSERTION FAILED: $*" >&2; exit 1; fi; }
assert_not_exists() { [[ ! -e $1 && ! -L $1 ]]; }
assert_exists() { [[ -e $1 || -L $1 ]]; }

release_root="$TMP/releases"
worktree_root="$TMP/worktrees"
build_root="$TMP/build"
evidence_root="$TMP/evidence"
config_root="$TMP/config"
mkdir -p "$release_root" "$worktree_root" "$build_root" "$evidence_root" "$config_root"

mkdir "$release_root/good-release" "$release_root/current-target" "$release_root/.keep-dir" "$release_root/config-item"
printf 'payload\n' > "$release_root/good-release/file"
printf 'keep\n' > "$release_root/.keep-dir/.keep"
ln -s "$release_root/current-target" "$release_root/current"
mkdir "$build_root/good-build" "$build_root/outside"
printf 'build\n' > "$build_root/good-build/file"
mkdir "$TMP/outside-item"
ln -s "$TMP/outside-item" "$build_root/symlink-item"
printf '%s\n' "$release_root/config-item" > "$config_root/reference.conf"

git init -q "$TMP/source"
git -C "$TMP/source" config user.email test@example.invalid
git -C "$TMP/source" config user.name test
printf 'source\n' > "$TMP/source/file"
git -C "$TMP/source" add file
git -C "$TMP/source" commit -qm initial
git init -q --bare "$TMP/remote.git"
git -C "$TMP/source" remote add origin "$TMP/remote.git"
git -C "$TMP/source" push -q -u origin HEAD
git -C "$TMP/source" worktree add -q -b clean-worktree "$worktree_root/clean-worktree" origin/master
git -C "$TMP/source" worktree add -q -b dirty-worktree "$worktree_root/dirty-worktree" origin/master
git -C "$worktree_root/clean-worktree" branch --set-upstream-to=origin/master
git -C "$worktree_root/dirty-worktree" branch --set-upstream-to=origin/master
printf 'dirty\n' > "$worktree_root/dirty-worktree/dirty-file"

allowlist="$TMP/allowlist.tsv"
{
  printf $'release\t%s\n' "$release_root/good-release"
  printf $'release\t%s\n' "$release_root/current-target"
  printf $'release\t%s\n' "$release_root/current"
  printf $'release\t%s\n' "$release_root/.keep-dir"
  printf $'release\t%s\n' "$release_root/config-item"
  printf $'build\t%s\n' "$build_root/good-build"
  printf $'build\t%s\n' "$build_root/symlink-item"
  printf $'worktree\t%s\n' "$worktree_root/dirty-worktree"
  printf $'build\t%s\n' "$TMP/../outside-item"
  printf $'build\t%s\n' "$release_root/good-release"
} > "$allowlist"

common=(env PROC_ROOT="$TMP/no-proc" RELEASE_ROOT="$release_root" WORKTREE_ROOT="$worktree_root" BUILD_ROOT="$build_root" EXTRA_BUILD_PATHS= EVIDENCE_ROOT="$evidence_root" CONFIG_GREP_PATHS="$config_root" ALLOWLIST="$allowlist" SKIP_DOCKER=1)

before=$(find "$TMP" -mindepth 1 -maxdepth 4 -print | sort)
verify_output=$("${common[@]}" bash "$SCRIPT")
after=$(find "$TMP" -mindepth 1 -maxdepth 4 -print | sort)
assert test "$before" = "$after"
assert grep -q $'^WOULD-DELETE\t' <<<"$verify_output"
assert_exists "$release_root/good-release"

"${common[@]}" bash "$SCRIPT" --apply >/dev/null
assert_exists "$release_root/good-release"
assert_exists "$build_root/good-build"

apply_output=$(THOIDAI_DISK_CLEANUP_APPROVED=APPROVE-DISK-CLEANUP-2026-10-27 "${common[@]}" bash "$SCRIPT" --apply)
assert_not_exists "$release_root/good-release"
assert_not_exists "$build_root/good-build"
assert_exists "$release_root/current-target"
assert_exists "$release_root/.keep-dir"
assert_exists "$build_root/symlink-item"
assert_exists "$worktree_root/dirty-worktree"
assert_exists "$TMP/outside-item"
assert grep -Eq $'^SKIP (current-symlink-target|symlink-path|missing)\t' <<<"$apply_output"
assert grep -q $'^SKIP .keep\t' <<<"$apply_output"
assert grep -q $'^SKIP dirty\t' <<<"$apply_output"
assert grep -Eq $'^SKIP (path-outside-root|missing)\t' <<<"$apply_output"
assert grep -q $'^SKIP path-contains-parent\t' <<<"$apply_output"
assert grep -Eq $'^SKIP (symlink-path|missing)\t' <<<"$apply_output"
assert grep -q $'^SKIP config-referenced\t' <<<"$apply_output"

evidence_dir=$(find "$evidence_root" -mindepth 1 -maxdepth 1 -type d | head -n 1)
assert_exists "$evidence_dir/df-before.txt"
assert_exists "$evidence_dir/allowlist.tsv"
assert_exists "$evidence_dir/results.tsv"
assert_exists "$evidence_dir/df-after.txt"
assert test "$(find "$evidence_dir" -type f \( -name '*good-build*' -o -name '*good-release*' \) | wc -l)" -gt 0

echo "PASS disk-cleanup-apply (verify/apply guards and evidence)"
