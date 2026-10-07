# Personal Weekly Report Reopen + Version History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure, versioned reopen/re-completion for Personal Weekly Report while preserving immutable historical snapshots and existing report/DOCX behavior.

**Architecture:** Extend the existing weekly report migration with an immutable version table and transaction-safe service RPCs. Keep actor derivation and authorization server-side, expose reopen/version history through the current repository/service/API/page flow, and keep historical DOCX generation snapshot-backed.

**Tech Stack:** Next.js App Router, TypeScript, Supabase PostgreSQL/PLpgSQL, Node `node:test`, JSZip DOCX tests, ESLint, TypeScript compiler, webpack production build.

**Spec:** `docs/superpowers/specs/2026-10-07-personal-weekly-report-reopen-versioning-design.md`

## Global Constraints

- Do not deploy production; production changed must remain `NO`.
- Create one bounded migration only; no broad backfill, `supabase db push`, `supabase db reset`, migration replay, or ledger repair.
- Do not change Task, Department Plan, Quick Report REPORT_ONLY, Personal Plan approval, Attendance, or unrelated RBAC semantics.
- Never accept browser-supplied employee/user ownership overrides; derive actor from the authenticated server session.
- Completed reports and version rows are immutable except the single authorized `COMPLETED -> DRAFT` reopen transition.
- Preserve existing completed rows without version rows through lazy Version 1 creation on reopen.
- Run a bounded VPS disk audit before any production-like build; stop below the repository's 20 GiB hard minimum.

### Task 1: Migration contract and disposable rehearsal

**Files:**
- Create: `supabase/migrations/20261007100000_personal_weekly_report_reopen_versions.sql`
- Create: `supabase/tests/personal_weekly_report_reopen_versions.sql`
- Create: `src/lib/personalWeeklyReportReopenMigration.test.mjs`
- Modify: `scripts/schema-contracts.mjs` only if the repository's contract list requires the new table

**Interfaces:**
- Produces table `public.personal_weekly_report_versions` and server-only RPCs `api_reopen_personal_weekly_report` plus the version-aware `api_complete_personal_weekly_report` contract consumed by later tasks.
- Reuses the existing `personal_weekly_reports` columns, `audit_logs`, canonical admin authorization helper, and completion trigger conventions.

- [ ] **Step 1: Write failing migration contract tests** asserting the migration defines the exact version columns, unique/index constraints, immutable trigger, reopen RPC, version insertion in completion, actor/role checks, 24-hour rule, reason bounds, audit action, grants/revokes, and narrow completed-row transition guard.
- [ ] **Step 2: Run the migration contract test** with `node --test src/lib/personalWeeklyReportReopenMigration.test.mjs`; confirm it fails because the migration and contracts do not exist.
- [ ] **Step 3: Write the bounded migration** using `begin; ... commit;`, `create table`, `create index`, immutable `before update or delete` trigger, `security definer` RPCs, row locking, `coalesce(max(version_no), 0) + 1` under the locked report, lazy legacy seed, audit insert, and service-role-only grants. Ensure no `on delete cascade` is introduced for historical versions.
- [ ] **Step 4: Add disposable SQL rehearsal cases** for A–N, including 23:59 allowed, exact 24:00 behavior, post-24h denial, admin reopening, cross-user denial, empty/short/long reason rejection, snapshot seeding, Version 2 creation, unchanged Version 1, direct update/delete rejection, legacy lazy seed, and audit row.
- [ ] **Step 5: Run the migration contract test** and the isolated PostgreSQL rehearsal with the repository's established disposable runner; require PASS and zero production DB/ledger changes.
- [ ] **Step 6: Self-review the SQL diff** for transaction boundaries, privilege leakage, ownership bypasses, destructive cascades, and accidental unrelated schema changes.
- [ ] **Step 7: Commit** `feat: add immutable weekly report reopen versions`.

### Task 2: Repository and service contracts

**Files:**
- Modify: `src/lib/personalWeeklyReportRepository.ts`
- Modify: `src/lib/personalWeeklyReportService.ts`
- Modify: `src/lib/personalWeeklyReport.ts` only for version/reopen view-model types
- Create: `src/lib/personalWeeklyReportReopenService.test.mjs`

**Interfaces:**
- Produces `reopenPersonalWeeklyReport(actorId, reportId, reason)`, `listPersonalWeeklyReportVersions(actorId, reportId)`, and version-aware load fields for page/API consumers.
- Reopen repository calls only the server RPC with `p_actor`, `p_report_id`, and `p_reason`; version reads remain actor-scoped by report ownership.

- [ ] **Step 1: Write failing tests** for successful reopen input mapping, server-derived actor/no employee override, reason trimming, safe error mapping, self-only version loading, and latest/current version selection.
- [ ] **Step 2: Run `node --test src/lib/personalWeeklyReportReopenService.test.mjs`** and confirm expected failures for missing repository/service functions.
- [ ] **Step 3: Add typed version/reopen fields** (`version_no`, `completed_by`, `completed_at`, `is_current`, reopen eligibility/reason state) without exposing database IDs in display labels.
- [ ] **Step 4: Implement repository RPC/read helpers** using existing `serverSupabase` patterns and actor-scoped filters; do not query live tasks for historical versions.
- [ ] **Step 5: Implement service authorization mapping** through `requireMutationActor`, canonical admin helper, and safe not-found/forbidden responses. Enforce reason validation before RPC invocation.
- [ ] **Step 6: Run focused service/repository tests plus existing 45-report suite**; fix only bounded failures.
- [ ] **Step 7: Self-review diff** for direct table/RPC exposure and cross-user leakage.
- [ ] **Step 8: Commit** `feat: expose weekly report reopen and version history services`.

### Task 3: API routes and historical DOCX/version data

**Files:**
- Create: `src/app/api/reports/weekly/reopen/route.ts`
- Modify: `src/app/api/reports/weekly/route.ts`
- Modify: `src/app/api/reports/weekly/docx/route.ts`
- Modify: `src/app/reports/weekly/page.tsx`
- Modify: `src/lib/personalWeeklyReportApi.test.mjs`
- Modify: `src/lib/personalWeeklyReportDocx.ts` only if latest-version metadata needs explicit view-model support

**Interfaces:**
- `POST /api/reports/weekly/reopen` accepts only `{ reportId, reason }`, obtains actor from session, and returns the reopened DRAFT view.
- Weekly GET exposes version history/reopen eligibility for the authenticated actor; DOCX continues to export only completed snapshot/latest version, never an active draft.

- [ ] **Step 1: Write failing route tests** for reopen POST shape, no employee/user override, auth guard, reason validation, version history response, latest completed DOCX behavior, and rejection of DOCX for reopened DRAFT.
- [ ] **Step 2: Run the focused API tests** and confirm failures before route implementation.
- [ ] **Step 3: Implement the reopen route** with `requireMutationActor`, `readJsonObject`, strict report ID/reason parsing, service call, and safe status/error mapping.
- [ ] **Step 4: Extend weekly GET/service serialization** with current version and bounded version history while preserving existing historical report query behavior.
- [ ] **Step 5: Update DOCX route** to resolve the latest completed snapshot/version and return an authorization/not-found response when the main report is DRAFT.
- [ ] **Step 6: Run focused API/DOCX tests and existing weekly API tests**; verify no employee override can enter any path.
- [ ] **Step 7: Commit** `feat: add weekly report reopen API and version-aware export`.

### Task 4: Weekly report UI

**Files:**
- Modify: `src/components/PersonalWeeklyReportPage.tsx`
- Modify: `src/lib/personalWeeklyReportUi.test.mjs`
- Modify: `src/app/reports/weekly/page.tsx` only if initial props need version data

**Interfaces:**
- Completed own report within 24h renders “Mở lại báo cáo”; after 24h hides it; admin receives the action regardless of age through server-provided eligibility.
- Reopen modal requires a reason and confirmation; reopened report shows “Đang chỉnh sửa lại”, editable draft controls, and read-only version history.

- [ ] **Step 1: Write failing UI contract tests** for eligibility labels, modal text/required reason, cancel/submit controls, reopened badge, version 2/current vs version 1/replaced labels, no old-version editing, and draft completion controls after reopen.
- [ ] **Step 2: Run the focused UI tests** and confirm expected failures.
- [ ] **Step 3: Add reopen modal state and POST flow** with client-side required/length validation, loading/error feedback, and reload/hydration from the returned DRAFT.
- [ ] **Step 4: Add version history read-only section** and status copy without exposing IDs or changing existing current/historical report navigation.
- [ ] **Step 5: Keep completed and historical textareas disabled** while allowing reopened DRAFT editing and re-completion through existing validation.
- [ ] **Step 6: Run UI tests plus TypeScript; self-review responsive/accessibility states.**
- [ ] **Step 7: Commit** `feat: add weekly report reopen and version history UI`.

### Task 5: Full regression and artifact gates

**Files:**
- Modify only test/fixture or bounded implementation files required by failing gates.
- Create or update: `scripts/fixtures/personal-weekly-report-reopen-versions.sql` only if the disposable runner needs a dedicated fixture.

- [ ] **Step 1: Run cases A–N against the disposable database** and record the migration rehearsal result.
- [ ] **Step 2: Run weekly report/history/DOCX focused suites.**
- [ ] **Step 3: Run required regressions for Task aggregation, Quick Report, LONG_RUNNING, CARRY_OVER, Personal Plan, Department Plan, Task Center, and Attendance.**
- [ ] **Step 4: Run `npx tsc --noEmit`, changed-file ESLint, `git diff --check`, and `npm run check:routes`.**
- [ ] **Step 5: Run bounded VPS disk audit; require at least 20 GiB free and protect active/rollback releases, DB, Docker volumes, backups, and dirty worktrees.**
- [ ] **Step 6: Run the natural-lineage webpack production build, package standalone, and verify BUILD_ID, route manifest, runtime verifier, env symlink contract, `.next/cache`, and provenance.**
- [ ] **Step 7: Perform final self-review and verify no production state changed.**
- [ ] **Step 8: Commit any verified gate-only fixes separately, push `feature/personal-weekly-report-reopen-version-history`, and verify local HEAD equals remote HEAD.**

## Final return contract

Return `WEEKLY REPORT REOPEN + VERSIONING RESULT` with migration/rehearsal, version immutability, first/second completion, employee/admin authorization, reason, cross-user denial, lazy legacy versioning, audit, focused/regression tests, TypeScript, lint, build, disk gate, branch/commit, remote synchronization, and `Production changed: NO`. Stop and await owner deployment approval.
