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

The production migration is not part of the implementation checkpoint. The audited production configuration contains 16 accumulated drop-ins. Migration must first capture the actual `DropInPaths` from `systemctl show`, copy exactly that captured set plus the base unit, `systemctl cat`, `systemctl show`, checksums, and the current link mapping into a root-only backup outside release retention. The backup is complete only when every captured path exists in the manifest and the manifest count matches the captured count; do not rely on an assumed count. It must then consolidate the 16 files into the stable template and one stable feature configuration, run `daemon-reload`, restart once under a controlled window, and run the bounded readiness gate before accepting the migration.

The 16 paths active at owner review are:

```text
10-memory-guard.conf
100-j6-release.conf
20-role-lifecycle.conf
30-checkpoint4-1-release.conf
40-checkpoint-permission-ui-release.conf
50-org-rbac-r3-retry-release.conf
60-j2p-envretry-release.conf
70-j3c-release.conf
80-j4c-release.conf
90-j5f-release.conf
zz-j6-release.conf
zzz-j6-auth-recovery-j5f.conf
zzzz-j6-auth-recovery-corrected.conf
zzzzz-j6-task-detail-hotfix-final.conf
zzzzzz-j6-gate12-error-mapping.conf
zzzzzzz-online-work-month-end.conf
```

This inventory is review evidence, not the migration source of truth. The captured runtime `DropInPaths` set is authoritative.

No release retention deletion occurs during migration. If migration health fails, restore the complete backed-up unit and the exact captured drop-in set, daemon-reload, restart, and verify the pre-migration release. The migration backup remains outside release retention.

### Approved bootstrap mapping

Before mutation, fail closed unless every target passes path containment, directory, `.next/BUILD_ID`, `package.json`, `node_modules`, and environment-link validation:

```text
current -> 4e22ee6314ffd3e26ab94b0dbf74be14a4075c9d-online-work-month-end-20260921T031920Z
previous -> e88d16942a78f416f2e6de27cad5cb94c3146d94-j6-gate12-error-mapping-20260921T014731Z
rollback-2 -> d66f69898e63cde8ae4d9f1eff7adbc4c8028da2-j6-task-detail-hotfix-envlinks-20260920T183314Z
```

The bootstrap mapping is documentation/configuration readiness only in this checkpoint; it does not create production symlinks.

The operator validation command accepts exactly three paths and validates all three before any symlink or systemd mutation:

```bash
scripts/production/validate-bootstrap.sh \
  /opt/releases/thoidai-work/4e22ee6314ffd3e26ab94b0dbf74be14a4075c9d-online-work-month-end-20260921T031920Z \
  /opt/releases/thoidai-work/e88d16942a78f416f2e6de27cad5cb94c3146d94-j6-gate12-error-mapping-20260921T014731Z \
  /opt/releases/thoidai-work/d66f69898e63cde8ae4d9f1eff7adbc4c8028da2-j6-task-detail-hotfix-envlinks-20260920T183314Z
```

### Pre-migration capture and readiness gate

The migration operator must run the fail-closed capture helper before any mutation. It records the actual service fragment and `DropInPaths`, copies them with absolute-path layout into a root-only backup, verifies every captured file, and writes checksums:

```bash
BACKUP=/opt/thoidai-backups/thoidai-work-lifecycle-<timestamp>
scripts/production/capture-systemd-baseline.sh "$BACKUP"
test "$(cat "$BACKUP/dropin-count.txt")" -eq 16
```

If the captured count is not 16 at this reviewed baseline, stop and re-review the changed production configuration. Rollback restores `rootfs$(cat fragment-path.txt)` and every absolute path in `dropin-paths.txt`; it must not restore from a manually reconstructed filename list.

The rollback window must first move the newly installed stable unit/drop-ins into a separate failed-migration evidence directory, then restore only from the captured manifest:

```bash
FRAGMENT=$(cat "$BACKUP/fragment-path.txt")
install -m 0644 "$BACKUP/rootfs$FRAGMENT" "$FRAGMENT"
while IFS= read -r path; do
  test -f "$BACKUP/rootfs$path" || { echo "backup incomplete: $path" >&2; exit 1; }
  install -D -m 0644 "$BACKUP/rootfs$path" "$path"
done < "$BACKUP/dropin-paths.txt"
test "$(wc -l < "$BACKUP/dropin-paths.txt")" -eq "$(cat "$BACKUP/dropin-count.txt")"
```

Do not leave stable migration drop-ins beside the restored captured set: they must already have been moved to the failed-migration evidence directory before these restore commands. Then run `daemon-reload`, restart once, and execute the same readiness checks against the recorded pre-migration release path.

Because the service is `Type=simple`, `active/running` is not application readiness. After restart, run `scripts/production/migration-readiness.sh`. It records a timestamp, MainPID, and NRestarts baseline, then polls TCP and `/login` at a bounded interval (default total timeout 30 seconds in the migration window) instead of treating the first connection refusal as terminal. It fails immediately for a failed service state or restart-loop signal, and fails with elapsed time, last TCP/HTTP result, service state, MainPID, and NRestarts when the deadline expires. Once TCP and HTTP are healthy it verifies unchanged NRestarts/MainPID over the stability window, `WorkingDirectory` resolving through `/opt/releases/thoidai-work/current`, release environment validation, and effective `MemoryHigh=500M`, `MemoryMax=650M`, `TasksMax=250`.

The hardening validator is fail-closed and distinguishes a missing property from an explicit empty value. `CapabilityBoundingSet=` and `AmbientCapabilities=` must be present and effective-empty; missing or non-empty values fail. Other required security properties must be present with their expected non-empty values, including `NoNewPrivileges=yes`, `PrivateTmp=yes`, `ProtectSystem=strict`, `ProtectHome=yes`, and `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX` (systemd may normalize the address-family order when queried; the validator compares the effective normalized value).

## Legacy safe-deploy

`/usr/local/bin/safe-deploy` is not changed by this work. Its `thoidai-work` mapping points to `/srv/thoidai-work`, which differs from the audited immutable-release layout. Before deprecating it, audit cron, timers, wrappers, and operator documentation for callers. Do not silently redirect it.

## This checkpoint

The scripts and tests may be committed and pushed. Production validation is limited to `release-retention.sh --dry-run`. Do not install the stable unit, create or rotate production symlinks, restart or deploy production, delete releases/worktrees, touch database/Docker, or delete backups until the migration checkpoint is separately approved.
