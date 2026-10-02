# Department Plan Quick Assign V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compact, authorized, atomic Department Plan item assignment to a normal `STANDARD` Task.

**Architecture:** Reuse `department_plan_items.linked_task_id` and `api_assign_task_v2`. Add one scoped RPC/API, a compact dialog, and linked Task status projection without changing Task approval or mutation rules.

**Tech Stack:** Next.js App Router, React/TypeScript, Supabase PostgreSQL, Node test runner, ESLint.

**Spec:** `docs/superpowers/specs/2026-10-01-department-plan-quick-assign-v1-design.md`

## Global Constraints

- Reuse the existing Plan to Task relationship and canonical Task workflow.
- Create `STANDARD`, never `REPORT_ONLY`.
- Keep assignees inside the Plan department.
- No batch, multi-assignee, new permission type, broad manager bypass, or unrelated refactor.
- Production stays read-only.

---

### Task 1: Define the failing quick-assign contract

**Files:**
- Create: `src/lib/departmentPlanQuickAssign.test.mjs`

**Interfaces:**
- Defines `api_quick_assign_department_plan_task_v1`, `quickAssignTaskFromItem`, `quickAssignTask`, the compact field set, status mapping, and navigation labels.

- [ ] Write assertions for row locking, canonical Task RPC reuse, one-link protection, department authorization, `STANDARD` workflow, source metadata, compact fields, staff filtering, and `Xem công việc`.
- [ ] Run `node --test src/lib/departmentPlanQuickAssign.test.mjs` and confirm failure because the contract is absent.
- [ ] Commit with `test: define department plan quick assign contract`.

### Task 2: Implement the atomic server path

**Files:**
- Create: `supabase/migrations/20261001120000_department_plan_quick_assign_v1.sql`
- Modify: `src/lib/departmentPlanRepository.ts`
- Modify: `src/lib/departmentPlanHandlers.ts`
- Create: `src/app/api/planning/department/items/[itemId]/quick-assign/route.ts`
- Test: `src/lib/departmentPlanQuickAssign.test.mjs`

**Interfaces:**
- RPC parameters: actor, item, assignee, due date, due time, priority, optional note.
- Route: `POST /api/planning/department/items/:itemId/quick-assign`.

- [ ] Add the migration: lock item, load Plan, assert Task assignment, validate actor and assignee department, reject an existing link, call `api_assign_task_v2`, set `assignment_source = 'department_plan'`, link, audit, and return.
- [ ] Grant RPC execution only to `service_role`; extend the existing source check additively.
- [ ] Add repository and handler validation; never accept department, title, creator, workflow, or reviewer overrides.
- [ ] Run the focused test to green and commit `feat: add atomic department plan quick assign`.

### Task 3: Implement compact UI and status projection

**Files:**
- Create: `src/components/DepartmentPlanQuickAssignDialog.tsx`
- Modify: `src/lib/departmentPlanRepository.ts`
- Modify: `src/components/DepartmentPlanGrid.tsx`
- Modify: `src/components/DepartmentPlanItemDialog.tsx`
- Test: `src/lib/departmentPlanQuickAssign.test.mjs`

**Interfaces:**
- Dialog fields: `assigneeId`, `dueDate`, `dueTime`, `priority`, `note`.
- Linked state mapping: no link=`Chưa giao`; `new`=`Đã giao`; active work states=`Đang thực hiện`; `done`=`Hoàn thành`; `cancelled`=`Đã huỷ`.

- [ ] Add failing UI/status assertions and verify red.
- [ ] Build the compact dialog using existing `assignmentPeople` filtered by `item.department_id`.
- [ ] Replace the Plan quick action with `Giao việc nhanh`; preserve `Xem công việc` for linked Tasks.
- [ ] Derive linked display state from the real Task status and disable independent linked status editing.
- [ ] Run focused Plan tests to green and commit `feat: add compact department plan quick assign UI`.

### Task 4: Validate, document, commit, and push

**Files:**
- Modify: `PROJECT_STATUS.md`

- [ ] Run focused Quick Assign and Department Plan regressions.
- [ ] Rehearse the migration and RPC against disposable PostgreSQL, including duplicate, atomicity, unauthorized actor, and cross-department assignee cases.
- [ ] Run Task Assignment, Task Approval, and Global Mutation Policy regressions.
- [ ] Run TypeScript, changed-file ESLint, `git diff --check`, route manifest, production-like build, and artifact guard.
- [ ] Update `PROJECT_STATUS.md` with evidence and `Production changed: NO`.
- [ ] Commit all scoped changes and push `feature/department-plan-quick-assign-v1` without force or history rewrite.

