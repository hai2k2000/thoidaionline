# Storage Bloat Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only storage inventory, bounded retention guards, artifact/disk gates, log policy, safe timers, and fail-closed tests for Thoi Dai Work without performing production cleanup.

**Architecture:** Reuse existing bounded release lifecycle scripts and environment variables. New operational scripts emit tab-separated records and human/JSON reports, default to dry-run, classify ambiguity as `REVIEW`/`UNKNOWN`, and only permit narrowly scoped non-volume apply paths. Production timers run inventory and dry-run reports only; Docker volume deletion is never scheduled.

**Tech Stack:** POSIX Bash, existing release lifecycle helpers, systemd service/timer unit templates, Docker CLI inspection, `df`, `du`, `journalctl`, and shell fixture tests.

**Spec:** Owner-approved storage-bloat-hardening request dated 2026-09-28.

## Global Constraints

- Dedicated clean worktree only: `/opt/worktrees/storage-bloat-hardening`.
- Never modify/reset/clean/stash `/opt/thoidai-work`.
- Protect `supabase_db_thoidai-work`, recovery, Supabase, running, and unknown Docker volumes.
- Cleanup tools default to dry-run; ambiguity fails closed.
- No scheduled Docker volume deletion and no production deletion before owner approval of the first cleanup batch.
- Production dry-run is inspection-only and must end with `Production changed: NO`.

### Task 1: Storage Inventory

**Files:** Create `scripts/ops/storage-inventory.sh`; test `scripts/ops/tests/storage-inventory.test.sh`.

- [ ] Write fixtures proving inventory emits JSON and human records, marks ambiguous paths `UNKNOWN`, and never mutates files.
- [ ] Run the fixture and observe the expected failure before implementation.
- [ ] Implement read-only inventory for filesystem, worktrees, releases, build roots, logs/journal, Docker images, Docker volumes, backups, and deleted-open files.
- [ ] Add explicit production volume classification and byte estimates with `UNKNOWN` on failed inspection.
- [ ] Run the fixture and verify it passes.
- [ ] Commit `feat(ops): add fail-closed storage inventory`.

### Task 2: Retention Hardening

**Files:** Modify `scripts/production/worktree-cleanup.sh` and `release-retention.sh`; create `scripts/production/build-retention.sh`; add fixture tests.

- [ ] Add age/size reporting and explicit apply allowlists while preserving clean-upstream and lifecycle-link protections.
- [ ] Keep diagnostic releases behind a conservative TTL and classify dangling lifecycle links as `REVIEW`.
- [ ] Make build retention dry-run by default and never remove active/current build evidence.
- [ ] Run all retention tests.
- [ ] Commit `feat(ops): harden bounded artifact retention`.

### Task 3: Docker Guards

**Files:** Create `scripts/ops/docker-retention-guard.sh` and `scripts/ops/tests/docker-retention-guard.test.sh`.

- [ ] Write fake Docker fixtures for running, production, recovery, Supabase, unknown, and safe dangling images/volumes.
- [ ] Verify the test fails before implementation.
- [ ] Implement image candidate reporting and volume `KEEP`/`UNKNOWN` classification; do not implement volume deletion.
- [ ] Verify tests pass and scan scripts for forbidden prune commands.
- [ ] Commit `feat(ops): add fail-closed docker retention guard`.

### Task 4: Artifact Size Guard

**Files:** Create `scripts/production/artifact-size-guard.sh`; modify `scripts/production/deploy-release.sh`; add test.

- [ ] Test rejection of oversized release/build trees and acceptance within configured limits.
- [ ] Add a standalone-safe preflight that runs before release staging and reports exact bytes.
- [ ] Verify tests pass.
- [ ] Commit `feat(ops): guard release artifact size`.

### Task 5: Disk Gate

**Files:** Modify `scripts/production/release-common.sh`; extend `scripts/production/tests/release-common.test.sh`.

- [ ] Add a reusable free-space gate with hard minimum, desired target, and estimated release size.
- [ ] Test both pass and fail paths using a fake `df` implementation.
- [ ] Verify deploy invokes the gate before staging.
- [ ] Commit `feat(ops): enforce release disk gate`.

### Task 6: Log and Journal Policy

**Files:** Create `ops/systemd/thoidai-work-log-policy.conf`, `scripts/ops/log-retention-report.sh`, and its fixture test.

- [ ] Add bounded journald and application-log policy templates without applying them to production.
- [ ] Report current usage, configured bounds, and reclaim estimate; classify unavailable data as `UNKNOWN`.
- [ ] Verify tests pass.
- [ ] Commit `feat(ops): define bounded log retention policy`.

### Task 7: Safe Timers

**Files:** Create daily inventory and weekly dry-run systemd service/timer units and a timer safety test.

- [ ] Define units with explicit paths and non-destructive arguments.
- [ ] Verify units contain no Docker volume deletion/prune command and no apply mode.
- [ ] Commit `feat(ops): add safe storage reporting timers`.

### Task 8: Fail-Closed Test Suite

- [ ] Run all existing lifecycle tests plus every new ops test with `bash -n` over all scripts.
- [ ] Add a negative fixture proving missing Docker metadata, broken links, and failed size probes become `UNKNOWN`/`REVIEW`.
- [ ] Commit `test(ops): cover ambiguous storage states`.

### Task 9: Production Dry-Run

- [ ] Run only read-only inventory, retention reports, Docker guard, log report, and disk gate on `vps-aylaspa`.
- [ ] Recheck service health, current release, protected production/recovery volumes, and git status.
- [ ] Record exact candidates, sizes, and total safe reclaim estimate.
- [ ] Do not execute cleanup, delete, prune, timer installation, or production code change.