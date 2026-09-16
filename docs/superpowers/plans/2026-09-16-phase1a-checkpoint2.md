# Phase 1A Checkpoint 2 Authorization Shadow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete and verify RBAC 2.0 shadow authorization without changing production authorization behavior.

**Architecture:** Preserve legacy task authorization as the production decision. Load server-side RBAC grants, compare canonical task resources in shadow mode, and record only metadata discrepancies. Extend characterization tests and reporting without converting workflow rules into static grants.

**Tech Stack:** TypeScript, PostgreSQL migrations already applied, Node.js test runner, ESLint, Next.js production build.

**Spec:** User-provided Phase 1A Checkpoint 2 continuation instructions.

## Global Constraints

- Do not reset, discard, overwrite, or lose dirty changes.
- Do not rerun migrations `20260916100000`, `20260916103000`, or `20260916104500`.
- Do not modify or deploy `/opt/thoidai-work`.
- Legacy authorization remains authoritative; shadow mode cannot change responses.
- Do not log secrets, sessions, cookies, passwords, or tokens.
- Do not start Checkpoint 3.

---

### Task 1: Preserve and correct assignment shadow comparison

**Files:**
- Modify: `src/lib/taskHandlerFactory.ts`
- Modify: `src/lib/phase1aShadowWiring.test.mjs`
- Test: `src/lib/taskHandlers.test.mjs`

- [ ] Preserve the interrupted-state patch and review the assignment branch.
- [ ] Add behavior assertions proving legacy allow and deny results reach the shadow observer.
- [ ] Keep the legacy deny response and prevent mutation after denial.
- [ ] Run focused shadow and task-handler tests.

### Task 2: Build the characterization matrix

**Files:**
- Modify: `src/lib/phase1aShadowMatrix.test.mjs`
- Modify: `PHASE1A_CHECKPOINT2_REPORT.md`

- [ ] Cover `task.create`, `task.view`, `task.comment`, and `task.assign` for active roles and canonical resource cases.
- [ ] Prove `task.create` never implies assignment outside scope.
- [ ] Characterize workflow-dependent submit, return, approve, score, cancel, reopen, update/deadline, and attachment actions as legacy guarded or `NEEDS_REVIEW`.
- [ ] Verify `tbt_read_only` view-only behavior, deputy live assignment behavior, and inactive compatibility roles.
- [ ] Count actual match, mismatch, and needs-review rows.

### Task 3: Reproduce verification

**Files:**
- No production files

- [ ] Run exact RBAC, authorization, shadow, assignment, workflow, and critical test commands; record the real count.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run ESLint on changed RBAC/security/task wiring files.
- [ ] Run `npm run build` with non-secret build-safe values.
- [ ] Verify migration ledger, counts, helper existence, and ACL without applying migrations.

### Task 4: Close checkpoint artifact

**Files:**
- Modify: `PHASE1A_CHECKPOINT2_REPORT.md`
- Modify: `PROJECT_STATUS.md`

- [ ] Review the final diff and ensure the worktree is clean after commit.
- [ ] Commit the assignment-shadow correction and completed checkpoint evidence.
- [ ] Push branch `phase1a-checkpoint2` without force-push, merge, or deployment.
- [ ] Record exact commit SHA, remote state, validation counts, mismatch counts, rollback, and Checkpoint 3 GO/NO-GO.
- [ ] Stop after Checkpoint 2.
