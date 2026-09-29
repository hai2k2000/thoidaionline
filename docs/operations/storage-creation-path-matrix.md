# Storage Resource Creation-Path Matrix

| Resource | Creator | Purpose | Metadata/guard | Finalize/Clean | Current bypass risk |
|---|---|---|---|---|---|
| `/opt/worktrees/*` | `scripts/ops/worktree-lifecycle.sh create` through the canonical lifecycle helper; direct Git creation is unsupported | Feature/recovery source checkout | `.thoidai-lifecycle`, worktree budget/free-disk guard | `close` -> shrink; cleanup requires READY_FOR_CLEANUP | Direct `git worktree add` or Codex-managed worktree can bypass this script |
| `/opt/build/thoidai-work/*` | `deploy-release.sh` disposable Git build workspace | npm install/build | disk/category budget guard; build helper metadata | EXIT trap removes success/failure workspace or records short debug TTL | Alternate build scripts can bypass helper |
| `/opt/releases/thoidai-work/*` | `deploy-release.sh` | Runtime and rollback artifact | artifact warn/hard max; runtime packaging allowlist | retention report and explicit approved apply | Manual copy into release root can bypass packaging |
| Docker build containers/images | Docker/compose workflows | Build/runtime image | existing Docker guard; disposable resources should carry labels | explicit labeled image candidate review | Unlabelled build workflows remain review/KEEP |
| Docker volumes | Docker/compose/recovery | DB, storage, recovery, temporary state | production/recovery/unknown always KEEP | no automatic deletion | intentionally no volume cleanup path |

## Required migration

Feature/deploy workflows should call the canonical worktree and build helpers. Direct creation paths are classified as lifecycle debt until migrated; unknown metadata is never eligible for automatic cleanup.