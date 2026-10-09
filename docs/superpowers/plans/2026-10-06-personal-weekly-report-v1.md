# Personal Weekly Work Report V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an employee self-service Friday-to-Friday weekly report with canonical current-work aggregation, next-week proposals, immutable completion snapshots, and Word export without changing production or creating a parallel Task model.

**Architecture:** A new `personal_weekly_reports` persistence layer stores one draft or completed snapshot per employee and period. A shared server view-model aggregates `tasks`, Department Plan links, Quick Reports, and existing Personal Plan proposals; both the page and DOCX exporter consume that model. Server-side RPCs derive ownership from the authenticated actor and make completed rows immutable.

**Tech Stack:** Next.js App Router, React/TypeScript, Supabase/PostgreSQL migrations and SECURITY DEFINER RPCs, existing `docx` package, Node test runner, ESLint, TypeScript compiler, production webpack build.

**Spec:** `docs/superpowers/specs/2026-10-06-personal-weekly-report-design.md`

## Global Constraints

- Reuse canonical `tasks`, `task_assignees`, `department_plan_items`, Quick Report `REPORT_ONLY`, and `work_schedules` Personal Plan data.
- Use the existing Friday-to-Friday helper in `src/lib/departmentPlanPeriod.ts`; do not introduce Monday-Sunday semantics.
- Never trust a client-supplied `user_id`; derive employee identity from the authenticated session.
- Do not mutate canonical Task title/status/description while saving report-specific commentary.
- Completed reports are immutable historical snapshots and export from the snapshot dataset.
- New next-week work goes through the existing Personal Plan proposal/approval flow and never fabricates an assigned Task.
- No management reporting expansion, RBAC redesign, production deployment, database push, or unrelated cleanup.

---

### Task 1: Add the bounded report persistence migration

**Files:**
- Create: `supabase/migrations/20261006130000_personal_weekly_reports.sql`
- Create: `src/lib/personalWeeklyReportMigration.test.mjs`

**Interfaces:**
- Produces table `public.personal_weekly_reports` and RPCs `api_save_personal_weekly_report(uuid,uuid,date,date,jsonb,text)` and `api_complete_personal_weekly_report(uuid,uuid,date,date,jsonb,text)`.
- RPCs return the full `personal_weekly_reports` row and reject actor/report ownership mismatches with SQLSTATE `42501`.

- [ ] **Step 1: Write failing migration contract tests** asserting the table, unique employee-period key, `DRAFT`/`COMPLETED` check, snapshot requirement, employee index, SECURITY DEFINER RPCs, server-only grants, and completed-row immutability trigger.
- [ ] **Step 2: Run `node --test src/lib/personalWeeklyReportMigration.test.mjs`** and verify failure because the migration does not exist.
- [ ] **Step 3: Write the migration.** Create the table with employee/department FKs, dates, status, `draft_payload`, `snapshot_payload`, difficulties, timestamps, unique `(employee_id, period_start, period_end)`, and the completed-state check. Add the employee-period index. Add a trigger that rejects UPDATE/DELETE when `OLD.status = 'COMPLETED'`. Implement save-draft RPC with actor ownership, period validation, `INSERT ... ON CONFLICT` for drafts only, and completion RPC that locks the row, returns an existing completed row unchanged, or writes the snapshot and completion timestamp atomically. Revoke public/anon/authenticated execution and grant only `service_role`.
- [ ] **Step 4: Re-run the migration contract tests** and verify PASS.
- [ ] **Step 5: Commit** with `git add supabase/migrations/20261006130000_personal_weekly_reports.sql src/lib/personalWeeklyReportMigration.test.mjs && git commit -m "feat: persist personal weekly report snapshots"`.

### Task 2: Build the pure period, aggregation, and payload view model

**Files:**
- Create: `src/lib/personalWeeklyReport.ts`
- Create: `src/lib/personalWeeklyReport.test.mjs`

**Interfaces:**
- `personalWeeklyPeriod(anchor?: string | null): { current: { start: string; end: string }; next: { start: string; end: string } }`.
- `dedupePersonalWeeklyTasks(rows): PersonalWeeklyCurrentRow[]` keyed by canonical `taskId`, preserving `REPORT_ONLY`, Department Plan, and assigned source labels.
- `buildNextWeekCandidates(rows, nextPeriod): PersonalWeeklyNextRow[]` reusing active task IDs for LONG_RUNNING/CARRY_OVER/RECURRING and excluding done/cancelled.
- `validatePersonalWeeklyDraft(payload): { ok: true; value: PersonalWeeklyDraft } | { ok: false; message: string }` with bounded row counts and duplicate rejection.

- [ ] **Step 1: Write failing tests for cases A-G, M, and payload validation.** Cover five assigned Tasks, two REPORT_ONLY rows, duplicate source links, LONG_RUNNING and CARRY_OVER task ID reuse, completed/cancelled exclusion, and exact 02/10/2026 → 09/10/2026 → 16/10/2026 boundaries.
- [ ] **Step 2: Run `node --test src/lib/personalWeeklyReport.test.mjs`** and verify expected failures.
- [ ] **Step 3: Implement the pure functions** using `getDepartmentPlanPeriod`, canonical task status, `workflow_type`, `task_assignees`, and Department Plan relation data. Keep period commentary separate from canonical task fields.
- [ ] **Step 4: Re-run the focused tests** and verify PASS.
- [ ] **Step 5: Commit** with `git add src/lib/personalWeeklyReport.ts src/lib/personalWeeklyReport.test.mjs && git commit -m "feat: model personal weekly report periods"`.

### Task 3: Add the authenticated repository/service layer

**Files:**
- Create: `src/lib/personalWeeklyReportRepository.ts`
- Create: `src/lib/personalWeeklyReportService.ts`
- Create: `src/lib/personalWeeklyReportService.test.mjs`

**Interfaces:**
- `getPersonalWeeklyReport(actorId, period): Promise<PersonalWeeklyReportLoad>` loads the actor's report, bounded history, canonical current rows, next candidates, and existing Personal Plan proposals.
- `savePersonalWeeklyDraft(actorId, input): Promise<Result<PersonalWeeklyReport>>` calls `api_save_personal_weekly_report`.
- `completePersonalWeeklyReport(actorId, input): Promise<Result<PersonalWeeklyReport>>` builds the snapshot and calls `api_complete_personal_weekly_report`.
- `loadPersonalWeeklyReport(request): Promise<{ ok: true; data: PersonalWeeklyReportLoad } | { ok: false; response: Response }>` uses `requireReadActor`/`requireMutationActor` and ignores client user IDs.

- [ ] **Step 1: Write failing tests** for self-only loading, cross-user denial, source aggregation, proposal references through `work_schedules`, immutable completion behavior, and bounded newest-first history.
- [ ] **Step 2: Run the service tests** and verify failures for missing modules/functions.
- [ ] **Step 3: Implement repository queries** against `tasks`, `task_assignees`, `department_plan_items`, `department_plans`, and `work_schedules`, normalize Supabase nested rows, dedupe through Task IDs, and call the existing Personal Plan repository/RPC without creating Tasks.
- [ ] **Step 4: Implement service authorization and response mapping** with actor-derived IDs, `period` query validation, bounded history size, and consistent error mapping.
- [ ] **Step 5: Re-run service tests** and verify PASS.
- [ ] **Step 6: Commit** with `git add src/lib/personalWeeklyReportRepository.ts src/lib/personalWeeklyReportService.ts src/lib/personalWeeklyReportService.test.mjs && git commit -m "feat: aggregate personal weekly report data"`.

### Task 4: Expose weekly report APIs and shared DOCX export

**Files:**
- Create: `src/app/api/reports/weekly/route.ts`
- Create: `src/app/api/reports/weekly/complete/route.ts`
- Create: `src/app/api/reports/weekly/docx/route.ts`
- Create: `src/lib/personalWeeklyReportDocx.ts`
- Create: `src/lib/personalWeeklyReportApi.test.mjs`

**Interfaces:**
- `GET /api/reports/weekly` returns the service view model.
- `POST /api/reports/weekly` accepts only validated draft fields and returns the draft row.
- `POST /api/reports/weekly/complete` completes or idempotently returns the actor's completed snapshot.
- `GET /api/reports/weekly/docx` exports `personalWeeklyReportDocxFilename(employeeName, period)` and `exportPersonalWeeklyReportDocx(viewModel)`.

- [ ] **Step 1: Write failing route/export contract tests** for status codes, self-only behavior, no client user ID use, route availability, exact Vietnamese headings, and UI/export row-count parity.
- [ ] **Step 2: Run `node --test src/lib/personalWeeklyReportApi.test.mjs`** and verify failures.
- [ ] **Step 3: Implement the three route handlers** using existing server guards, JSON parsing helpers, and the service layer. The DOCX route must load the same completed snapshot/view model and set the DOCX content type and safe filename.
- [ ] **Step 4: Implement the DOCX document** with current results, next-week plan, difficulties, employee/department/period metadata, and exact Vietnamese Unicode text.
- [ ] **Step 5: Re-run route/export tests** and verify PASS.
- [ ] **Step 6: Commit** with `git add src/app/api/reports/weekly src/lib/personalWeeklyReportDocx.ts src/lib/personalWeeklyReportApi.test.mjs && git commit -m "feat: expose weekly report and Word export APIs"`.

### Task 5: Build the employee UI and navigation entry

**Files:**
- Create: `src/app/reports/weekly/page.tsx`
- Create: `src/components/PersonalWeeklyReportPage.tsx`
- Modify: `src/components/phase2Navigation.ts`
- Modify: `src/components/AppNav.tsx`
- Create: `src/lib/personalWeeklyReportUi.test.mjs`

**Interfaces:**
- Page loads the server view model and renders `PersonalWeeklyReportPage`.
- `PersonalWeeklyReportPage` renders current results, next-week plan/proposals, difficulties, draft/completed actions, history, and mobile-safe layouts.

- [ ] **Step 1: Write failing UI contract tests** for the `Báo cáo tuần` link, three sections, `Lưu nháp`, `Hoàn thành báo cáo`, `Xuất Word`, history labels, empty state, and responsive card/scroll behavior.
- [ ] **Step 2: Run `node --test src/lib/personalWeeklyReportUi.test.mjs`** and verify missing-route/component failures.
- [ ] **Step 3: Add the navigation item** without changing existing sidebar grouping or permission semantics; label it `Báo cáo tuần` and link `/reports/weekly` for authenticated employees.
- [ ] **Step 4: Implement the page/component** with period context, canonical rows, period-specific commentary fields, next-week continuation selection, proposal creation through the existing Personal Plan UI/API, draft save, completion confirmation, history navigation, empty state, and mobile layout.
- [ ] **Step 5: Re-run UI tests** and verify PASS.
- [ ] **Step 6: Commit** with `git add src/app/reports/weekly src/components/PersonalWeeklyReportPage.tsx src/components/phase2Navigation.ts src/components/AppNav.tsx src/lib/personalWeeklyReportUi.test.mjs && git commit -m "feat: add employee weekly report page"`.

### Task 6: Complete regression and production-like verification

**Files:**
- Modify only tests or implementation files if a focused failure proves a defect in Tasks 1-5.

- [ ] **Step 1: Run focused cases A-N** using `node --test` for period/model/service/API/UI/DOCX tests and record each result.
- [ ] **Step 2: Run required regressions** for Task Center, Work Report, Department Plan and period summary, Personal Plan/approval, Quick Report, Attendance/late exception/admin notes, LONG_RUNNING/CARRY_OVER, bulk cancel, and Task/Plan cancel synchronization.
- [ ] **Step 3: Run `npx tsc --noEmit`, `npx eslint` against every changed `.ts`, `.tsx`, and `.mjs` file, and `git diff --check`.** Fix only feature-caused failures; this repository does not define a separate `typecheck` script.
- [ ] **Step 4: Run the repository's production-like webpack build from the clean feature worktree without lineage overrides.** Do not deploy or mutate production.
- [ ] **Step 5: Run `npm run check:routes`, `npm run package:standalone`, and `npm run verify:standalone` when the build gate requires an artifact; verify production remains unchanged.
- [ ] **Step 6: Commit any verified test/config fixes, push `feature/personal-weekly-report-v1`, verify local HEAD equals remote HEAD, and stop for owner deployment approval.

## Plan Self-Review

- Tasks cover schema, pure business logic, server aggregation, API/export, UI/navigation, and all required verification gates.
- Interfaces are consistent: service returns one view model consumed by both page and DOCX; RPC names/signatures are fixed in Task 1 and consumed in Task 3.
- No task creates a parallel Task model or changes existing Task semantics.
- The only migration is the bounded weekly report persistence/snapshot migration.
- Production deployment is intentionally absent from the final task.
