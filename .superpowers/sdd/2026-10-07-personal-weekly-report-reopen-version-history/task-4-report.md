# Task 4 report: Weekly report reopen and version history UI

## Status

Implemented the bounded UI changes in `PersonalWeeklyReportPage.tsx` and added focused UI contract tests in `personalWeeklyReportUi.test.mjs`.

## Delivered

- Consumes server-provided `reopenEligibility`; the self-service action is fail-closed unless `eligible === true`. Admin eligibility is honored through the same server field.
- Adds the `Mở lại báo cáo` confirmation dialog with the required explanatory copy, required `Lý do mở lại *` field, `Huỷ`, loading state, validation, and error feedback.
- Sends only `{ reportId, reason }` to `POST /api/reports/weekly/reopen`; the browser does not calculate eligibility or provide an employee override.
- Shows `Đang chỉnh sửa lại` for a reopened draft. Existing draft controls remain editable; completed and historical report controls remain disabled.
- Adds read-only `Lịch sử phiên bản` entries with version number, completion timestamp, and `Đang dùng`/`Đã thay thế` labels. No version IDs are rendered and no old-version edit controls are offered.
- Preserves current/history navigation, Word export behavior for completed reports, Personal Plan proposals, task aggregation, Quick Report links, and existing validation.
- Keeps older-week draft rows reachable from the existing history list.

## Verification

- `node --test src/lib/personalWeeklyReportUi.test.mjs` — 14 passed, 0 failed.
- `npx tsc --noEmit` — passed.
- `npx eslint src/components/PersonalWeeklyReportPage.tsx` — passed.
- `git diff --check` — passed.

## Interface concern for Task 2/server owner

`personalWeeklyReopenEligibility` currently returns `eligible: null` for a completed own report, so the employee `Mở lại báo cáo` action remains hidden even when the report is within the server-approved window. The UI intentionally does not infer eligibility from `completed_at` or a browser clock. The server/repository interface must return `eligible: true` for verified eligible self reports and `eligible: false` with an appropriate reason for expired/forbidden/unknown outcomes. No server or migration files were changed in Task 4.

Production changed: NO.

## Fix round 1 review response

Commit: pending.

Addressed all requested Task 4 findings without changing migration, repository, or eligibility code:

- Version rows now expose a read-only `Xem nội dung` projection sourced directly from each returned `snapshot_payload`. The projection shows current rows, next rows, and difficulties while omitting task/version IDs and offering no edit controls. Reopened drafts label the latest saved completion as `Bản hoàn thành gần nhất`; older snapshots remain `Đã thay thế`.
- The reopen dialog now moves focus into the dialog, wraps Tab/Shift+Tab, closes on Escape when idle, restores focus to the trigger, and uses a scroll-safe `max-height`/`overflow-y-auto` layout.
- Reopen validation and exact `{ reportId, reason }` payload construction are executable tests through `personalWeeklyReportUi.mjs`; snapshot projection is also covered with literal fixtures. The component uses the same payload builder.
- Completion confirmation now explains that the report is retained in history and can be reopened within the allowed window.

Fix verification:

- `node --test src/lib/personalWeeklyReportUi.test.mjs` — 16 passed, 0 failed.
- `npx tsc --noEmit` — passed.
- `npx eslint src/components/PersonalWeeklyReportPage.tsx src/lib/personalWeeklyReportUi.mjs` — passed.
- `git diff --check` — passed.

The server eligibility dependency remains unchanged: employee self-reopen requires server-provided `eligible: true`; the UI does not infer eligibility from time or browser state.
