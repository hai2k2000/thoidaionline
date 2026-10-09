# Task 5 Report — employee weekly report page

## Scope

Implemented the employee self-service weekly report route and navigation entry using the shared `PersonalWeeklyReportLoad` view model. Existing Task Center, Work Report, Attendance, and Personal Plan navigation semantics remain unchanged.

## Delivered

- Added `/reports/weekly` server page with authenticated-session loading and redirect behavior.
- Added responsive `PersonalWeeklyReportPage` with current results, next-week continuation selection, difficulties/recommendations, bounded history, and empty states.
- Added draft save through `POST /api/reports/weekly` and completion confirmation through `POST /api/reports/weekly/complete`.
- Completed reports are read-only and expose the shared DOCX export route.
- Added Personal Plan proposal handoff through the existing `/api/work-schedule/personal` endpoint; proposals remain approval based and do not create Tasks.
- Added the employee navigation entry `Báo cáo tuần` at `/reports/weekly` without a new permission or sidebar restructuring.
- Added `src/lib/personalWeeklyReportUi.test.mjs` covering route loading, navigation, required sections, actions, empty state, mobile layout, and completed snapshot read-only behavior.

## Verification

- `node --test src/lib/personalWeeklyReportUi.test.mjs personalPlanApprovalUi.test.mjs`: 9 passed.
- `git diff --check`: passed.
- Changed-file ESLint: 0 errors; existing AppNav warnings remain, with no new warning after removing the unused state setter.
- `npx tsc --noEmit`: repository remains blocked by the pre-existing `src/lib/personalWeeklyReport.ts(1,41)` `.ts` import-extension diagnostic; no diagnostic points to Task 5 files.

## Commit

`feat: add employee weekly report page`

## Follow-up fix

- Draft hydration now distinguishes omitted fields from intentionally empty `currentRows`, `nextRows`, and `difficulties`, so a saved empty next-week selection remains empty after reload.
- Regression test: `reloaded drafts preserve intentionally empty selections and commentary`.
- Verification: `node --test src/lib/personalWeeklyReportUi.test.mjs` — 6 passed; changed component ESLint — 0 errors; `git diff --check` — passed.
- Follow-up commit: `fix: preserve empty weekly draft selections`.
