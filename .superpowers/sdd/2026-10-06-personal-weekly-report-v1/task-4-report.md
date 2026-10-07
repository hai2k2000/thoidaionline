# Task 4 Report — weekly report APIs and shared Word export

Status: COMPLETE

Implemented:
- Added authenticated `GET /api/reports/weekly` service view-model route.
- Added self-scoped draft `POST /api/reports/weekly` validation and persistence.
- Added idempotent authenticated `POST /api/reports/weekly/complete` completion route.
- Added completed-snapshot-only `GET /api/reports/weekly/docx` export route.
- Added shared DOCX generation with exact Vietnamese headings, metadata, current rows, next-week rows, proposals, difficulties, safe filenames, and row-count parity with the service view model.
- Client employee/user identifiers are ignored; actor identity comes only from the server guard.

Validation:
- `node --test src/lib/personalWeeklyReportApi.test.mjs`: 4/4 PASS.
- `node --test src/lib/personalWeeklyReport.test.mjs src/lib/personalWeeklyReportService.test.mjs`: 20/20 PASS.
- Changed-file ESLint: PASS.
- `git diff --check`: PASS.
- `npx tsc --noEmit`: blocked by the pre-existing Task 2 `.ts` extension import in `src/lib/personalWeeklyReport.ts` (TS5097); no new diagnostic was emitted for Task 4 files.

Safety:
- No migration, schema, deployment, push, or production mutation performed.
- No unrelated files were changed.

Commit:
- `feat: expose weekly report and Word export APIs`
