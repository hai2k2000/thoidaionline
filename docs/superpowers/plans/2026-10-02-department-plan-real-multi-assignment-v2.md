# Department Plan Real Assignment + Multi-Assignee V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make explicit Department Plan assignment create one canonical `STANDARD` Task, link it atomically, and deliver it to an ordered primary-plus-additional assignee set without allowing generic Plan saves to claim assignment.

**Architecture:** Add one additive PostgreSQL migration with a private assignment core, wrappers for existing V1/V2 entry points, an atomic draft create-and-assign RPC, and a write guard for new misleading assignment metadata. Keep `api_assign_task_v2` as the sole Task creation authority. Update the server contracts and Plan UI so content saves are Plan-only while explicit assignment uses a searchable multi-select and derives status/participants from the linked Task.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/PostgreSQL PL/pgSQL, React client components, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-02-department-plan-real-multi-assignment-v2-design.md`.

## Global Constraints

- Production and `/opt/thoidai-work` remain untouched; do not apply migrations or deploy.
- No new tables or columns; add only functions/triggers and application code required for this feature.
- Reuse `api_assign_task_v2`; one Plan item creates one `STANDARD` Task.
- First unique selected employee is primary `owner_id`/`assignee_id`; remaining unique employees are `task_assignees.assignment_role='assignee'`.
- All validation happens before Task insertion; failures roll back the Plan item, Task, participants, link, and audit rows together.
- Generic Plan create/update never persists a new `assigned` item without a linked Task; legacy `assigned + NULL link` rows remain readable and are never auto-backfilled.
- Preserve current Task Approval, Global Mutation Policy, Task Center, notification, and Department Plan behavior outside this assignment path.
- Commit and push every completed implementation batch; never force-push or rewrite history.

---

### Task 1: Add failing contract and behavior tests

**Files:**
- Create: `src/lib/departmentPlanRealAssignment.test.mjs`
- Modify: `src/lib/departmentPlanQuickAssign.test.mjs`
- Modify: `src/components/DepartmentPlanGridUi.test.mjs`
- Modify: `src/components/DepartmentPlanItemDialog.test.mjs`

**Interfaces:**
- Tests consume the migration, handlers, repository, routes, and components added in later tasks.
- Tests must assert Plan-only saves, ordered multi-assignee payloads, atomic draft route, legacy display, duplicate normalization, and service-role-only RPC grants.

- [ ] **Step 1: Write failing tests**

Add assertions that:

```js
assert.match(migration, /api_department_plan_assign_core/);
assert.match(migration, /api_create_department_plan_task_v2/);
assert.match(migration, /task_assignees/);
assert.match(migration, /assignment_state = 'assigned'/);
assert.match(handlers, /assigneeIds/);
assert.match(handlers, /createAndAssignItem/);
assert.doesNotMatch(handlers, /assignment_state.*assigned.*without.*linked/i);
assert.match(dialog, /selectedIds|assigneeIds/);
assert.match(dialog, /Tìm người/);
assert.match(grid, /Chưa tạo công việc/);
```

Include pure/static cases for duplicate IDs, mixed department rollback contract, generic save omission of assignment metadata, and linked participant names.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node --test src/lib/departmentPlanRealAssignment.test.mjs src/lib/departmentPlanQuickAssign.test.mjs src/components/DepartmentPlanGridUi.test.mjs src/components/DepartmentPlanItemDialog.test.mjs`

Expected: FAIL because the new migration/core, handlers, and multi-select UI do not exist yet.

- [ ] **Step 3: Commit the red tests**

```bash
git add src/lib/departmentPlanRealAssignment.test.mjs src/lib/departmentPlanQuickAssign.test.mjs src/components/DepartmentPlanGridUi.test.mjs src/components/DepartmentPlanItemDialog.test.mjs
git commit -m "test: define department plan real multi-assignment contract"
git push -u origin fix/department-plan-real-multi-assignment
```

### Task 2: Implement the additive PostgreSQL assignment core

**Files:**
- Create: `supabase/migrations/20261002130000_department_plan_real_multi_assignment_v2.sql`
- Test: `src/lib/departmentPlanRealAssignment.test.mjs`

**Interfaces:**
- Produce `api_department_plan_assign_core(uuid, uuid, jsonb) returns public.tasks`.
- Produce `api_assign_department_plan_task_v2(uuid, uuid, jsonb)` wrapper.
- Produce `api_create_department_plan_task_v2(uuid, uuid, jsonb)` atomic draft wrapper.
- Replace existing V1/legacy wrappers to delegate to the core while preserving signatures.

- [ ] **Step 1: Implement core validation and ordered participant normalization**

Lock the Plan item with `FOR UPDATE`; validate actor through `api_assert_task_action`, Plan scope, active Plan department, nonempty UUID `assigneeIds`, due date/time, priority, and input length. Deduplicate IDs in first-seen order, reject inactive or foreign-department users, select the first as primary, and pass the remaining IDs to `api_assign_task_v2` as collaborators. Reject recurrence/reviewer fields for the compact path.

- [ ] **Step 2: Link and audit in the same transaction**

After the canonical RPC returns, require `workflow_type = 'STANDARD'`, set `assignment_source = 'department_plan'`, update the locked item with `linked_task_id`, primary `assignee_id`, `assignment_state='assigned'`, and Vietnam-local due timestamp, then write the existing Department Plan audit row. Return the Task. Any exception must abort the whole transaction.

- [ ] **Step 3: Add atomic draft create-and-assign and write guard**

Insert a new item as unassigned, call the same core before returning, and expose only `service_role`. Add an idempotent trigger that rejects new assignment metadata claiming `assigned` while `linked_task_id` is null, while allowing title/content edits to legacy inconsistent rows. Keep the existing legacy rows untouched.

- [ ] **Step 4: Run migration contract tests**

Run: `node --test src/lib/departmentPlanRealAssignment.test.mjs src/lib/departmentPlanQuickAssign.test.mjs`

Expected: PASS for function names, locks, canonical reuse, trigger, ordered assignees, rollback wording, and grants.

- [ ] **Step 5: Commit and push**

```bash
git add supabase/migrations/20261002130000_department_plan_real_multi_assignment_v2.sql src/lib/departmentPlanRealAssignment.test.mjs src/lib/departmentPlanQuickAssign.test.mjs
git commit -m "feat: add atomic department plan multi-assignment RPCs"
git push
```

### Task 3: Update server contracts and repository methods

**Files:**
- Modify: `src/lib/departmentPlanHandlers.ts`
- Modify: `src/lib/departmentPlanRepository.ts`
- Modify: `src/app/api/planning/department/[planId]/items/route.ts`
- Create: `src/app/api/planning/department/[planId]/items/assign/route.ts`
- Modify: `src/app/api/planning/department/items/[itemId]/quick-assign/route.ts`
- Modify: `src/app/api/planning/department/items/[itemId]/assign/route.ts`
- Test: `src/lib/departmentPlanRealAssignment.test.mjs`

**Interfaces:**
- `quickAssignTaskFromItem(actorId, itemId, input.assigneeIds)` calls `api_assign_department_plan_task_v2`.
- `createAndAssignItem(actorId, planId, input)` calls `api_create_department_plan_task_v2` and returns `{ task, item }`.
- Existing full assignment accepts `assigneeIds` and preserves collaborator/watcher compatibility.

- [ ] **Step 1: Make generic Plan parsing Plan-only**

Reject client-supplied `linked_task_id`, `assignee_id`, or `assignment_state='assigned'` in generic create/update. Allow content, due, and work-status edits; permit legacy title/content edits without auto-backfill. Do not expose an assignment claim through this path.

- [ ] **Step 2: Add strict assignee array parsing**

Normalize `assigneeIds` as UUID strings, preserve order, remove duplicates before the RPC, require at least one for explicit assignment, and return `400` for malformed input. Mixed department and inactive-user failures remain database `403`/`400` responses and commit nothing.

- [ ] **Step 3: Add atomic draft route and repository method**

Create `POST /api/planning/department/{planId}/items/assign`; authorize the Plan scope, validate title/content/due/priority, call the atomic RPC, then return the created Task and linked item. Keep normal `POST /items` Plan-only.

- [ ] **Step 4: Run server contract tests**

Run: `node --test src/lib/departmentPlanRealAssignment.test.mjs src/lib/departmentPlanQuickAssign.test.mjs`

Expected: PASS for route presence, auth checks, no generic assignment metadata, array normalization, and RPC names.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/departmentPlanHandlers.ts src/lib/departmentPlanRepository.ts src/app/api/planning/department
git commit -m "feat: expose atomic department plan assignment APIs"
git push
```

### Task 4: Implement multi-assignee Plan UI and linked-task projection

**Files:**
- Modify: `src/lib/departmentPlanRepository.ts`
- Modify: `src/components/DepartmentPlanQuickAssignDialog.tsx`
- Modify: `src/components/DepartmentPlanGrid.tsx`
- Modify: `src/components/DepartmentPlanItemDialog.tsx`
- Modify: `src/components/DepartmentPlanItemFields.tsx`
- Modify: `src/components/DepartmentPlanAssignmentDialog.tsx`
- Modify: `src/components/DepartmentPlanGridUi.test.mjs`
- Modify: `src/components/DepartmentPlanItemDialog.test.mjs`

**Interfaces:**
- Quick assignment sends `assigneeIds: string[]`; first chip is primary.
- Draft rows call the atomic Plan-level route; persisted rows call the item route.
- Linked items expose participant names/status from the Task relation and link to `/tasks/{id}`.

- [ ] **Step 1: Replace single select with searchable multi-select**

Filter active employees to the Plan department, show a search input labeled `Tìm người`, render removable chips, prevent duplicate selection, and show primary/additional ordering. Preserve due date/time, priority, note, and compact labels.

- [ ] **Step 2: Add draft-row explicit assignment**

Keep `Lưu` Plan-only. Add `Giao việc` for a new draft that opens the compact dialog and submits the Plan-level atomic route. On success, replace the draft with the returned linked item and Task.

- [ ] **Step 3: Remove misleading generic assignment controls**

Remove assignee/assignment-state editors from generic item fields and grid saves. Display legacy `assigned + NULL link` as `Chưa tạo công việc` with an explicit assignment action; never auto-backfill. Keep linked participants read-only in Plan.

- [ ] **Step 4: Project linked Task status and participant names**

Extend the read model relation to include `task_assignees` names and map Task statuses to the existing Plan labels. Preserve Task Center and notification behavior by leaving canonical participant rows authoritative.

- [ ] **Step 5: Run UI tests**

Run: `node --test src/components/DepartmentPlanGridUi.test.mjs src/components/DepartmentPlanItemDialog.test.mjs src/lib/departmentPlanRealAssignment.test.mjs`

Expected: PASS for multi-select, draft assignment, legacy display, Plan-only save, and navigation labels.

- [ ] **Step 6: Commit and push**

```bash
git add src/lib/departmentPlanRepository.ts src/components/DepartmentPlanQuickAssignDialog.tsx src/components/DepartmentPlanGrid.tsx src/components/DepartmentPlanItemDialog.tsx src/components/DepartmentPlanItemFields.tsx src/components/DepartmentPlanAssignmentDialog.tsx src/components/DepartmentPlanGridUi.test.mjs src/components/DepartmentPlanItemDialog.test.mjs
git commit -m "feat: deliver department plan tasks to multiple assignees"
git push
```

### Task 5: Run focused integration validation and close the feature branch

**Files:**
- Modify: `PROJECT_STATUS.md`

- [ ] **Step 1: Rehearse the migration in disposable PostgreSQL**

Apply the feature migration after the current migration ledger in a disposable, production-compatible PostgreSQL instance; verify one Task, one owner, additional assignee rows, link/audit rows, notification-visible participant rows, mixed-department rollback, duplicate normalization, and transaction rollback. Do not touch production.

- [ ] **Step 2: Run focused regressions**

Run the Department Plan real-assignment/multi-assignee tests, existing Department Plan tests, Task Assignment, Task Approval, Global Mutation Policy, Task Center/notification tests, and the relevant TypeScript/lint/route/artifact/build checks. Do not investigate unrelated baseline failures.

- [ ] **Step 3: Update project status and inspect the diff**

Record current phase, completed validation, production mutation `NONE`, and any non-blocking `FOLLOW_UP`. Run `git diff --check`, inspect changed files for secrets/runtime artifacts, and verify the branch is clean after commit.

- [ ] **Step 4: Commit and push the status update**

```bash
git add PROJECT_STATUS.md
git commit -m "docs: record department plan real assignment validation"
git push
```

