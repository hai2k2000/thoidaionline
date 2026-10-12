#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
repo="$ROOT/repo"
remote="$ROOT/remote.git"
mkdir -p "$repo"
git init -q --bare "$remote"
git clone -q "$remote" "$repo/main"
git -C "$repo/main" config user.email test@example.invalid
git -C "$repo/main" config user.name test
printf seed > "$repo/main/file"
git -C "$repo/main" add file
git -C "$repo/main" commit -qm seed
git -C "$repo/main" branch -M main
git -C "$repo/main" push -qu origin main

for name in clean dirty unpushed live mismatch; do
  git -C "$repo/main" worktree add -qb "$name-branch" "$repo/$name"
done
for name in clean dirty live mismatch; do
  git -C "$repo/$name" push -qu -u origin "$name-branch"
done

for name in clean dirty unpushed live mismatch; do
  meta=$(git -C "$repo/$name" rev-parse --git-path thoidai-lifecycle)
  mkdir -p "$(dirname "$meta")"
  metadata_path="$repo/$name"
  [[ "$name" == mismatch ]] && metadata_path="$repo/wrong"
  printf 'path=%s\nlifecycle_state=READY_FOR_CLEANUP\n' "$metadata_path" > "$meta"
done
printf dirty >> "$repo/dirty/file"
printf untracked > "$repo/dirty/untracked"

cat > "$ROOT/pgrep" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  *"/live"*) exit 0 ;;
  *) exit 1 ;;
esac
EOF
chmod +x "$ROOT/pgrep"

export THOIDAI_SOURCE_REPO="$repo/main"
export THOIDAI_WORKTREE_ROOT="$repo"
export THOIDAI_LOCK_FILE="$ROOT/lock"
export THOIDAI_TEST_MODE=1
export THOIDAI_OWNER_APPROVED_CLEANUP=1
export THOIDAI_PGREP_BIN="$ROOT/pgrep"
export THOIDAI_LSOF_BIN=/bin/false

out=$(scripts/production/worktree-cleanup.sh)
echo "$out" | grep -q $'DELETE\t.*clean\tclean-upstream-reachable'
echo "$out" | grep -q $'KEEP\t.*dirty\tdirty-or-untracked'
echo "$out" | grep -q $'REVIEW\t.*unpushed\tno-upstream-or-unreachable'
echo "$out" | grep -q $'KEEP\t.*live\tprocess-in-use'
echo "$out" | grep -q $'REVIEW\t.*mismatch\tmetadata-path-mismatch'

scripts/production/worktree-cleanup.sh --apply >/dev/null
[ ! -e "$repo/clean" ]
[ -e "$repo/dirty" ]
[ -e "$repo/live" ]
out_again=$(scripts/production/worktree-cleanup.sh)
! echo "$out_again" | grep -q $'DELETE\t.*clean\t'
echo PASS worktree-cleanup
