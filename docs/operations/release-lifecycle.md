# Thoidai Work Release Lifecycle

This runbook describes the bounded release lifecycle implemented on branch `ops/bounded-release-lifecycle`. It is not a production migration authorization.

## Fixed state

```text
current     = production currently intended to run
previous    = production immediately before current
rollback-2  = production before previous
```

The stable systemd template uses `/opt/releases/thoidai-work/current`. Deploy changes the pointer atomically; it does not create a release-specific systemd drop-in.

## Commands

```text
scripts/production/deploy-release.sh <commit-or-ref> [suffix]
scripts/production/rollback-release.sh [--to-rollback-2]
scripts/production/release-retention.sh --dry-run
scripts/production/release-retention.sh --apply
scripts/production/worktree-cleanup.sh --dry-run
scripts/production/worktree-cleanup.sh --apply
```

All mutating commands use the shared deployment lock. Retention and worktree cleanup default to dry-run. `--apply` is required for deletion.

## Safety gates

- Disk guard runs before build and reserves hard minimum plus estimated release space.
- A new release must have `.next/BUILD_ID`, `package.json`, and `node_modules`.
- `current` changes before link rotation, but `previous` and `rollback-2` rotate only after service and `/login` health pass.
- Failed activation restores the exact previous links and leaves the failed release protected with `.keep`.
- Retention keeps lifecycle targets, protected releases, process/open-file/systemd/mount/container references, and incomplete evidence.
- `ops-backups`, database backups, environment files, Docker data, and worktrees are outside release retention.

## Worktrees

Worktree cleanup is independent. Dirty or untracked worktrees are kept. A clean worktree is removable only when its branch HEAD is reachable from its upstream remote ref and no process uses it. Removal uses `git worktree remove` without force and never deletes the branch.

## Protection

Create a root-owned `.keep` file in a release with a one-line reason when it must remain for forensic or operational reasons. Retention treats it as `KEEP`.

## Systemd migration checkpoint

The production migration is not part of the implementation checkpoint. The current production configuration contains 15 accumulated drop-ins. Migration must first back up the base unit, every drop-in, `systemctl cat`, `systemctl show`, checksums, and the current link mapping. It must then consolidate those 15 files into the stable template and one stable feature configuration, run `daemon-reload`, restart once under a controlled window, and verify service state, effective `WorkingDirectory`, symlink targets, and `/login`.

No release retention deletion occurs during migration. If migration health fails, restore the complete backed-up unit and all 15 drop-ins, daemon-reload, restart, and verify the pre-migration release. The migration backup remains outside release retention.

## Legacy safe-deploy

`/usr/local/bin/safe-deploy` is not changed by this work. Its `thoidai-work` mapping points to `/srv/thoidai-work`, which differs from the audited immutable-release layout. Before deprecating it, audit cron, timers, wrappers, and operator documentation for callers. Do not silently redirect it.

## This checkpoint

The scripts and tests may be committed and pushed. Production validation is limited to `release-retention.sh --dry-run`. Do not install the stable unit, create or rotate production symlinks, restart or deploy production, delete releases/worktrees, touch database/Docker, or delete backups until the migration checkpoint is separately approved.
