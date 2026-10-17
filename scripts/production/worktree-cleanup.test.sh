#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
script="$script_dir/worktree-cleanup.sh"

grep -q -- '--task-complete' "$script"
grep -q -- 'git worktree remove' "$script"
grep -q -- 'reason=dirty' "$script"
grep -q -- 'reason=head-not-on-origin' "$script"
grep -q -- 'reason=active-process' "$script"
grep -q -- 'reason=runtime-reference' "$script"

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
if "$script" --repo "$script_dir/../.." --apply >"$tmp" 2>&1; then
  echo 'expected --apply without --task-complete to fail' >&2
  exit 1
fi
grep -q -- '--apply requires --task-complete' "$tmp"

echo 'worktree cleanup contract: PASS'
