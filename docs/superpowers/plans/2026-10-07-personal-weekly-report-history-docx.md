# Personal Weekly Report History + Template DOCX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let employees open bounded historical completed weekly reports and export each immutable snapshot as a formal Vietnamese weekly-work-plan DOCX.

**Architecture:** Keep the existing `personal_weekly_reports` schema and actor-derived service. Add report-id selection to repository/service/page loading, enforce completed self-only historical access, and pass one snapshot-backed view model to both UI and DOCX. Replace the technical-table exporter with a narrative/list document using the approved template headings, while preserving the existing current draft/completion workflow.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase server repository, `docx`, Node test runner, LibreOffice render QA.

**Spec:** `C:\Users\hai2k\.codex\attachments\1ebef1fe-e2e0-46bb-9e7d-4118fefd92dc\Pasted text.txt`

## Global Constraints

- No migration unless the existing snapshot/history schema is proven insufficient.
- Actor identity is always derived server-side; browser `report`, `period`, and employee identifiers cannot widen access.
- Completed reports are immutable and historical UI/DOCX read only `snapshot_payload`.
- Keep Quick Report, Personal Plan, Department Plan, Task Center, Attendance, and current draft workflow unchanged.
- Do not deploy production.

### Task 1: Historical repository/service contract

**Files:**
- Modify: `src/lib/personalWeeklyReportRepository.ts`
- Modify: `src/lib/personalWeeklyReportService.ts`
- Test: `src/lib/personalWeeklyReportService.test.mjs`
- Test: `src/lib/personalWeeklyReportApi.test.mjs`

- [ ] Add failing tests for `report=<uuid>` lookup, completed-only self scope, and snapshot-only historical load.
- [ ] Extend repository load options with an optional report id; query `id` + actor and reject non-completed/missing rows without exposing ownership.
- [ ] Preserve current-period loading when no report id is supplied; return a shared `historical`/read-only indicator for selected completed reports.
- [ ] Add focused tests and commit `feat: add self-scoped weekly report history loading`.

### Task 2: Historical page and read-only UI

**Files:**
- Modify: `src/app/reports/weekly/page.tsx`
- Modify: `src/components/PersonalWeeklyReportPage.tsx`
- Modify: `src/lib/personalWeeklyReportUi.test.mjs`

- [ ] Add failing tests for report-id links, bounded newest-first history actions, read-only historical mode, and no live task hydration.
- [ ] Parse `report` in the route and pass it to the service; render the selected snapshot with explicit period/status context.
- [ ] Reuse the page component with read-only completed mode and separate `Xem báo cáo`/`Xuất Word` actions for history rows.
- [ ] Keep draft controls and current-period behavior unchanged; commit `feat: add historical weekly report view`.

### Task 3: Snapshot-backed DOCX endpoint and template exporter

**Files:**
- Modify: `src/app/api/reports/weekly/docx/route.ts`
- Modify: `src/lib/personalWeeklyReportDocx.ts`
- Modify: `src/lib/personalWeeklyReportApi.test.mjs`
- Modify: `src/lib/personalWeeklyReport.test.mjs`

- [ ] Add failing tests for report-id export, exact template headings, snapshot employee/department/period, no IDs/enums, and safe filename.
- [ ] Make DOCX route require a completed self-scoped report id (while retaining current-period compatibility only if it resolves to that completed report).
- [ ] Build A4 portrait narrative DOCX with administrative header, sections I-IV, signature, footer text, and page-number field; use only the supplied snapshot view model.
- [ ] Add empty-value handling and preserve Vietnamese Unicode; commit `feat: export historical weekly reports from template snapshot`.

### Task 4: Fixtures and visual QA

**Files:**
- Create: `scripts/fixtures/personal-weekly-report-docx.mjs`
- Create: `scripts/fixtures/README.md`
- Create: `artifacts/personal-weekly-report-docx/.gitkeep`

- [ ] Generate short, normal, and long fixture DOCX files from the exporter view model.
- [ ] Render each with the packaged `render_docx.py` tool and inspect all page PNGs for alignment, Unicode, pagination, footer, and signature.
- [ ] Record visual verification notes without committing generated binaries; commit `test: add weekly report docx visual fixtures`.

### Task 5: Regression and release gates

**Files:**
- Modify: focused tests only if a discovered contract needs coverage.

- [ ] Run cases A-N, weekly-report regressions, and preserved feature regressions.
- [ ] Run TypeScript, changed-file lint, `git diff --check`, `check:routes`, standalone packaging/verifier, and production-like webpack build.
- [ ] Self-review diff and commit any final test-only adjustments.
- [ ] Push `feature/personal-weekly-report-history-docx`, verify local HEAD equals remote HEAD, and stop without merge/deploy.
