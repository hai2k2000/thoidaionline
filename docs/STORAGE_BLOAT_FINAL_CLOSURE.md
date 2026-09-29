# Storage Bloat Final Closure

Date: 2026-09-29
Branch: ops/storage-bloat-hardening

## Outcome

Root-cause prevention is active in production. The final closure phase preserved
all VPS-only source/document material remotely, retired the stale recovery
server gracefully, and removed only independently verified managed worktrees.
No application feature code was deployed.

## Preservation

- `journalism-tasks-j2-schema-read` was committed and pushed as `bf0bfec299a83da8f7f3142664ae8ba58ac40b51`.
- `archive/release-integration-validation-20260929` preserves the staged integration state as `8c3ff4761aa89a2c2ab095c89ffb9ecc70bce42c`.
- `archive/org-rbac-r2-narrow-reconciliation-20260929` preserves the incomplete test as `5ec0f007a8179e7f8030b36c843c859ac1cc3a8b`. The test remains WIP: 1/7 passed and 6/7 failed because dependencies were absent; no production readiness is claimed.
- `archive/task-assignment-batch-sdd-20260929` preserves three historical SDD scratch ledgers as `777e11abaaff8a24f8ba98f7fbfc34430f7d0f75`.

Each preservation commit was verified against its remote ref.

## Recovery Retirement

`recovery-smoke-20260928` was verified clean, remotely recoverable, detached from production/recovery routing, and listening only on `127.0.0.1:3012` with no connections. PID `1478585` was terminated with SIGTERM and exited within the bounded wait; SIGKILL was not used. Canonical lifecycle adoption and shrink completed without changing HEAD `3743f34241c4ad3fca1c280b5d37b57be51e1a67`.

- Before: `839,588,470` bytes
- After: `127,869,993` bytes
- Reclaimed: `711,718,477` bytes

## Managed Worktree Removal

Sixteen worktrees were independently revalidated as clean, remotely recoverable, inactive, unopened, unreferenced, and `READY_FOR_CLEANUP`, then removed with canonical lifecycle tooling. No remote branch or Git history was deleted. The path-size reclaim for this batch was `682,695,531` bytes.

Total measured reclaim in this closure phase: `1,394,414,008` bytes.

## Retained and Deferred

- `/opt/thoidai-work` was not modified. Its dirty source and reproducible data remain protected under `DEFERRED_PROTECTED_CHECKOUT_HYGIENE`.
- The four preserved worktrees remain available for owner follow-up: `journalism-tasks-j2-schema-read`, `release-integration-validation`, `org-rbac-r2-narrow-reconciliation`, and `task-assignment-batch`.
- Production releases, rollback pointers, backups, Docker images, Docker volumes, production DB, and recovery DB were not modified.

## Safeguards

Verified active on the VPS:

- managed-worktree gate and lifecycle metadata validation
- worktree/build/release storage budgets and disk gate
- artifact-size guard
- disposable build workspace/finalizer and bounded build retention
- daily read-only storage inventory timer
- weekly dry-run storage audit timer
- destructive cleanup remains owner-approval-only; no automatic apply timer

Lifecycle and guard tests passed during the closure review. Final production health was `active/running`, `NRestarts=0`, `/login=200`, port `3001` healthy, and current/previous/rollback pointers valid. Production and recovery database volumes remained present.
