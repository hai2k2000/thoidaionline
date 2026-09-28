# Storage Lifecycle Root-Cause Hardening Design

**Goal:** Prevent recurring storage bloat by enforcing lifecycle metadata, shrink-before-remove worktree handling, disposable builds, runtime-only release packaging, category budgets, and fail-closed creation guards.

## Contract

Every resource follows `CREATE -> USE -> FINALIZE -> CLEAN`. Managed worktrees carry `.thoidai-lifecycle` metadata with path, branch, commit, timestamps, purpose, owner/tool, protection, build requirement, and lifecycle state. Unknown state is always kept.

## Components

- `scripts/ops/worktree-lifecycle.sh`: canonical create/status/close/shrink/remove operations.
- `scripts/ops/storage-budget-guard.sh`: free-space, category-size, and active-count gates used before creation.
- `scripts/ops/storage-debt-report.sh`: separates source-only bytes from reproducible `node_modules`, `.next`, cache, and build bytes.
- `scripts/production/build-workspace.sh`: disposable build workspace helper with trap cleanup and short debug TTL.
- `scripts/production/artifact-size-guard.sh`: expected/suspicious/blocked classification with largest paths.
- `scripts/production/deploy-release.sh`: calls budget guard before install, uses ephemeral build workspace, and packages runtime-only files.
- Existing Docker/log guards remain read-only for volumes and use labels/allowlists for disposable resources.

## Safety

Dirty source is never removed by shrink. Remove requires clean, recoverable, non-protected, non-referenced worktree metadata. Production, recovery, Supabase, and unknown volumes are always KEEP. All reports default to dry-run. No production installation or cleanup is part of this implementation.

## Budgets

Defaults are conservative and configurable through environment variables: `WORKTREE_MAX_TOTAL_BYTES=20GiB`, `BUILD_MAX_TOTAL_BYTES=8GiB`, `RELEASE_MAX_TOTAL_BYTES=8GiB`, `MIN_FREE_DISK_BYTES=10GiB`, `MAX_ACTIVE_WORKTREES=32`, `ARTIFACT_WARN_BYTES=512MiB`, `ARTIFACT_HARD_MAX_BYTES=768MiB`.

## Verification

Tests prove worktree close shrinks reproducible artifacts but preserves dirty source, build cleanup on success/failure, oversized artifact rejection, worktree/build/free-disk budget refusal, dirty source preservation, protected/unknown volume KEEP behavior, and production dry-run with `Production changed: NO`.