# Phase 1A Checkpoint 3 Task Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate only Task authorization to opt-in RBAC enforcement while preserving legacy workflow guards and a fail-legacy production fallback.

**Architecture:** Add a server-only strict flag parser and a task authorization adapter that combines RBAC base scope with the existing legacy guard. Keep all existing RPCs and database validation unchanged. Route list filtering through a server-side RBAC/legacy-equivalent scope builder, and keep shadow comparison active in both flag modes.

**Tech Stack:** TypeScript, Node test runner, Next.js, Supabase service-role repository.

**Spec:** `docs/superpowers/specs/2026-09-16-phase1a-checkpoint3-task-authorization-design.md`

## Global Constraints

- Work only on branch `phase1a-checkpoint3` from `141921afce7c3d15b8efc741b83cccaa0c0d82e3`.
- Do not modify, deploy, restart, or enable RBAC in `/opt/thoidai-work`.
- Do not create migrations, seed grants, replace RPCs, or replay migration history.
- Missing, empty, malformed, or unknown `TASK_RBAC_V2_ENABLED` must resolve to legacy mode.
- Legacy workflow/resource/RPC guards remain mandatory in flag-on mode.
- Shadow comparison runs in both modes and never affects the client response.

---

### Task 1: Strict server-only feature flag and authorization adapter

**Files:**
- Create: `src/lib/taskRbacFlag.ts`
- Create: `src/lib/taskAuthorization.ts`
- Test: `src/lib/taskAuthorization.test.mjs`

- [ ] Add `isTaskRbacV2Enabled(value = process.env.TASK_RBAC_V2_ENABLED)` accepting only normalized `true`, with every other value false.
- [ ] Add a typed decision helper combining `rbacBaseAllowed`, `legacyAllowed`, and the flag.
- [ ] Add tests for missing/empty/malformed/unknown values, flag-off legacy preservation, flag-on AND semantics, and no mutation permission implied by `task.view`.
- [ ] Run the new test before implementation and confirm RED, then implement and confirm GREEN.

### Task 2: Extend RBAC resource mapping without new grants

**Files:**
- Modify: `src/lib/rbac/types.ts` only if needed for canonical task data.
- Modify: `src/lib/rbac/authorization.ts` only if needed for resource scope behavior.
- Test: `src/lib/taskAuthorization.test.mjs`

- [ ] Keep canonical resource relationships server-derived.
- [ ] Preserve self/assigned/department/all semantics proven by Checkpoint 2.
- [ ] Explicitly test create-versus-assign escalation and compatibility roles.
- [ ] Do not add permissions or grants.

### Task 3: Enforce list/detail/mutations behind the flag

**Files:**
- Modify: `src/lib/taskHandlerFactory.ts`
- Modify: `src/lib/taskHandlers.ts`
- Modify: `src/lib/taskRepository.ts`
- Modify: `src/lib/taskHandlers.test.mjs`
- Test: `src/lib/taskAuthorizationIntegration.test.mjs`

- [ ] Load the flag only in server-side handler wiring.
- [ ] Keep shadow observer active in flag-off and flag-on modes.
- [ ] Add RBAC base checks plus existing legacy guards for view/comment/assign/create/admin-edit/evaluation.
- [ ] For submit/return/resubmit/approve/score/update/deadline/cancel/reopen/attachment, use `task.view` only as base resource access and retain legacy action guard; never infer mutation from view.
- [ ] Make list scope constraints server-side and legacy-equivalent, without N+1 grant queries or client filtering.
- [ ] Verify fake actor/department request fields do not affect authorization.

### Task 4: Workflow, audit, and performance characterization

**Files:**
- Modify: `src/lib/taskHandlers.test.mjs`
- Create: `src/lib/phase1aCheckpoint3Matrix.test.mjs`
- Create: `src/lib/phase1aCheckpoint3Workflow.test.mjs`

- [ ] Exercise assign -> progress/submit -> pending review -> return -> resubmit -> approve/score -> done using existing repository/RPC fakes.
- [ ] Assert unauthorized roles/departments cannot view, assign, approve, or score.
- [ ] Assert audit/status-history repository/RPC calls remain unchanged.
- [ ] Assert request-scoped grant loading is reused and list scope construction is bounded.

### Task 5: Verify, report, and push

**Files:**
- Create: `PHASE1A_CHECKPOINT3_REPORT.md`
- Modify: `PROJECT_STATUS.md`

- [ ] Run exact RBAC/task/workflow/security tests, TypeScript, changed-file ESLint, and non-secret build.
- [ ] Verify no migration/RPC/grant changes and production source/service remain untouched.
- [ ] Record FLAG OFF and FLAG ON results, full matrix columns, mismatch counts, performance review, rollback, and open risks.
- [ ] Commit and push `phase1a-checkpoint3`; ensure clean branch.
- [ ] Stop without deployment or activation.
