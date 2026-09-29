# Recipient-First Multi-Task Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign general `/tasks/assign` so one authorized recipient can receive 1..20 normal tasks in one atomic, idempotent batch while preserving the current single-task contract and all unrelated workflows.

**Architecture:** Keep `/api/tasks/assign` as the compatibility boundary with an explicit `mode: "batch"` shape. Add a PostgreSQL `api_assign_task_batch_v1` wrapper that invokes `api_assign_task_v2` for every normalized card inside one transaction, guarded by an actor-scoped batch-idempotency record and payload hash. Refactor the existing assignment UI into recipient-first state plus independent task cards; upload attachments only after task IDs are committed.

**Tech Stack:** Next.js App Router, React/TypeScript, Supabase server client/PostgreSQL RPC, Node `node:test`, existing standalone release/route/baseline guards.

**Spec:** `docs/superpowers/specs/2026-09-25-recipient-first-multi-task-assignment-design.md`

## Global Constraints

- Maximum batch size is 20; enforce in client, API, and PostgreSQL.
- Same actor + same `batch_id` + same payload hash replays the original ordered task IDs.
- Same actor + same `batch_id` + different hash returns a conflict and never creates tasks.
- Any task/RPC failure rolls back all task, audit, status, recurrence, and idempotency state for that batch.
- Attachment uploads occur after task commit; failed uploads retry by returned `task_id` and never recreate tasks.
- Do not duplicate `api_assign_task_v2` business rules or broaden existing role scopes.
- Do not change Journalism, Journalism self-registration, Event Assignment, Task Approval, Task Summary, Personal Plan, Attendance, assignment-source semantics, or notification semantics.
- No `Ghi chú` field and no new notes column.
- No production deployment in this plan.

---

### Checkpoint 1: DB Contract and Migration Skeleton

**Depends on:** None.

**Files:**
- Create: `supabase/migrations/20260925110000_task_assignment_batch_idempotency.sql`
- Create: `src/lib/taskAssignmentBatchDbContract.test.mjs`
- Modify: `scripts/schema-contracts.mjs` only if the existing schema guard needs a named batch contract entry.

**Interfaces:**
- Produces table `public.task_assignment_batch_idempotency` with `actor_id`, `batch_id`, `request_hash`, ordered `task_ids uuid[]`, `task_count`, `created_at`, and nullable `completed_at`.
- Produces unique `(actor_id, batch_id)`, count check `1..20`, actor foreign key, and created-at index.
- Pins RPC signature `public.api_assign_task_batch_v1(uuid, uuid, uuid, uuid, jsonb) returns jsonb`; the function may initially raise a deterministic `feature_not_ready` exception until Checkpoint 2 replaces its body.

- [ ] Write failing SQL contract tests asserting the exact table columns/types, unique constraint, count check, RPC signature, service-role-only execution, and idempotent `create table/function` clauses.
- [ ] Run `node --test src/lib/taskAssignmentBatchDbContract.test.mjs`; confirm failure because the migration/RPC does not exist.
- [ ] Add the additive migration skeleton. Revoke `public, anon, authenticated`; grant execute only to `service_role`; do not alter existing task rows or functions.
- [ ] Run `node --test src/lib/taskAssignmentBatchDbContract.test.mjs` and `node scripts/check-migration-state.mjs`; both must pass against the local contract setup.
- [ ] Run the existing schema/route checks without applying the migration to production.
- [ ] Commit: `git add supabase/migrations/20260925110000_task_assignment_batch_idempotency.sql src/lib/taskAssignmentBatchDbContract.test.mjs scripts/schema-contracts.mjs && git commit -m "feat: add batch assignment idempotency contract"`.

**Completion criteria:** Migration is additive/idempotent, exact constraints and signature are tested, and no existing table/data contract changes.

**Rollback impact:** Revert the unactivated commit; if later applied, application rollback remains safe because old releases ignore the additive table/function. Do not drop production objects during application rollback.

**Independent commit:** Yes; contract-only and not activation-ready until Checkpoint 2.

### Checkpoint 2: Atomic Batch RPC

**Depends on:** Checkpoint 1.

**Files:**
- Create: `supabase/migrations/20260925111000_task_assignment_batch_rpc.sql`
- Modify: `src/lib/taskAssignmentBatchDbContract.test.mjs`
- Create: `src/lib/taskAssignmentBatchRpc.test.mjs`

**Interfaces:**
- Replaces the skeleton with `api_assign_task_batch_v1(p_actor_id uuid, p_batch_id uuid, p_department_id uuid, p_assignee_id uuid, p_tasks jsonb) returns jsonb`.
- Returns `{batchId, tasks:[{ordinal,id,title}], count, replayed}` in input order.

- [ ] Add failing RPC tests for one card, 20 cards, 21-card rejection, ordered results, forged scope rejection, and card-2 failure rolling back card 1 plus idempotency state.
- [ ] Add a canonical request-hash expression over actor, batch, department, assignee, and normalized JSON task array; preserve task array order.
- [ ] Add `pg_advisory_xact_lock` keyed by actor and batch ID, then check existing idempotency row: same hash returns stored IDs; different hash raises a deterministic conflict.
- [ ] Insert the idempotency row in the same transaction, invoke `api_assign_task_v2` once per card with normalized existing parameters, collect IDs by ordinal, update ordered IDs/completion timestamp, and return JSONB.
- [ ] Enforce max 20 and all shared/array invariants in the RPC even when called directly.
- [ ] Verify task creation, audit/status/notification/recurrence parity through the existing RPC; do not duplicate its authorization or participant rules.
- [ ] Run `node --test src/lib/taskAssignmentBatchRpc.test.mjs src/lib/taskAssignmentBatchDbContract.test.mjs`; confirm all RPC contract cases pass.
- [ ] Commit: `git add supabase/migrations/20260925111000_task_assignment_batch_rpc.sql src/lib/taskAssignmentBatch* && git commit -m "feat: add atomic idempotent task assignment batch rpc"`.

**Completion criteria:** One RPC transaction creates all tasks or none; ordered results and replay/conflict behavior are deterministic; direct forged requests are denied.

**Rollback impact:** Application can roll back without dropping the additive RPC/table. If a migration has been applied, retain objects for safe retry and future release compatibility.

**Independent commit:** Yes, after Checkpoint 1; migration pair is activation-ready only after API/UI gates pass.

### Checkpoint 3: API Compatibility and Error Contract

**Depends on:** Checkpoint 2.

**Files:**
- Modify: `src/lib/taskHandlerFactory.ts` in `assign()` and a focused `assignBatch()` helper.
- Modify: `src/lib/taskRepository.ts` with `assignBatch(actorId, input)` calling `api_assign_task_batch_v1`.
- Modify: `src/app/api/tasks/assign/route.ts` only if dispatch must be explicit.
- Create: `src/lib/taskAssignmentBatchApi.test.mjs`.
- Modify: existing `src/lib/taskHandlers.test.mjs` and `src/lib/taskRepository` contract tests.

**Interfaces:**
- `mode !== "batch"` follows the existing single-task path byte-for-byte.
- Batch input type: `{mode:"batch", batchId, departmentId, assigneeId, tasks: BatchTaskInput[]}`.
- Repository result: `{batchId, tasks: Array<{ordinal:number,id:string,title:string}>, count:number, replayed:boolean}`.

- [ ] Write failing tests proving single payload behavior is unchanged and malformed batch/single shapes are not silently reinterpreted.
- [ ] Write failing tests for max count, UUID/date/time/priority validation, per-card `taskIndex`/`field` messages, duplicate participant IDs, and recurrence constraints.
- [ ] Implement deterministic server-side normalization: `description` stays `description`; requirements serialize to the existing `evaluation_criteria` representation; no notes field.
- [ ] Implement structured errors with one-based Vietnamese card numbers, preserving the existing `apiError`/`rpcFailure` response envelope.
- [ ] Forward only one authenticated actor and shared recipient to the repository; do not accept client-selected reviewer authority.
- [ ] Preserve existing single-task success status/body and existing 403/400 semantics.
- [ ] Keep the submitted `batchId` stable across timeout/retry; return `replayed: true` when RPC replays.
- [ ] Run `node --test src/lib/taskAssignmentBatchApi.test.mjs src/lib/taskHandlers.test.mjs`; verify single-task backward compatibility and all batch validation cases.
- [ ] Commit: `git add src/lib/taskHandlerFactory.ts src/lib/taskRepository.ts src/app/api/tasks/assign/route.ts src/lib/taskAssignmentBatchApi.test.mjs src/lib/taskHandlers.test.mjs && git commit -m "feat: expose backward-compatible batch assignment api"`.

**Completion criteria:** API accepts explicit batch requests, validates every card before mutation, preserves single requests, and maps retries/conflicts safely.

**Rollback impact:** Revert API commit; existing single-task callers remain available. No database rollback required.

**Independent commit:** Yes, after the RPC migration contract exists.

### Checkpoint 4: Recipient-First Scope and Server/UI Options

**Depends on:** Checkpoint 3.

**Files:**
- Modify: `src/lib/taskAssignmentRepository.ts` to return a role-derived recipient scope model.
- Create: `src/lib/taskAssignmentScope.mjs` and `src/lib/taskAssignmentScope.test.mjs` if pure scope logic is not already isolated.
- Modify: `src/app/tasks/assign/page.tsx` to pass scope/recipient options.
- Modify: `src/lib/taskAssignAccess.ts` only for existing role checks; do not broaden permissions.

**Interfaces:**
- `AssignmentScope = {kind:"own_department"|"global_default", departmentId:string|null, departmentName:string|null, canChooseOtherDepartment:boolean}`.
- Existing `AssignmentDepartment[]` and `AssignmentPerson[]` remain the source for actual IDs.

- [ ] Add failing scope tests for `truong_phong` own department only, TBT/PTBT editorial default plus authorized department switch, and forged cross-department recipient rejection.
- [ ] Implement server-derived scope; never derive manager department from a client field.
- [ ] For TBT/PTBT, expose Ban Biên tập as initial scope and retain existing authorized cross-department options.
- [ ] For department managers, suppress department switching and return only eligible active staff in the actor department.
- [ ] Verify admin/other existing assignment roles retain their current authority without widening manager/global-editorial scope.
- [ ] Run `node --test src/lib/taskAssignmentScope.test.mjs src/lib/taskAssignAccess.test.mjs src/lib/taskAuthorization.test.mjs`.
- [ ] Commit: `git add src/lib/taskAssignmentRepository.ts src/lib/taskAssignmentScope.mjs src/lib/taskAssignmentScope.test.mjs src/app/tasks/assign/page.tsx src/lib/taskAssignAccess.ts && git commit -m "feat: derive recipient-first assignment scopes"`.

**Completion criteria:** UI options reflect role scope, and direct API/RPC forged IDs remain denied by server-side checks.

**Rollback impact:** Revert scope/UI-options commit; no task data or database schema changes.

**Independent commit:** Yes, after API contract tests are green.

### Checkpoint 5: Multi-Task Card UI

**Depends on:** Checkpoint 4.

**Files:**
- Modify: `src/components/TaskAssignShell.tsx` or extract card state into `src/components/TaskAssignmentBatchCards.tsx`.
- Create: `src/lib/taskAssignmentBatchUi.mjs` and `src/lib/taskAssignmentBatchUi.test.mjs` for reducer/validation logic.
- Modify: `src/lib/taskAssignAccess.test.mjs` or assignment UI tests for route invariants.

**Interfaces:**
- Card reducer actions: `add`, `remove(index)`, `update(index, patch)`, `reset`.
- `BatchCardState` contains only mapped fields plus a local `attachment?: File`; shared recipient is outside cards.
- Submit callback receives `{mode:"batch", batchId, departmentId, assigneeId, tasks}` and the ordered attachment list.

- [ ] Write failing reducer tests for default one card, add/focus target, remove/renumber, preserve values after recipient change, 20-card cap, and card-indexed validation.
- [ ] Implement Step 1 recipient gate and Step 2 cards; show selected recipient/department and `Đổi người` without erasing cards.
- [ ] Implement manager scope display, TBT/PTBT default Ban Biên tập, and `Chọn phòng ban khác` flow from Checkpoint 4.
- [ ] Render title, description, requirements, due date/time, collaborators, watchers, recurrence, priority, and existing task-specific controls; omit Ghi chú.
- [ ] Disable submit during network/attachment phases, generate one client batch ID per intended submission, and preserve it for retry.
- [ ] Implement labels `Giao việc`/`Giao N việc`, add/remove controls, focus title of new card, and accessible card-level errors.
- [ ] Run `node --test src/lib/taskAssignmentBatchUi.test.mjs` and the focused assignment component tests.
- [ ] Commit: `git add src/components/TaskAssignShell.tsx src/components/TaskAssignmentBatchCards.tsx src/lib/taskAssignmentBatchUi.mjs src/lib/taskAssignmentBatchUi.test.mjs && git commit -m "feat: add recipient-first multi-task assignment cards"`.

**Completion criteria:** A recipient is selected once, cards add/remove correctly, invalid cards are highlighted, and the UI never sends Journalism payloads through the general flow.

**Rollback impact:** Revert UI commit; API and single-task behavior remain available.

**Independent commit:** Yes, after the scope/API contracts are green.

### Checkpoint 6: Attachment Phase and Retry

**Depends on:** Checkpoint 5.

**Files:**
- Modify: `src/components/TaskAssignShell.tsx` or `src/components/TaskAssignmentBatchCards.tsx` for ordered file mapping.
- Create: `src/lib/taskAssignmentAttachments.mjs` and `src/lib/taskAssignmentAttachments.test.mjs`.
- Modify: existing attachment client helper only if it cannot accept an existing task ID.

**Interfaces:**
- `uploadBatchAttachments(results, attachments, uploadTaskAttachment)` returns `{failed:[{taskIndex,taskId,fileName,message}]}` without calling batch creation.

- [ ] Write failing tests for ordered card-to-task mapping, successful uploads, one failed file with other files succeeding, and retrying only the failed task ID.
- [ ] Implement phase 1 batch creation, then phase 2 uploads by returned ordinal/task ID using the existing attachment endpoint.
- [ ] Preserve created tasks on upload failure; show exact card/file warning and `Thử tải lại tệp`.
- [ ] Ensure attachment retry cannot generate a new batch ID or call `/api/tasks/assign` again.
- [ ] Run `node --test src/lib/taskAssignmentAttachments.test.mjs` and existing attachment regression tests.
- [ ] Commit: `git add src/components/TaskAssignShell.tsx src/components/TaskAssignmentBatchCards.tsx src/lib/taskAssignmentAttachments.mjs src/lib/taskAssignmentAttachments.test.mjs && git commit -m "feat: retry batch assignment attachments by task id"`.

**Completion criteria:** Task records remain atomic; attachment failures are isolated, visible, and retryable without duplicates.

**Rollback impact:** Revert attachment phase; batch task creation remains available without file retry UX.

**Independent commit:** Yes, after batch results and card state are available.

### Checkpoint 7: Focused and Regression Tests

**Depends on:** Checkpoints 1-6.

**Files:**
- Modify: `scripts/production/browser-path-smoke.mjs` for recipient-first/browser-path coverage.
- Create: `src/lib/taskAssignmentBatchIntegration.test.mjs`.
- Modify: existing task, audit, notification, Journalism, Event Assignment, Personal Plan, Attendance, and route tests only where assertions need explicit preservation coverage.

- [ ] Add integration tests for 1 task, 20 tasks, 21 rejected, invalid card N with zero committed rows, authorization failure with zero rows, duplicate HTTP retry, same batch/hash replay, same batch/different hash conflict, simulated timeout after commit, attachment partial failure, forged cross-department recipient, audit/notifications exactly once, and single-task compatibility.
- [ ] Assert ordered IDs, `assignment_source`, status/audit events, recurrence rows, collaborators/watchers, and no duplicate tasks.
- [ ] Add secure authenticated smoke coverage for manager, global editorial, and non-editorial roles; never print or commit credentials.
- [ ] Run exact focused suite: `node --test src/lib/taskAssignmentBatch*.test.mjs src/lib/taskHandlers.test.mjs src/lib/taskRepository*.test.mjs`.
- [ ] Run regressions: `node --test src/lib/taskApprovalWorkflow.test.mjs src/lib/taskSummarySeparation.test.mjs src/lib/eventAssignment.test.mjs src/lib/personalWorkSchedule.test.mjs src/lib/notificationCenter.test.mjs src/lib/journalism*.test.mjs src/lib/attendance*.test.mjs`.
- [ ] Run `npx tsc --noEmit`, touched-file ESLint, and the authenticated browser-path smoke against the canary.
- [ ] Commit: `git add scripts/production/browser-path-smoke.mjs src/lib/taskAssignmentBatchIntegration.test.mjs src/lib/*test.mjs && git commit -m "test: cover atomic multi-task assignment regressions"`.

**Completion criteria:** Every invariant in the approved spec has a failing-then-green regression test, unrelated workflows remain green, and browser smoke verifies the actual recipient-first path.

**Rollback impact:** Test-only commit; no runtime rollback impact.

**Independent commit:** Yes, but release cannot proceed until all prior checkpoints are present.

### Checkpoint 8: Authenticated Canary and Release Gates

**Depends on:** Checkpoint 7.

**Files:**
- Modify: `scripts/production/build-standalone-release.sh` only if the existing gate does not include the new tests/cache guard.
- Modify: `scripts/production/deploy-gate.sh` only if batch/browser smoke is not already a required gate.
- Create: `scripts/production/task-assignment-batch-gate.mjs` if a dedicated gate is needed.
- Create: standalone artifact under `/opt/build/thoidai-work/` using the managed package process.

- [ ] Verify local/remote/candidate ancestry, clean worktree, required-route manifest, environment symlinks, and migration reference.
- [ ] Build the standalone artifact from the verified integration descendant; verify `.next/cache` ownership and service-user write access.
- [ ] Start the artifact on an unused local port and run secure authenticated smoke:
  - manager selects one own-department recipient, submits three tasks, sees exactly three IDs/audits/notifications;
  - forged cross-department recipient is rejected;
  - TBT/PTBT default Ban Biên tập and authorized other-department flow work;
  - non-editorial user cannot access assignment scope;
  - timeout retry reuses batch ID and does not duplicate tasks;
  - attachment failure/retry does not recreate tasks.
- [ ] Repeat Journalism, Task Approval, Task Summary, Event Assignment, Personal Plan, Attendance, login/static, PostgreSQL/Supabase/Realtime, and NRestarts regressions.
- [ ] Preserve current, previous, rollback-1, and rollback-2 releases; do not deploy production in this phase.
- [ ] Commit only release-gate changes after all gates pass: `git add scripts/production && git commit -m "test: gate recipient-first assignment release"`.

**Completion criteria:** Canary, build, TypeScript, lint, route/baseline, standalone, and authenticated regression gates all pass; artifact is ready but production remains unchanged.

**Rollback impact:** No production mutation. A failed canary discards only the experimental artifact/process; no database rollback is run.

**Independent commit:** Yes; release-ready checkpoint, not a production deployment.

## Dependency and Release Sequence

```text
1 DB contract
  -> 2 atomic RPC
    -> 3 API compatibility
      -> 4 recipient scope
        -> 5 multi-task UI
          -> 6 attachment retry
            -> 7 focused/regression tests
              -> 8 authenticated canary + standalone artifact
```

At every arrow, run the preceding focused tests before starting the next
checkpoint. Production deployment is intentionally excluded; any later deploy
must be separately authorized after artifact provenance and authenticated
post-deploy smoke are verified.
