# Task Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver persistent, weighted, checkpoint-aware task evaluation with strict evaluator UI controls and an employee drill-down.

**Architecture:** Add a task weight and checkpoint history table plus a guarded database RPC. Keep calculation and access decisions in a pure TypeScript module shared by task detail and the employee summary page.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgreSQL, Node test runner, Tailwind CSS.

---

### Task 1: Back up scoped state

**Files:**
- Back up: `src/app/tasks/[id]/page.tsx`
- Back up: `src/app/performance/page.tsx`
- Back up: `src/components/appNavState.ts`
- Back up: `src/components/appNavState.test.mjs`
- Back up: PostgreSQL table `public.tasks`

- [ ] Create `/var/backups/thoidai-work/task-evaluation-<timestamp>/files` with mode `700`.
- [ ] Copy the four tracked files with metadata, create a task-only `pg_dump`, set backup files to mode `600`, and record SHA-256 checksums.
- [ ] Confirm backup permissions, checksums and current task/staff/evaluation row counts without reading credentials.

### Task 2: Write behavior tests and verify RED

**Files:**
- Create: `src/lib/taskEvaluation.test.mjs`
- Modify: `src/components/appNavState.test.mjs`

- [ ] Test evaluator roles, exact rating and weight options, opinion preservation, and removal of legacy flags.
- [ ] Test weighted summary and latest-final checkpoint selection.
- [ ] Test task detail URL and that `Đánh giá` belongs to the work group.
- [ ] Run the focused Node suite and confirm expected missing-helper/menu RED failures.

### Task 3: Implement pure evaluation rules

**Files:**
- Create: `src/lib/taskEvaluation.ts`

- [ ] Add role, option, normalization, latest-final, summary and task-URL exports.
- [ ] Deduplicate assignments by task id and final evaluations by employee plus task.
- [ ] Run the focused Node tests and expect all focused tests to pass.

### Task 4: Add migration and guarded mutation

**Files:**
- Create: `supabase/migrations/20260813110000_task_evaluation_checkpoints.sql`

- [ ] Add `tasks.effort_weight` with default `1` and fixed values.
- [ ] Create checkpoint history, indexes and read-only anon policy.
- [ ] Revoke direct anonymous mutations and add a security-definer save RPC.
- [ ] Validate actor role, active status, assignment, rating, weight, completion and date.
- [ ] Add SQL contract assertions to the Node suite before applying the migration.

### Task 5: Replace task-detail local storage form

**Files:**
- Modify: `src/app/tasks/[id]/page.tsx`

- [ ] Load effort weight and checkpoint rows.
- [ ] Render editable controls only for `tong_bien_tap` or users with `can_manage_users=true`.
- [ ] Save through the RPC and reload history.
- [ ] Render the assigned employee's latest result read-only.
- [ ] Remove local-storage evaluation code and all legacy checkbox labels.

### Task 6: Build employee evaluation summary and modal

**Files:**
- Modify: `src/app/performance/page.tsx`
- Modify: `src/components/appNavState.ts`

- [ ] Query employees, tasks, assignees and checkpoint history.
- [ ] Render counts, evaluated weight, weighted points and weighted average.
- [ ] Open employee modal with evaluated task detail and opinion.
- [ ] Navigate task clicks to `/tasks/{id}`.
- [ ] Move `Đánh giá` from HR to the work navigation group.

### Task 7: Apply, verify, deploy and publish

**Files:**
- Stage only files named in Tasks 2-6 plus this spec and plan.

- [ ] Apply migration transactionally to `supabase_db_thoidai-work` and register migration history where applicable.
- [ ] Verify counts, defaults, constraints, permissions and evaluation integrity.
- [ ] Run focused/all tests, lint, TypeScript, build and `git diff --check` with exit codes recorded.
- [ ] Restart only `thoidai-work.service`; verify service and localhost/public HTTP 200.
- [ ] Audit scoped diff, commit `feat: improve task evaluation and weighted scoring`, push `main`, and confirm `HEAD=origin/main`.
