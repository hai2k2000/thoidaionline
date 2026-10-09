# Weekly Report Add Work Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow reopened weekly-report drafts to add eligible canonical Tasks or new `REPORT_ONLY` Quick Report work while preserving immutable versions.

**Architecture:** Extend the existing weekly-report repository/service view model with server-filtered candidates and draft allow-list validation. Reuse the existing Quick Report service for sudden work and the existing report save/complete RPCs so draft JSON remains the only persistence change. Add compact draft-only controls to the existing weekly report component and keep DOCX sourced from the completed snapshot view model.

**Tech Stack:** Next.js App Router, React/TypeScript, Supabase RPC/repository patterns, Node `node:test`, existing `docx` exporter.

**Spec:** `docs/superpowers/specs/2026-10-08-weekly-report-add-work-design.md`

## Global Constraints

- No migration unless existing draft/snapshot persistence is proven insufficient.
- Actor identity comes only from authenticated server session.
- Existing Task selection is self-only, period-scoped, non-cancelled, non-watcher.
- Sudden work uses existing `REPORT_ONLY` Quick Report flow and permission.
- Removing from the report mutates only the draft selection.
- Version 1 remains immutable; re-completion creates a new snapshot version.
- Next-week Personal Plan behavior is unchanged.
- Production remains unchanged.

### Task 1: Model and allow-list contracts

**Files:**
- Modify: `src/lib/personalWeeklyReport.ts`
- Test: `src/lib/personalWeeklyReportAddWork.test.mjs`

**Interfaces:**
- Produce `filterPersonalWeeklyAddableRows(rows, selectedIds)` and `validatePersonalWeeklyCurrentRows(rows, allowedIds)`.
- Produce a typed `PersonalWeeklyAddableRow`/capability shape consumed by repository and UI.

- [ ] Write failing tests for candidate filtering, duplicate blocking, cancelled/watcher exclusion, and report-local commentary preservation.
- [ ] Run `node --test src/lib/personalWeeklyReportAddWork.test.mjs` and confirm the new assertions fail for the missing exports/behavior.
- [ ] Implement the smallest pure helpers using existing `taskId`/source normalization and no database calls.
- [ ] Run the focused test until all model assertions pass.
- [ ] Commit `feat: define weekly report add-work contracts`.

### Task 2: Repository/service and Quick Report boundary

**Files:**
- Modify: `src/lib/personalWeeklyReportRepository.ts`
- Modify: `src/lib/personalWeeklyReportService.ts`
- Create or modify: `src/app/api/reports/weekly/add-work/route.ts` only if the existing Quick Report service cannot be safely called from the client boundary.
- Test: `src/lib/personalWeeklyReportAddWorkServer.test.mjs`

**Interfaces:**
- Extend `PersonalWeeklyReportLoad` with `addableCurrentRows` and `canCreateQuickReport`.
- Export `addExistingPersonalWeeklyTasksToDraft`/`removePersonalWeeklyTaskFromDraft` pure service helpers or equivalent validated service entry points.

- [ ] Write failing server-contract tests for actor-derived scope, period filtering, no watcher-only candidates, no client actor IDs, and Quick Report permission/date enforcement.
- [ ] Run the focused server tests and confirm failure.
- [ ] Implement candidate hydration from the existing `tasks` query and allow-list validation before save/complete RPC calls.
- [ ] Reuse the existing Quick Report service/RPC for sudden work; reject out-of-period dates and preserve idempotency.
- [ ] Run focused server tests plus existing weekly report service/API tests.
- [ ] Commit `feat: secure weekly report add-work service flow`.

### Task 3: Draft UI add/remove flow

**Files:**
- Modify: `src/components/PersonalWeeklyReportPage.tsx`
- Test: `src/lib/personalWeeklyReportAddWorkUi.test.mjs`
- Modify only related weekly UI contract tests as needed.

**Interfaces:**
- Consume `addableCurrentRows` and `canCreateQuickReport` from the load model.
- Keep `currentRows`, `draftPayload`, save, and complete request shapes backward-compatible.

- [ ] Write failing UI contract tests for the button/modal copy, existing Task multi-select, sudden-work permission hiding, remove-from-draft behavior, and read-only completed/history views.
- [ ] Run the focused UI tests and confirm failure.
- [ ] Implement compact modal state and local draft row selection/commentary without duplicating Quick Report validation/business logic.
- [ ] Wire existing-task add/remove and sudden-work creation to refresh the weekly report data.
- [ ] Run focused UI tests and existing weekly report UI tests.
- [ ] Commit `feat: add work controls to weekly report drafts`.

### Task 4: Snapshot/DOCX/regression closure

**Files:**
- Modify: `src/lib/personalWeeklyReportService.ts` if snapshot merge needs the new selected rows.
- Modify: `src/lib/personalWeeklyReportDocx.ts` only if the shared view model requires a bounded display adjustment.
- Test: `src/lib/personalWeeklyReportAddWorkVersioning.test.mjs`
- Existing tests: weekly report reopen/version/DOCX, Quick Report, Personal Plan.

- [ ] Write failing tests for Version 2 containing added Task + sudden work, Version 1 exclusion, DOCX Section II inclusion, and unchanged Personal Plan proposals.
- [ ] Run the focused versioning test and confirm failure.
- [ ] Implement only the snapshot/view-model merge required for the tests; do not add schema or alter completed-row history.
- [ ] Run Cases A-K and all required regressions.
- [ ] Run TypeScript, changed-file lint, `git diff --check`, route check, and build if disk is at least the repository hard minimum.
- [ ] Self-review the final diff for scope, actor trust, canonical Task mutation, and accidental migration changes.
- [ ] Commit `test: close weekly report add-work versioning coverage` if changes remain.
- [ ] Push `feature/weekly-report-add-work` and verify local HEAD equals remote HEAD.

