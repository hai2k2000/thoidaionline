# Bounded Production Release Lifecycle Design

## Status

- Approved architecture: stable `current`, `previous`, and `rollback-2` symlinks.
- Implementation checkpoint: scripts, tests, production retention dry-run, commit, and push.
- Explicitly excluded from this checkpoint: systemd migration, production restart, production deployment, database changes, Docker cleanup, backup deletion, and development worktree deletion.

## Objective

Bound disk growth caused by immutable releases and long-lived development worktrees while preserving atomic activation, two known-good rollback releases, failed-release forensics, and uninterrupted production service.

The normal production steady state is:

```text
/opt/releases/thoidai-work/
  current     -> RELEASE_A
  previous    -> RELEASE_B
  rollback-2  -> RELEASE_C
  RELEASE_A/
  RELEASE_B/
  RELEASE_C/
  [optional explicitly protected release]/
  ops-backups/                     # outside release retention
```

## Audited Current State

### Production runtime

- Service: `thoidai-work.service`.
- Port: `3001`.
- Health route: `http://127.0.0.1:3001/login`.
- Effective production release at audit time: `/opt/releases/thoidai-work/4e22ee6314ffd3e26ab94b0dbf74be14a4075c9d-online-work-month-end-20260921T031920Z`.
- The effective service state was `active/running`, `NRestarts=0`.

These audited paths are bootstrap inputs for the future migration only. They must not be hard-coded into lifecycle scripts.

### Current deploy mechanism

There is no canonical deploy command for immutable `thoidai-work` releases. Recent releases were produced by manual command sequences and activated by adding a new systemd drop-in whose filename sorts after earlier drop-ins.

The installed service currently loads 16 drop-ins. Multiple drop-ins independently override:

- `WorkingDirectory` with a historical immutable release path;
- `ReadWritePaths` with that release's `.next/cache` path;
- feature environment flags.

The last lexically ordered drop-in wins. Old drop-ins remain live configuration references even when their release is no longer running. This makes old releases unsafe to remove and causes configuration history to grow on every rollout.

`/usr/local/bin/safe-deploy` is not the immutable release deploy tool. Its `thoidai-work` mapping points to `/srv/thoidai-work` and only attempts a service restart after a backup check. It remains unchanged in this checkpoint and is documented as legacy pending a separate usage audit/deprecation decision.

### Disk growth evidence

- 15 retained releases consumed approximately 11.60 GiB.
- Average release size was approximately 792 MiB, with an observed range of 737-844 MiB.
- A representative release contains approximately 596 MiB of `node_modules` and 137-242 MiB of `.next`.
- Files inspected across releases had different inodes and link count 1, proving physical duplication rather than shared hard links.
- Large development worktrees averaged approximately 750 MiB.
- A deploy that creates both a large worktree and an immutable release commonly adds approximately 1.5 GiB.

## Root Cause

Disk use grows without a bound because four lifecycle controls are absent:

1. No stable runtime pointer; each deploy writes another release-specific systemd drop-in.
2. No release retention after a successful deploy.
3. No canonical deploy/rollback command with failure cleanup and locking.
4. No separate, conservative development worktree cleanup command.

The duplicated `node_modules` and `.next` directories dominate per-release size, but immutable releases remain the chosen rollback unit. Retention, not unsafe sharing or deletion of dependencies from live releases, provides the primary bound.

## Scope

### In scope

- A production deploy script with disk guard, exclusive lock, temporary workspace cleanup, release metadata, atomic activation, health check, automatic rollback, and post-success retention.
- A release retention script with dry-run default and explicit apply mode.
- A rollback script using the same symlink semantics and lock.
- A separate development worktree cleanup script with dry-run default.
- Unit/integration tests using isolated temporary filesystems and command fakes.
- A stable systemd unit/drop-in template for the later migration.
- A documented systemd migration and rollback plan.
- A production retention dry-run only.

### Out of scope

- Applying the systemd migration.
- Restarting or deploying production during this checkpoint.
- Changing database schema, Supabase/Postgres data, Docker volumes, `.env` files, credentials, SSH configuration, backups, or `/swapfile`.
- Automatically deleting development worktrees from release retention.
- Modifying or deleting `/usr/local/bin/safe-deploy`.
- Reworking Next.js dependency packaging or adopting containers.

## Fixed Symlink Semantics

The following meanings are invariant across deploy, rollback, retention, health checks, tests, and operational documentation:

```text
current     = production intended to be running now
previous    = production immediately before current
rollback-2  = production immediately before previous
```

All symlinks use absolute targets inside the configured release root. A symlink target must be an existing validated release directory.

The scripts never point `current` to a staging directory or nonexistent path. Atomic replacement uses a temporary symlink in the same directory followed by `mv -Tf`:

```bash
ln -s "$target" "$link.new"
mv -Tf "$link.new" "$link"
```

Creating the temporary symlink without `-f` makes unexpected leftovers fail closed. Trap cleanup removes only temporary link names created by the current process.

## Release Layout and Identity

Release directories are immediate children of the configured release root and must match a strict release ID grammar:

```text
^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$
```

The following names are never release candidates:

```text
current
previous
rollback-2
ops-backups
build-evidence
```

Every newly created release contains `.release-meta` in shell-compatible `KEY=VALUE` form with values single-quoted and safely escaped:

```text
release_id
commit
branch
created_at
deployed_at
source_worktree
build_id
```

`deployed_at` is empty until activation succeeds. Metadata is written through a temporary file and atomically renamed. Scripts treat invalid or missing metadata as `REVIEW`; retention does not require legacy releases to be deleted.

The release also requires:

- a non-empty `.next/BUILD_ID`;
- `package.json` and `node_modules`;
- valid environment symlinks verified by `/opt/ops/thoidai-work/verify-release-env.sh` when that verifier is present;
- no embedded environment files copied from the source.

## Configuration

Scripts accept environment overrides for tests, while production defaults are centralized in `scripts/production/release-common.sh`:

```text
THOIDAI_RELEASE_ROOT=/opt/releases/thoidai-work
THOIDAI_SOURCE_REPO=/opt/thoidai-work
THOIDAI_BUILD_ROOT=/opt/build/thoidai-work
THOIDAI_SERVICE=thoidai-work.service
THOIDAI_HEALTH_URL=http://127.0.0.1:3001/login
THOIDAI_LOCK_FILE=/run/lock/thoidai-work-deploy.lock
THOIDAI_DESIRED_FREE_GIB=15
THOIDAI_HARD_MIN_FREE_GIB=10
THOIDAI_ESTIMATED_RELEASE_GIB=2
```

`THOIDAI_ESTIMATED_RELEASE_GIB=2` covers the observed approximately 0.8 GiB immutable release plus temporary build overhead and variance. Operators may raise it without editing script logic.

## Shared Safety Primitives

`release-common.sh` owns the following interfaces so deploy, rollback, and retention cannot diverge:

- strict path containment and release ID validation;
- symlink target resolution;
- release validation;
- atomic symlink replacement;
- free-space calculation;
- lock acquisition;
- service health checks;
- metadata read/write helpers;
- process, open-file, systemd, mount, and container reference checks.

All mutating scripts use `set -Eeuo pipefail`. Read-only classification helpers return structured statuses rather than relying on human parsing.

The deploy and rollback scripts acquire an exclusive non-waiting `flock` on the same lock file. A concurrent operation exits without changing state. Retention `--apply` acquires the same lock; retention dry-run does not need to block deployment, but marks transient or uncertain candidates `REVIEW`.

## Disk Guard

Before creating a build workspace, deploy calculates:

```text
required_before_build = hard_min_free + estimated_release_space
```

Rules:

1. If free space is at least `desired_free + estimated_release_space`, continue.
2. If free space is at least `hard_min_free + estimated_release_space` but below the desired threshold, run retention classification. Safe cleanup may run only when deploy was invoked with explicit permission to apply pre-build retention; otherwise abort with the dry-run report.
3. If free space is below `hard_min_free + estimated_release_space`, abort before installing dependencies or building.

Default thresholds therefore require at least 12 GiB free before starting a build, while the healthy desired headroom is 17 GiB. The post-deploy disk check warns below the desired threshold and fails the deploy finalization if free space is below the hard minimum.

Error output includes actual free GiB, estimated build/release requirement, configured minimums, and the retention dry-run command.

## Deploy Flow

The deploy command accepts an explicit Git commit or ref and an optional human-readable release suffix. It never deploys an uncommitted working tree.

1. Acquire the shared exclusive lock.
2. Validate configuration, release root, source repository, service name, and health URL.
3. Resolve the supplied ref to a full commit and record its branch/ref label without evaluating shell content.
4. Run the disk guard before creating a build directory.
5. Create a temporary build worktree beneath `THOIDAI_BUILD_ROOT` using the resolved commit.
6. Install dependencies with the repository lockfile and build Next.js.
7. Validate the build output.
8. Create the immutable release through a temporary sibling directory.
9. Copy only the required application source/runtime files; exclude `.git`, environment files, backups, existing releases, temporary artifacts, and prior `.next` backups.
10. Include built `.next` and production dependencies. Rename the completed temporary release atomically to its final release ID.
11. Link approved environment files and shared storage using the established verifier and ownership model.
12. Write `.release-meta` with empty `deployed_at`.
13. Validate the final release path.
14. Snapshot the exact existing `current`, `previous`, and `rollback-2` link targets. Missing links are represented explicitly, not guessed.
15. Atomically set `current` to the new release. Do not change `previous` or `rollback-2` yet.
16. Perform a controlled service restart.
17. Require service active state and HTTP health success.
18. On success, atomically finalize links:
    - `rollback-2` becomes the pre-deploy `previous` target, when one existed;
    - `previous` becomes the pre-deploy `current` target, when one existed;
    - `current` remains the new release.
19. Set `deployed_at` atomically in the new release metadata.
20. Run release retention in apply mode only after link finalization and a repeated health check.
21. Remove the temporary build worktree and workspace through the exit trap.
22. Run the final service, HTTP, symlink, and disk checks.

The initial bootstrap migration creates all three symlinks before this deploy flow is enabled, so normal operation always starts with a complete rollback chain.

## Failed Deployment Recovery

If activation or health check fails after `current` changed:

1. Do not rotate `previous` or `rollback-2`.
2. Atomically restore every symlink to the exact pre-deploy snapshot. A previously absent link is removed only if the current operation created it and the stored snapshot says it was absent.
3. Perform a controlled restart.
4. Require service active state and HTTP health success against the restored `current`.
5. Keep the failed release directory and write a `.keep` file explaining that it is retained for failed-deploy forensics.
6. Exit non-zero and do not run retention.

If the recovery health check also fails, the script exits with a critical message containing the saved link targets and does not attempt further mutation.

The exit trap may remove only the temporary build worktree, incomplete temporary release directory, and temporary symlink files. It must never remove a finalized or activated release.

## Manual Rollback Flow

Rollback uses the same exclusive lock and fixed symlink semantics.

Precondition: `current`, `previous`, and `rollback-2` all resolve to valid releases.

The rollback operation snapshots all links, then:

```text
current     <- old previous
previous    <- old current
rollback-2  <- old rollback-2
```

This makes the just-replaced release the immediate reactivation option while preserving the older rollback release. Activation of the new `current` is atomic, followed by controlled restart and health checks. `previous` is finalized only after the rolled-back release passes health.

If rollback health fails, all three links are restored to the exact snapshot, the service is restarted again, and health is checked. No retention runs during rollback.

Rollback accepts an optional explicit target only when that target is exactly one of the existing `previous` or `rollback-2` targets. Arbitrary release activation remains a separate, explicit recovery procedure.

## Release Retention

`release-retention.sh` defaults to `--dry-run`. No arguments and `--dry-run` are equivalent. Deletion requires the exact `--apply` flag; unknown flags fail.

The script scans only immediate child directories matching the release ID grammar. It never recurses into or classifies `ops-backups`, backup roots, symlink names, build evidence, files, or hidden temporary directories.

Classification precedence is:

1. `KEEP` if target of `current`, `previous`, or `rollback-2`.
2. `KEEP` if `.keep` exists.
3. `REVIEW` if a symlink is broken, outside the release root, duplicated across lifecycle links unexpectedly, or a release identity/path cannot be proven.
4. `KEEP` if a process uses the release path.
5. `KEEP` if `lsof` reports an open file in the release.
6. `KEEP` if effective or installed systemd configuration contains the exact release path.
7. `KEEP` if the path is a mount target/source or a container mount reference.
8. `REVIEW` if any required inspection tool fails or evidence is incomplete.
9. `DELETE` only when every exclusion check completed successfully and found no reference.

Age and directory count are display metadata only and never sufficient deletion evidence.

Dry-run output uses one record per candidate:

```text
KEEP   <path> current
KEEP   <path> protected:.keep
DELETE <path> old-unused
REVIEW <path> systemd-check-failed
```

In apply mode, each `DELETE` candidate is reclassified immediately before removal while holding the shared lock. It is removed only if still `DELETE`. After each removal, the script verifies the path is absent and runs a non-restarting service/HTTP health check. Any failure stops the batch.

The script refuses to operate when lifecycle symlinks are absent unless invoked in dry-run bootstrap mode. Bootstrap dry-run reports all legacy releases as `REVIEW legacy-unmanaged`, except explicit protected or systemd/process-referenced releases. This prevents the implementation checkpoint from selecting production releases before migration.

## Protection Mechanism

A release is explicitly pinned by a root-owned `.keep` file inside that release. The file contains a one-line reason and optional expiry date. Retention does not interpret expiry automatically; removal of protection is a deliberate operator action.

Example:

```text
failed deployment 2026-09-21; retain for investigation
```

## Development Worktree Cleanup

`worktree-cleanup.sh` is independent of release retention and defaults to dry-run. It scans registered worktrees beneath the configured worktree root and excludes the main checkout.

Classification:

- `KEEP`: dirty tracked files, untracked files, active process/open file, explicitly protected marker, or the current script worktree.
- `REVIEW`: detached HEAD whose remote reachability is not proven, branch without upstream, missing remote ref, remote check failure, or path not registered with Git.
- `DELETE`: clean worktree, no untracked data, inactive, branch HEAD reachable from its configured upstream remote ref.

Apply mode revalidates and removes only `DELETE` entries with:

```bash
git -C "$repo" worktree remove "$path"
git -C "$repo" worktree prune
```

It never uses forced removal and never deletes a branch.

## Stable Systemd Configuration

The repository gains a stable service template whose release-sensitive paths use:

```ini
WorkingDirectory=/opt/releases/thoidai-work/current
ExecStartPre=/usr/bin/test -f /opt/releases/thoidai-work/current/.next/BUILD_ID
ReadWritePaths=/opt/thoidai-work/storage
ReadWritePaths=/opt/releases/thoidai-work/current/.next/cache
ReadWritePaths=/var/lib/thoidai-work
ReadWritePaths=/var/cache/thoidai-work
ReadWritePaths=/run/thoidai-work
```

The stable template also preserves the active resource and hardening policy: `MemoryHigh=500M`, `MemoryMax=650M`, `TasksMax=250`, `NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectSystem=strict`, `ProtectHome=true`, empty capability sets, and `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6`.

Feature flags remain in one stable feature configuration file. A deployment must never create a release-specific systemd drop-in.

## Systemd Migration Plan

Migration is a separate approval checkpoint after scripts are committed, pushed, and reviewed.

### Preparation

1. Record disk free, inode free, MainPID, NRestarts, effective WorkingDirectory, ExecStart, service state, and `/login` status.
2. Resolve and validate the three bootstrap releases approved by the owner:
   - current: the release actually running at migration time;
   - previous: the approved immediate rollback release;
   - rollback-2: the approved older rollback/reference release.
3. Confirm all three contain valid builds, environment links, dependencies, and health-compatible configuration.
4. Create a timestamped backup outside release retention containing the base unit, the exact `DropInPaths` captured from `systemctl show` (currently 16), `systemctl cat`, `systemctl show`, checksums, and the intended link mapping. Verify every captured path is backed up and the manifest count matches; never rely on an assumed count.
5. Stage the consolidated unit/drop-ins in a temporary directory and run `systemd-analyze verify` where supported.

### Activation

1. Create `current`, `previous`, and `rollback-2` symlinks atomically with the approved bootstrap targets.
2. Replace the accumulated release-specific drop-ins as one filesystem transaction:
   - move the exact captured drop-in set into the timestamped migration backup;
   - install only stable resource/feature configuration and the stable current-symlink configuration;
   - do not add a sixteenth release-specific override.
3. Run `systemctl daemon-reload`.
4. Confirm effective `WorkingDirectory` and writable paths resolve through `current` before restart.
5. Perform one controlled restart.
6. Verify active/running state, stable NRestarts, expected MainPID change, effective configuration, lifecycle symlinks, and HTTP 200.
7. Run retention dry-run only. Do not delete legacy releases as part of the migration transaction.

### Migration success criteria

- `systemctl cat thoidai-work.service` is concise and contains no historical release path.
- Effective `WorkingDirectory` is `/opt/releases/thoidai-work/current`.
- `current` resolves to the same release that ran immediately before migration.
- Production health passes and NRestarts remains stable after the controlled restart.
- All three rollback symlinks resolve to validated releases.

## Systemd Migration Rollback Plan

If any activation or health gate fails:

1. Restore the base unit and the exact captured drop-in set exactly from the timestamped backup.
2. Run `systemctl daemon-reload`.
3. Confirm effective WorkingDirectory equals the pre-migration release path.
4. Perform one controlled restart.
5. Require active/running state and `/login` HTTP 200.
6. Preserve the symlink state and staged files for investigation; they are not used by the restored configuration.
7. Stop without release retention or further cleanup.

The migration backup remains outside release retention and is not automatically deleted.

## Legacy `safe-deploy`

This checkpoint does not modify `/usr/local/bin/safe-deploy`. The implementation documentation marks its `thoidai-work` path as obsolete relative to the audited production layout and requires a separate read-only usage check across cron, systemd timers, shell wrappers, and documented operator commands before deprecation.

If no caller exists, a later change may make `safe-deploy thoidai-work` exit with a deprecation message pointing to the canonical deploy command. It must not silently invoke the new deploy flow without an explicit migration.

## Logging and Audit Output

Scripts emit timestamped, single-line records with operation ID, action, release ID, result, and reason. They never print environment contents or credentials.

Deploy records:

- resolved commit and branch;
- disk guard values;
- release ID and build ID;
- pre/post symlink targets;
- restart and health results;
- retention summary.

Retention and worktree cleanup record every `KEEP`, `DELETE`, and `REVIEW` classification. Apply mode records actual removals separately from candidates.

## Test Strategy

Tests run without systemd, production paths, Docker mutation, or network dependency. Each test creates an isolated temporary release root and provides command fakes through `PATH` or configuration hooks.

### Common and symlink tests

- Reject paths outside the configured release root.
- Reject invalid release IDs and reserved names.
- Atomically replace a symlink without exposing a broken target.
- Preserve exact fixed meanings for all three lifecycle links.
- Restore absent and present links from a snapshot.
- Reject broken or external symlink targets.

### Deploy tests

- Acquire the shared lock and reject a concurrent deploy.
- Abort before build when free space is below hard minimum plus estimated release space.
- Abort or require explicit cleanup permission in the desired-space warning band.
- Build from a resolved commit, not dirty source state.
- Clean temporary workspace on success, build failure, validation failure, and signal.
- Keep a finalized failed release with `.keep` after activation failure.
- Do not rotate `previous`/`rollback-2` before new health passes.
- On success, rotate links to current/new, previous/old-current, rollback-2/old-previous.
- On failure, restore the exact prior link snapshot and skip retention.
- Update `deployed_at` only after health passes.

### Rollback tests

- Activate old `previous` atomically.
- Keep old `current` as new `previous` after rollback passes.
- Preserve `rollback-2`.
- Restore all links when rollback health fails.
- Never invoke retention.

### Retention tests

- No arguments behaves exactly like `--dry-run`.
- `--apply` is required for deletion.
- Keep all three lifecycle targets.
- Keep `.keep` releases.
- Exclude `ops-backups`, symlinks, files, reserved and temporary names.
- Keep process/open-file/systemd/mount/container referenced releases.
- Convert tool errors or incomplete evidence to `REVIEW`.
- Mark a fully proven unused release `DELETE`.
- Revalidate immediately before apply deletion.
- Stop on post-delete health failure.
- With no bootstrap symlinks, report legacy releases as `REVIEW legacy-unmanaged` and delete nothing.

### Worktree tests

- Keep dirty and untracked worktrees.
- Review detached or no-upstream worktrees.
- Keep process/open-file worktrees.
- Delete only clean, inactive worktrees whose HEAD is reachable from upstream.
- Use `git worktree remove` without force and prune registrations.
- Never remove a Git branch.

### Repository validation

- Shell syntax for every script.
- Shell lint when `shellcheck` is available.
- Focused lifecycle test suite.
- Existing repository lint, TypeScript, and production build if script-only changes do not require dependency installation beyond the lockfile.
- Secret/runtime artifact scan before commit.

### Production-safe validation

- Run only `release-retention.sh --dry-run` against production.
- Before migration, all unmanaged legacy releases must be `REVIEW legacy-unmanaged`, with production/systemd/protected releases additionally identified as `KEEP` when evidence is available.
- Confirm dry-run makes no filesystem, service, symlink, or process changes.
- Recheck disk, service, MainPID, NRestarts, WorkingDirectory, and `/login` after dry-run.

## Expected Deliverables for This Checkpoint

- Design specification and implementation plan.
- Shared lifecycle library.
- Deploy, rollback, release retention, and worktree cleanup scripts.
- Stable systemd configuration template for future migration.
- Automated isolated tests and test fixtures.
- Operator documentation covering deploy, rollback, retention, protection, disk thresholds, and migration.
- Production retention dry-run report.
- Dedicated branch with all changes committed and pushed.
- No production restart, deployment, systemd migration, release deletion, worktree deletion, database operation, or Docker mutation.

## Acceptance Criteria

This implementation checkpoint is complete when:

1. All scripts implement the fixed symlink semantics and share one lock/configuration layer.
2. Automated tests prove atomic activation, failure restoration, disk guard, dry-run default, conservative retention, and worktree protections.
3. Production retention dry-run deletes nothing and provides `KEEP`/`DELETE`/`REVIEW` classifications appropriate to the pre-migration legacy state.
4. The branch is clean, committed, and pushed.
5. Production health remains unchanged.
6. The systemd migration and rollback plans are documented but not executed.
