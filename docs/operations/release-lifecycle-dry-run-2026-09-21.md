# Release Lifecycle Production Dry-Run Evidence

Date: 2026-09-21
Branch: `ops/bounded-release-lifecycle`
Mode: `release-retention.sh --dry-run`

## Result

The production dry-run made no changes. All 15 unmanaged release directories were classified `REVIEW legacy-unmanaged` because the systemd migration that establishes `current`, `previous`, and `rollback-2` has not been executed. The scanner excluded `ops-backups` and `build-evidence` from candidates. The release-directory count is distinct from the active systemd drop-in count: production currently has 16 drop-ins.

No release or worktree was deleted. No symlink was created or rotated. No service, systemd unit, database, Docker object, backup, environment file, or credential changed.

## Health before and after

| Check | Result |
| --- | --- |
| Disk | `/dev/sda2`, `15G` available, `83%` used |
| Service | `active/running` |
| MainPID | `3387259` |
| NRestarts | `0` |
| WorkingDirectory | `/opt/releases/thoidai-work/4e22ee6314ffd3e26ab94b0dbf74be14a4075c9d-online-work-month-end-20260921T031920Z` |
| `/login` | HTTP `200` |
| Reserved directory scan | PASS; `ops-backups` and `build-evidence` excluded |

## Classification

```text
REVIEW legacy-unmanaged: all existing release directories
DELETE: none
KEEP: none via lifecycle links because migration has not established the links
```

The conservative `REVIEW` result is intentional. It prevents retention from inferring ownership from historical directory names or from the current systemd drop-in stack.

## Next checkpoint

Review the stable systemd migration plan and its rollback plan before any production change. This evidence does not authorize migration, restart, deploy, symlink creation, release deletion, worktree deletion, database operation, or Docker mutation.
