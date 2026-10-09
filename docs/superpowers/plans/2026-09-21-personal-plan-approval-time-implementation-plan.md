# Personal Plan Approval + HH:mm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-enforced approval workflow and Asia/Ho_Chi_Minh `HH:mm` interval validation to Personal Plans while preserving organization schedules, legacy rows, audit history, and J6 pause state.

**Architecture:** Keep the existing `work_schedules` table, but add an explicit `schedule_scope` discriminator and approval metadata. Add a dedicated Personal Plan route/repository/RPC boundary; keep the organization calendar writer and read path separate and explicitly marked `organization`. Use transactional Supabase RPCs with row locking plus `workflow_revision` compare-and-swap, and reuse `audit_logs` for revision history.

**Tech Stack:** Next.js 16 App Router, TypeScript, React, Supabase/PostgreSQL migrations and security-definer RPCs, Node `node:test`, ESLint, TypeScript, production build.

**Spec:** `docs/superpowers/specs/2026-09-21-personal-plan-approval-time-design.md`

## Global Constraints

- Approval applies only to rows with `schedule_scope = 'personal'`.
- New Personal Plans start as `PENDING_APPROVAL`; organization rows remain effective without Personal Plan approval.
- Legacy rows retain `schedule_scope = NULL`, are treated as effective-approved for display, and never enter the pending queue until explicitly opened through the Personal Plan flow.
- Global approvers are exactly `admin`, `tong_bien_tap`, and `pho_tong_bien_tap`.
- Department-manager authorization is derived from the current active `departments.manager_id`; stored `approver_id` is informational and never sufficient by itself.
- Self-approval is forbidden.
- New Personal Plans require real `YYYY-MM-DD` dates and `HH:mm` start/end times interpreted in `Asia/Ho_Chi_Minh`; do not parse business dates through UTC `Date` constructors.
- Rejection requires a 3-1000 character reason.
- Approved/rejected material edits create a new pending revision and preserve prior history in `audit_logs`.
- Do not reset, clean, stash, or stage unrelated dirty files; do not modify production or resume J6 Gate 12-14.

---

## File Map and Boundaries

- Create `supabase/migrations/20260921120000_personal_plan_approval.sql`: additive columns, backfill, constraints, indexes, RPCs, and audit-safe transactional operations.
- Create `src/lib/personalPlanValidation.ts`: pure local date/time and material-edit helpers.
- Create `src/lib/personalPlanWorkflow.ts`: typed status/scope/reviewer policy shared by repository and route tests.
- Modify `src/lib/workScheduleRepository.ts`: preserve organization methods and add explicit Personal Plan list/save/review methods that call RPCs.
- Modify `src/app/api/work-schedule/route.ts`: keep organization calendar behavior, explicitly write/read `organization` scope, and never apply Personal Plan approval predicates.
- Create `src/app/api/work-schedule/personal/route.ts`: authenticated Personal Plan GET/POST/PATCH review endpoint.
- Modify `src/app/work-schedule/staff/page.tsx` and `src/components/WorkSchedulePageShell.tsx`: use the Personal Plan endpoint and render status/time/review details.
- Modify `src/app/work-schedule/page.tsx`, `src/app/work-schedule/leadership/page.tsx`, `src/components/WorkScheduleAdminShell.tsx`, and `src/components/WorkScheduleSummary.tsx`: use the organization endpoint/scope and remain approval-neutral.
- Create focused tests beside the helper/repository/API contract files, following existing `node:test` patterns.

## Data Contract

The migration adds:

| Column | SQL definition | Write behavior |
| --- | --- | --- |
| `schedule_scope` | `text` nullable; check `NULL`, `personal`, `organization` | Existing rows remain `NULL`; new Personal Plan `personal`; organization writer `organization` |
| `approval_status` | `text not null default 'APPROVED'`; check `PENDING_APPROVAL`, `APPROVED`, `REJECTED` | Existing rows backfill `APPROVED`; Personal Plan create/resubmit sets `PENDING_APPROVAL` |
| `approver_id` | `uuid null references public.staff_users(id)` | Current department manager snapshot or NULL |
| `reviewed_by` | `uuid null references public.staff_users(id)` | Current revision reviewer only |
| `reviewed_at` | `timestamptz null` | Current revision review time |
| `review_note` | `text null` | Approval note or mandatory rejection reason |
| `submitted_at` | `timestamptz null` | New/resubmitted Personal Plan submission time |
| `workflow_revision` | `bigint not null default 0` | Increment on every successful write that changes workflow data |

Legacy backfill is ordered as: add nullable columns; set existing `approval_status` to `APPROVED`; set every revision to `0`; leave `schedule_scope` NULL; add checks/indexes; then set the default for future rows. Do not infer historical scope from participant count, creator role, or `plan_type`.

Required indexes:

- `(schedule_scope, approval_status, work_date, end_date)` for Personal Plan queue/range reads;
- `(created_by, schedule_scope, updated_at desc)` for creator reads;
- `(approver_id, approval_status, updated_at desc)` for expected-approver diagnostics.

Migration verification queries must confirm: all old rows have `approval_status='APPROVED'` and revision `0`; no row has an invalid status/scope; all new test rows have explicit scope; foreign keys resolve; and organization/online-work tables are unchanged.

## Task 1: Add failing validation and workflow primitive tests

**Files:**
- Create: `src/lib/personalPlanValidation.test.mjs`
- Create: `src/lib/personalPlanWorkflow.test.mjs`
- Create: `src/lib/personalPlanValidation.ts`
- Create: `src/lib/personalPlanWorkflow.ts`

**Interfaces:**
- `validateLocalPlanInterval(input: { workDate: string; endDate: string; startTime: string; endTime: string }): { ok: true } | { ok: false; reason: string }`
- `isMaterialPersonalPlanChange(before, after): boolean`
- `canReviewPersonalPlan(actor, row): { ok: true } | { ok: false; reason: string }`
- `isPersonalScope(value): value is "personal"`

- [ ] **Step 1: Write failing tests for date/time rules.** Cover valid dates, leap day, invalid calendar dates, exact `HH:mm`, invalid minutes/hours, same-day strict ordering, multi-day ordering, end-before-start, and a Vietnam-local date that must not shift through UTC.
- [ ] **Step 2: Run the focused tests.** Run `node --test src/lib/personalPlanValidation.test.mjs src/lib/personalPlanWorkflow.test.mjs`; expect failures because helpers do not exist.
- [ ] **Step 3: Implement pure helpers.** Parse date components into an integer civil-day value using a Gregorian calculation or a noon-safe local tuple; never call `new Date("YYYY-MM-DD")` or `Date.parse` for business validation. Compare `dayNumber * 1440 + minuteOfDay` and require a positive interval.
- [ ] **Step 4: Add workflow policy tests.** Cover global roles, current department manager, missing manager, creator-as-manager, cross-department denial, self-approval, non-personal scope denial, and stored `approver_id` not overriding current authorization.
- [ ] **Step 5: Implement workflow policy.** Keep reviewer identity sourced from the authenticated actor object; accept stored row metadata only as input to current-scope checks.
- [ ] **Step 6: Re-run focused tests and commit.** Commit `test: define personal plan validation and review policy`.

## Task 2: Add migration contract tests and additive schema/RPC migration

**Files:**
- Create: `src/lib/personalPlanMigration.test.mjs`
- Create: `supabase/migrations/20260921120000_personal_plan_approval.sql`

**Interfaces:**
- RPC `api_create_personal_work_schedule(p_actor uuid, p_id uuid, p_work_date date, p_end_date date, p_plan_type text, p_start_time time, p_end_time time, p_title text, p_location text, p_notes text, p_participant_ids uuid[], p_expected_revision bigint)` returns `work_schedules`.
- RPC `api_review_personal_work_schedule(p_actor uuid, p_id uuid, p_action text, p_note text, p_expected_revision bigint)` returns `work_schedules`.

- [ ] **Step 1: Write migration contract tests.** Assert exact columns/types/checks/defaults, `schedule_scope` isolation, legacy backfill, indexes, RPC signatures, `security definer`, `service_role` grants, audit action names, and no changes to `online_work_schedules`.
- [ ] **Step 2: Run the migration contract test.** Run `node --test src/lib/personalPlanMigration.test.mjs`; expect failure because the migration is absent.
- [ ] **Step 3: Write the additive migration.** Add columns idempotently, backfill deterministically, add constraints/indexes, and preserve NULL legacy scope. Do not add a destructive reverse migration.
- [ ] **Step 4: Implement `api_create_personal_work_schedule`.** Lock an existing row with `FOR UPDATE`; verify creator/admin ownership; validate the input; classify material changes; promote NULL legacy rows only when called through this Personal Plan RPC; resolve current department manager; set pending/submitted/revision; insert `audit_logs` in the same transaction.
- [ ] **Step 5: Implement `api_review_personal_work_schedule`.** Lock the row; require `schedule_scope='personal'` and `approval_status='PENDING_APPROVAL'`; compare revision; reject self-review; derive current creator department/manager and current actor role; allow only current manager in scope or global roles; require rejection note; update status/review fields/revision; insert the appropriate audit row.
- [ ] **Step 6: Map SQLSTATEs.** Use `42501` for forbidden, `22023` for invalid input, `P0002` for missing/nonexistent row where appropriate, and `40001` for stale revision/non-pending conflict. Keep existing `rpcFailure` mappings unchanged unless a focused test proves a missing mapping is required.
- [ ] **Step 7: Re-run migration contract tests and SQL lint/diff checks.** Commit `feat: add personal plan approval schema and transactional RPCs`.

## Task 3: Add repository/domain methods and organization-scope isolation

**Files:**
- Modify: `src/lib/workScheduleRepository.ts`
- Modify: `src/app/api/work-schedule/route.ts`
- Create: `src/lib/personalPlanRepository.test.mjs`
- Modify: existing work-schedule privacy/contract tests as needed, without weakening them.

**Interfaces:**
- `listPersonal(from, to, actorId, mode): Promise<Result<Row[]>>`
- `savePersonal(actorId, input, expectedRevision, isAdmin): Promise<Result<Row>>`
- `reviewPersonal(actorId, id, action, note, expectedRevision): Promise<Result<Row>>`
- `listOrganization(from, to, participantId?): Promise<Result<Row[]>>`
- `saveOrganization(actorId, input, isAdmin): Promise<Result<Row>>`

- [ ] **Step 1: Write repository tests.** Verify personal reads include approval metadata and only personal/legacy-compatible creator rows; organization reads/writes set organization scope and do not query pending personal rows; Personal Plan methods call the named RPCs and never accept client reviewer IDs.
- [ ] **Step 2: Run focused repository tests.** Run `node --test src/lib/personalPlanRepository.test.mjs`; expect failure for the new methods.
- [ ] **Step 3: Split repository methods by scope.** Preserve existing public organization behavior through explicit methods and add Personal Plan RPC wrappers. Return typed rows with `schedule_scope`, status, approver, reviewer, note, submitted/reviewed timestamps, and revision.
- [ ] **Step 4: Update organization route behavior.** Keep `/api/work-schedule` organization-only for its writer path, explicitly write `schedule_scope='organization'`, and ensure its reads include organization plus NULL legacy rows without applying Personal Plan status gates.
- [ ] **Step 5: Run privacy/regression tests.** Run the focused repository tests plus existing work-schedule privacy tests; commit `refactor: isolate personal and organization schedule repositories`.

## Task 4: Add Personal Plan API and server error contract

**Files:**
- Create: `src/app/api/work-schedule/personal/route.ts`
- Create: `src/lib/personalPlanApi.test.mjs`
- Modify: `src/lib/serverApi.ts` only if a focused conflict/error test requires a new mapping.

**Interfaces:**
- `GET /api/work-schedule/personal?from=YYYY-MM-DD&to=YYYY-MM-DD&scope=self|approval` → `{ rows, approvals? }`.
- `POST /api/work-schedule/personal` create/update body → `{ row }`.
- `PATCH /api/work-schedule/personal` review body `{ id, action: "approve"|"reject", workflowRevision, note? }` → `{ row }`.

- [ ] **Step 1: Write route contract tests.** Cover 400 invalid dates/times/missing fields, 401 unauthenticated, 403 out-of-scope reviewer, 409 stale/non-pending, 500 repository failure, reviewer spoofing rejection, and successful create/update/review payloads.
- [ ] **Step 2: Run the route tests.** Run `node --test src/lib/personalPlanApi.test.mjs`; expect failure because the route is absent.
- [ ] **Step 3: Implement GET.** Require a read actor; validate range; return the creator's personal/legacy rows for staff and a scope-filtered pending queue for authorized managers/global approvers. Never expose an approval queue for organization scope.
- [ ] **Step 4: Implement POST.** Require mutation actor/origin; parse and validate title, dates, times, plan type, participants, notes, and optional `workflowRevision`; call `savePersonal` with actor ID from session. A client `reviewed_by`/`approver_id` is ignored/rejected.
- [ ] **Step 5: Implement PATCH review.** Require mutation actor/origin; validate action/note/revision; call `reviewPersonal`; map `40001` to 409 and preserve existing 401/403/500 conventions.
- [ ] **Step 6: Run route tests and commit.** Commit `feat: expose personal plan approval API`.

## Task 5: Add TDD coverage for full workflow and concurrency

**Files:**
- Create or extend: `src/lib/personalPlanWorkflow.integration.test.mjs`
- Create or extend: `src/lib/personalPlanAudit.test.mjs`

- [ ] **Step 1: Add create-pending tests.** New personal work/business/event rows require both times, set pending/submitted/expected approver, and allow missing-manager NULL approver.
- [ ] **Step 2: Add approval tests.** Manager approval, global approval, self-approval denial, cross-department denial, no-manager global review, and approval of only pending personal rows.
- [ ] **Step 3: Add rejection/resubmission tests.** Rejection requires a reason, persists it, allows creator edit/resubmit, refreshes submission time, reruns approver, and retains prior rejection audit.
- [ ] **Step 4: Add approved-edit tests.** Material type/title/date/time/location/note changes return approved rows to pending; no-op/non-material update leaves status unchanged; prior approval evidence remains in audit history.
- [ ] **Step 5: Add concurrency tests.** Two reviews using one revision produce one success and one 409; stale edit produces 409 without mutation; edit-vs-review race produces one committed revision and two auditable outcomes at most.
- [ ] **Step 6: Add compatibility tests.** Legacy approved rows remain readable; NULL-scope rows do not enter approval queue until Personal Plan edit; organization rows remain approval-neutral; `online_work_schedules` queries/schema are untouched.
- [ ] **Step 7: Run focused suite and commit.** Run `node --test src/lib/personalPlan*.test.mjs src/lib/workSchedulePrivacy.test.mjs src/lib/leaveAttendance.test.mjs src/lib/onlineWork.test.mjs`; commit `test: cover personal plan approval transitions and races`.

## Task 6: Update Personal Plan UI and preserve organization UI

**Files:**
- Modify: `src/components/WorkSchedulePageShell.tsx`
- Modify: `src/app/work-schedule/staff/page.tsx`
- Modify: `src/app/work-schedule/page.tsx`
- Modify: `src/app/work-schedule/leadership/page.tsx`
- Modify: `src/components/WorkScheduleAdminShell.tsx`
- Modify: `src/components/WorkScheduleSummary.tsx`
- Create or extend: `src/components/personalPlanApproval.test.mjs`

- [ ] **Step 1: Write UI contract tests.** Assert required time inputs, Personal Plan endpoint usage, badges/details, approval controls, creator edit behavior, pending-not-effective copy, and organization endpoint isolation.
- [ ] **Step 2: Run UI contract tests.** Run `node --test src/components/personalPlanApproval.test.mjs`; expect failures for missing labels/endpoint wiring.
- [ ] **Step 3: Add form times.** Use native required `time` inputs for every Personal Plan type; preserve date strings as local form values; include current `workflowRevision` on edit.
- [ ] **Step 4: Render status/details.** Show `Chờ phê duyệt`, `Đã duyệt`, `Từ chối`, expected approver, reviewer, reviewed time, rejection reason, and a clear pending-not-effective message. Treat NULL legacy rows as approved display-only until explicitly promoted.
- [ ] **Step 5: Add leadership queue/actions.** Render only server-returned in-scope pending personal rows; hide self-approval controls; send PATCH with revision and rejection note.
- [ ] **Step 6: Preserve organization screens.** Route organization pages/admin summary through the organization endpoint and keep their existing copy/behavior independent of Personal Plan approval.
- [ ] **Step 7: Run UI tests plus TypeScript.** Run `node --test src/components/personalPlanApproval.test.mjs` and `npx tsc --noEmit`; commit `feat: add personal plan approval and local time UI`.

## Task 7: Audit/concurrency hardening and regression validation

**Files:**
- Modify only files exposed by failing focused tests.
- Create: `src/lib/personalPlanReleaseContract.test.mjs` if release checks need a stable contract.

- [ ] **Step 1: Run all focused tests once source is green.** Use `node --test src/lib/personalPlan*.test.mjs src/components/personalPlanApproval.test.mjs src/lib/workSchedulePrivacy.test.mjs src/lib/leaveAttendance.test.mjs src/lib/onlineWork.test.mjs`.
- [ ] **Step 2: Run static validation.** Run `npx tsc --noEmit` and `npm run lint`; fix only feature-scope errors.
- [ ] **Step 3: Run production build.** Run `npm run build`; inspect generated output for the new Personal Plan route and no unexpected online-work/J6 changes.
- [ ] **Step 4: Review migration/RPC safety.** Verify no secret values, no destructive commands, no client reviewer identity, no `schedule_scope` omission in new writers, and no accidental approval predicate on organization/online-work tables.
- [ ] **Step 5: Commit hardening only if needed.** Use a focused message such as `fix: harden personal plan approval concurrency`.

## Commit Sequence

1. `test: define personal plan validation and review policy` — pure helpers and policy tests.
2. `feat: add personal plan approval schema and transactional RPCs` — additive migration, backfill, RPCs, audit/concurrency primitives.
3. `refactor: isolate personal and organization schedule repositories` — repository and organization boundary.
4. `feat: expose personal plan approval API` — Personal Plan GET/POST/PATCH contract.
5. `test: cover personal plan approval transitions and races` — workflow, audit, legacy, and concurrency regression suite.
6. `feat: add personal plan approval and local time UI` — form, badges, queue, and organization UI routing.
7. `fix: harden personal plan approval concurrency` — only if Task 7 identifies a real feature-scope defect.

Every commit must stage only its listed feature files. Never stage the existing dirty files, `.next` artifacts, unrelated migrations, or `PROJECT_STATUS.md` unless a later authorized task explicitly requires it.

## Release and Rollback Plan

- Keep J6 Gate 12-14 paused throughout implementation and release.
- Before migration: create a database backup using the established release checklist; run the migration against a disposable/local schema and inspect verification queries.
- Apply the migration before deploying code that writes `schedule_scope='personal'`; the migration is additive and backfills legacy status only.
- Build a new immutable artifact from the feature commit; do not hot-edit production or `/opt/thoidai-work`.
- Isolated checks before activation: `/login` 200; Personal Plan page loads; create/read pending plan; manager/global review; rejection/resubmission; legacy/organization reads; online-work endpoint unchanged.
- Activate only through the established safe release mechanism after isolated checks pass.
- Post-activation: verify service active/running, `NRestarts` stable, Personal Plan pending/approval flows, organization calendar behavior, `/api/online-work?month=2026-09`, and no J6 regression.
- Current rollback target remains `/opt/releases/thoidai-work/4e22ee6314ffd3e26ab94b0dbf74be14a4075c9d-online-work-month-end-20260921T031920Z` unless a newer approved release supersedes it.
- If application checks fail, roll back the immutable application artifact first. Do not drop approval columns automatically; preserve audit history and use the recorded database backup/reverse procedure only after a separate authorization.

## TDD Command Set

```bash
node --test src/lib/personalPlanValidation.test.mjs src/lib/personalPlanWorkflow.test.mjs
node --test src/lib/personalPlanMigration.test.mjs
node --test src/lib/personalPlanRepository.test.mjs src/lib/personalPlanApi.test.mjs
node --test src/lib/personalPlan*.test.mjs src/components/personalPlanApproval.test.mjs src/lib/workSchedulePrivacy.test.mjs src/lib/leaveAttendance.test.mjs src/lib/onlineWork.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

## Plan Self-Review

- Spec coverage: all approved sections map to Tasks 1-7 or the release plan.
- Discriminator coverage: `schedule_scope` is explicit in migration, writers, reads, tests, and UI routing.
- Legacy coverage: status backfill, NULL scope, promotion, display, and audit are specified.
- Concurrency coverage: revision compare-and-swap, row locks, stale update/review, and double review are specified.
- Completeness scan: each implementation step names concrete files, interfaces, commands, and expected outcomes.
- Scope check: no database/RBAC redesign, online-work behavior change, Journalism/J6 work, or production mutation is included.
