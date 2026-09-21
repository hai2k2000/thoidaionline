# Bounded Production Release Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tested, locked, disk-aware release/rollback/retention lifecycle without changing production systemd configuration during this checkpoint.

**Architecture:** Shell scripts share `release-common.sh` for configuration, lock acquisition, path safety, symlink operations, metadata, health checks, and conservative reference checks. `deploy-release.sh`, `rollback-release.sh`, `release-retention.sh`, and `worktree-cleanup.sh` remain separate commands with dry-run defaults where deletion is possible. The existing production unit is not changed; a stable future unit template and migration runbook are documented.

**Tech Stack:** Bash, coreutils, Git worktrees, `flock`, systemd inspection commands, `curl`, Next.js/npm build commands, POSIX temporary directories.

**Spec:** `docs/superpowers/specs/2026-09-21-bounded-release-lifecycle-design.md`

## Global Constraints

- Do not run production systemd migration, restart, deploy, database operation, Docker prune, backup deletion, or worktree deletion in this checkpoint.
- `current`, `previous`, and `rollback-2` always mean current production, immediately previous production, and the release before previous.
- Retention defaults to `--dry-run`; only explicit `--apply` may delete proven-unused releases.
- Release retention never scans `ops-backups`, backup roots, systemd drop-ins, or development worktrees as release candidates.
- Worktree cleanup is separate from release retention and never force-removes dirty/untracked/no-upstream worktrees.
- Every destructive operation revalidates its candidate while holding the shared lock.
- Never print environment values, credentials, or private keys.
- Every completed task must pass focused validation, be committed, and be pushed to `origin/ops/bounded-release-lifecycle`.

---

### Task 1: Shared lifecycle library and test harness

**Files:**
- Create: `scripts/production/release-common.sh`
- Create: `scripts/production/tests/test_helpers.sh`
- Create: `scripts/production/tests/release-common.test.sh`
- Modify: `PROJECT_STATUS.md`

**Interfaces:**
- `release-common.sh` exports configuration variables and functions: `die`, `log_event`, `require_config`, `validate_release_id`, `assert_release_path`, `resolve_link_target`, `atomic_link`, `snapshot_links`, `restore_links`, `acquire_lock`, `free_gib`, `disk_guard`, `validate_release`, `health_check`, `systemd_references`, `process_references`, `open_file_references`, `mount_references`, and `container_references`.
- Test helpers create an isolated root, fake command directory, and deterministic service/HTTP responses.

- [ ] **Step 1: Write failing tests for fixed symlink semantics and path safety.**

  Add tests that create `current`, `previous`, and `rollback-2`, assert each resolves to the expected directory, reject an external target, reject reserved/invalid release IDs, and prove `atomic_link` leaves the old link intact when the target is invalid.

- [ ] **Step 2: Run the focused test to verify the expected failure.**

  Run:

  ```bash
  bash scripts/production/tests/release-common.test.sh
  ```

  Expected: FAIL because `release-common.sh` does not yet exist or the required functions are unavailable.

- [ ] **Step 3: Implement the minimal shared library.**

  Use strict mode, configurable paths, same-directory temporary symlink names, `mv -Tf`, `flock -n`, integer byte/GiB calculations, and explicit `REVIEW` outcomes for unavailable inspection tools. Keep all production defaults overridable by environment variables.

- [ ] **Step 4: Run the focused test to verify it passes.**

  Run the same command and require all assertions to pass with no production path access.

- [ ] **Step 6: Commit and push.**

  ```bash
  git add scripts/production/release-common.sh scripts/production/tests/test_helpers.sh scripts/production/tests/release-common.test.sh PROJECT_STATUS.md
  git commit -m "feat: add bounded release lifecycle primitives"
  git push
  ```

### Task 2: Conservative release retention

**Files:**
- Create: `scripts/production/release-retention.sh`
- Create: `scripts/production/tests/release-retention.test.sh`
- Modify: `scripts/production/release-common.sh`

**Interfaces:**
- `release-retention.sh [--dry-run|--apply]` prints one `KEEP`, `DELETE`, or `REVIEW` record per immediate release directory and exits non-zero for invalid options or unsafe apply conditions.
- It consumes shared link/reference helpers and never follows or deletes symlinks.

- [ ] **Step 1: Write failing tests for dry-run default and conservative classification.**

  Fixture cases must cover: no arguments equals `--dry-run`; current/previous/rollback-2 are `KEEP`; `.keep` is `KEEP`; `ops-backups` is not scanned; process/open-file/systemd/mount/container references are `KEEP`; unavailable evidence is `REVIEW`; a clean unreferenced release is `DELETE`; missing bootstrap symlinks classify legacy releases as `REVIEW legacy-unmanaged`; `--apply` is the only mode that removes a candidate.

- [ ] **Step 2: Run the focused test and confirm it fails for the missing command.**

  ```bash
  bash scripts/production/tests/release-retention.test.sh
  ```

- [ ] **Step 3: Implement retention classification and apply mode.**

  Scan only immediate children matching the release grammar. Reclassify each candidate immediately before deletion while holding the shared lock, verify absence after deletion, and stop if service/health checks fail. Keep legacy unmanaged releases in `REVIEW` until the systemd migration establishes lifecycle links.

- [ ] **Step 4: Run focused retention tests and inspect output.**

  Require all fixture cases to pass and verify no fixture outside the temporary root is touched.

- [ ] **Step 5: Commit and push.**

  ```bash
  git add scripts/production/release-retention.sh scripts/production/tests/release-retention.test.sh scripts/production/release-common.sh
  git commit -m "feat: add conservative release retention"
  git push
  ```

### Task 3: Deploy and rollback state machine

**Files:**
- Create: `scripts/production/deploy-release.sh`
- Create: `scripts/production/rollback-release.sh`
- Create: `scripts/production/tests/deploy-rollback.test.sh`
- Modify: `scripts/production/release-common.sh`

**Interfaces:**
- `deploy-release.sh <commit-or-ref> [release-suffix]` resolves a clean commit, builds in a temporary Git worktree, validates the release, atomically activates `current`, restarts only when explicitly invoked in a future production execution, rolls links only after health passes, and retains failed releases with `.keep`.
- `rollback-release.sh` activates only the existing `previous` target by default; `--to-rollback-2` explicitly selects the existing `rollback-2` target. It never runs retention.

- [ ] **Step 1: Write failing state-machine tests.**

  Add fixtures for: lock contention; disk guard abort before build; successful rotation (`new -> current`, old current -> previous, old previous -> rollback-2); failed health restoring the exact link snapshot without rotating old links; failed release `.keep`; metadata `deployed_at` set only after success; rollback success and rollback failure restoration; temporary workspace cleanup on exit and failure.

- [ ] **Step 2: Run tests and verify they fail before implementation.**

  ```bash
  bash scripts/production/tests/deploy-rollback.test.sh
  ```

- [ ] **Step 3: Implement deploy and rollback minimally.**

  Use `git worktree add --detach` for the resolved commit, `trap` cleanup for only temporary paths, explicit release directory staging, metadata atomic writes, and a test seam for restart/health commands. Production defaults must require an explicit `THOIDAI_ALLOW_RESTART=1` when the command is eventually used operationally; the implementation checkpoint tests use fakes.

- [ ] **Step 4: Run state-machine tests and shell syntax checks.**

  ```bash
  bash scripts/production/tests/deploy-rollback.test.sh
  bash -n scripts/production/release-common.sh scripts/production/deploy-release.sh scripts/production/rollback-release.sh
  ```

- [ ] **Step 5: Commit and push.**

  ```bash
  git add scripts/production/release-common.sh scripts/production/deploy-release.sh scripts/production/rollback-release.sh scripts/production/tests/deploy-rollback.test.sh
  git commit -m "feat: add locked atomic deploy and rollback"
  git push
  ```

### Task 4: Independent development worktree cleanup

**Files:**
- Create: `scripts/production/worktree-cleanup.sh`
- Create: `scripts/production/tests/worktree-cleanup.test.sh`

**Interfaces:**
- `worktree-cleanup.sh [--dry-run|--apply]` classifies registered worktrees without scanning release directories and removes only clean, inactive, upstream-reachable worktrees through `git worktree remove`.

- [ ] **Step 1: Write failing worktree classification tests.**

  Fixtures must cover dirty, untracked, no-upstream, detached, process-in-use, clean/upstream-reachable, protected, and main-checkout cases. Assert that apply mode never removes branches and never invokes forced removal.

- [ ] **Step 2: Run the test and verify the expected missing-command failure.**

  ```bash
  bash scripts/production/tests/worktree-cleanup.test.sh
  ```

- [ ] **Step 3: Implement dry-run/apply classification.**

  Use Git worktree registrations as the source of truth; verify clean status, remote reachability, process/open-file evidence, and a `.keep` marker before any apply removal. Require the shared lock for apply.

- [ ] **Step 4: Run focused tests and shell syntax checks.**

  ```bash
  bash scripts/production/tests/worktree-cleanup.test.sh
  bash -n scripts/production/worktree-cleanup.sh
  ```

- [ ] **Step 5: Commit and push.**

  ```bash
  git add scripts/production/worktree-cleanup.sh scripts/production/tests/worktree-cleanup.test.sh
  git commit -m "feat: add conservative worktree cleanup"
  git push
  ```

### Task 5: Stable systemd template and operator documentation

**Files:**
- Create: `deploy/systemd/thoidai-work-current.service`
- Create: `docs/operations/release-lifecycle.md`
- Modify: `PROJECT_STATUS.md`

**Interfaces:**
- The service template references `/opt/releases/thoidai-work/current` and contains no release-specific historical path.
- The operator document defines deploy, rollback, retention, protection, disk guard, worktree cleanup, legacy `safe-deploy` status, and the separate migration/rollback runbook.

- [ ] **Step 1: Write a documentation/template contract test.**

  Assert the template contains `current`, the expected stable writable paths, resource limits, hardening directives, and no timestamped release identifier; assert the runbook captures the exact `DropInPaths` set (currently 16) for backup/consolidation and explicitly says migration is not part of this checkpoint.

- [ ] **Step 2: Run the contract test and confirm it fails before files exist.**

  ```bash
  bash scripts/production/tests/systemd-docs.test.sh
  ```

- [ ] **Step 3: Add the stable template and operator runbook.**

  Preserve current hardening directives and feature flags while replacing release-specific paths with `current`. Do not install it on production in this task.

- [ ] **Step 4: Run documentation/template validation.**

  ```bash
  bash scripts/production/tests/systemd-docs.test.sh
  systemd-analyze verify deploy/systemd/thoidai-work-current.service 2>/dev/null || true
  ```

- [ ] **Step 5: Validate migration helpers.**

  Run the focused bootstrap, systemd-capture, and readiness tests. The capture helper must fail closed on a missing captured file or count mismatch; the readiness helper must require TCP, HTTP, stable `NRestarts`, current-path resolution, environment validation, and resource limits.

- [ ] **Step 5: Commit and push.**

  ```bash
  git add deploy/systemd/thoidai-work-current.service docs/operations/release-lifecycle.md PROJECT_STATUS.md scripts/production/tests/systemd-docs.test.sh
  git commit -m "docs: define stable systemd release migration"
  git push
  ```

### Task 6: Integrated validation and production dry-run checkpoint

**Files:**
- Modify: `PROJECT_STATUS.md`
- Create: `docs/operations/release-lifecycle-dry-run-2026-09-21.md`

- [ ] **Step 1: Run all focused lifecycle tests and static checks.**

  ```bash
  for t in scripts/production/tests/*.test.sh; do bash "$t"; done
  for f in scripts/production/*.sh; do bash -n "$f"; done
  git diff --check
  ```

- [ ] **Step 2: Run relevant repository checks without production mutation.**

  Run the repository's existing focused tests, TypeScript check, changed-file ESLint, and production build only if dependencies are already available or can be installed in the isolated worktree. Do not invoke systemd restart, migration, Docker mutation, or database commands.

- [ ] **Step 3: Execute production retention dry-run.**

  Copy only the tested retention script and common library to a temporary read-only execution directory or invoke the branch worktree script with production paths explicitly set. Run:

  ```bash
  release-retention.sh --dry-run
  ```

  Capture `KEEP`, `DELETE`, and `REVIEW` output. Before migration, all unmanaged legacy releases must be `REVIEW legacy-unmanaged`; no production path may be deleted.

- [ ] **Step 4: Recheck production health and dry-run non-mutation.**

  Verify disk, service active state, MainPID, NRestarts, effective WorkingDirectory, `/login`, symlink state, and that no release/worktree/service state changed.

- [ ] **Step 5: Commit and push the final evidence.**

  ```bash
  git add PROJECT_STATUS.md docs/operations/release-lifecycle-dry-run-2026-09-21.md
  git commit -m "test: validate bounded release lifecycle"
  git push
  git status --short --branch
  ```

## Plan Self-Review

- Spec coverage: tasks cover shared safety primitives, deploy/rollback, retention, worktrees, systemd template/migration plan, disk guard, locking, tests, and production dry-run.
- Placeholder scan: no unfinished marker or unspecified implementation step is required; test commands and file paths are explicit.
- Type/interface consistency: all scripts consume the shared common library and use the same symlink names, lock path, thresholds, and release root.
- Safety gate: Task 6 ends before systemd migration and before any production restart/deploy. Migration is a later checkpoint requiring separate owner authorization.
