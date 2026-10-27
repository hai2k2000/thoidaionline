#!/usr/bin/env bash
set -u -o pipefail

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
script="$root/scripts/production/disk-cleanup-dryrun.sh"
tmp=$(mktemp -d)
trap 'rmdir "$tmp" 2>/dev/null || true' EXIT

release="$tmp/releases"
worktrees="$tmp/worktrees"
build="$tmp/build"
origin="$tmp/origin.git"
mkdir -p "$release/current-target" "$release/old-candidate" "$release/kept-marker" "$release/new-1" "$release/new-2" "$release/new-3" "$release/new-4" "$release/new-5" "$worktrees" "$build"
ln -s "$release/current-target" "$release/current"
ln -s "$release/current-target" "$release/previous"
touch "$release/kept-marker/.keep"
touch -d '30 days ago' "$release/old-candidate" 2>/dev/null || touch "$release/old-candidate"
printf x > "$build/artifact"

git init --bare -q "$origin" || fail "git init bare"
seed="$tmp/seed"
git init -q "$seed" || fail "git init seed"
git -C "$seed" config user.email test@example.invalid
git -C "$seed" config user.name Test
printf base > "$seed/file"
git -C "$seed" add file
git -C "$seed" commit -qm base
git -C "$seed" branch -M main
git -C "$seed" remote add origin "$origin"
git -C "$seed" push -q -u origin main || fail "push seed"
git clone -q -b main "$origin" "$worktrees/clean"
git -C "$worktrees/clean" config user.email test@example.invalid
git -C "$worktrees/clean" config user.name Test
git -C "$seed" branch dirty-branch main
git -C "$seed" branch ahead-branch main
git -C "$seed" branch detached-branch main
git -C "$seed" worktree add -q "$worktrees/dirty" dirty-branch
git -C "$seed" worktree add -q "$worktrees/ahead" ahead-branch
git -C "$seed" worktree add -q "$worktrees/detached" detached-branch
printf dirty >> "$worktrees/dirty/file"
printf ahead >> "$worktrees/ahead/file"
git -C "$worktrees/ahead" add file && git -C "$worktrees/ahead" commit -qm ahead
git -C "$worktrees/clean" branch --set-upstream-to=origin/main main >/dev/null 2>&1 || true
git -C "$worktrees/ahead" branch --set-upstream-to=origin/main ahead-branch >/dev/null 2>&1 || true
git -C "$worktrees/dirty" branch --set-upstream-to=origin/main dirty-branch >/dev/null 2>&1 || true
git -C "$worktrees/detached" branch --set-upstream-to=origin/main detached-branch >/dev/null 2>&1 || true
git -C "$worktrees/detached" checkout -q --detach

if RELEASE_ROOT="$release" WORKTREE_ROOT="$worktrees" BUILD_PATHS="$build/*" SKIP_DOCKER=1 MIN_AGE_DAYS=0 bash "$script" </dev/null > "$tmp/out"; then :; else fail "script exited nonzero"; fi

grep -F $'release\tKEEP\t' "$tmp/out" | grep -F "$release/current" >/dev/null || { cat "$tmp/out" >&2; fail "current release pointer not kept"; }
grep -F $'release\tCANDIDATE\t' "$tmp/out" | grep -F "$release/old-candidate" >/dev/null || fail "old release not candidate"
grep -F $'release\tKEEP\t' "$tmp/out" | grep -F "$release/kept-marker" >/dev/null || fail "marker release not kept"
grep -F $'worktree\tCANDIDATE\t' "$tmp/out" | grep -F "$worktrees/clean" >/dev/null || fail "clean worktree not candidate"
grep -F $'worktree\tKEEP\t' "$tmp/out" | grep -F "$worktrees/dirty" >/dev/null || fail "dirty worktree not kept"
grep -F $'worktree\tKEEP\t' "$tmp/out" | grep -F "$worktrees/ahead" >/dev/null || fail "ahead worktree not kept"
grep -F $'worktree\tKEEP\t' "$tmp/out" | grep -F "$worktrees/detached" >/dev/null || fail "detached worktree not kept"

if rg -n -e 'rm ' -e 'prune' -e 'docker rm' -e 'docker volume rm' -e 'kill' -e 'mv ' "$script"; then
  fail "forbidden mutating command text found"
fi
bash -n "$script" || fail "script syntax"
bash -n "$0" || fail "test syntax"
printf 'PASS: disk-cleanup-dryrun fixture\n'
