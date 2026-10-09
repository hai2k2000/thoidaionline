# Task 2 report

Implemented repository and service contracts for weekly report reopen and immutable version history.

- Added typed PersonalWeeklyReportVersion and reopen eligibility view types.
- Added bounded newest-first actor-scoped version reads, current version metadata, and server-side eligibility context.
- Historical loads continue using snapshotRows only and never hydrate live tasks/plans.
- Added reopen RPC repository wrapper with exact p_actor/p_report_id/p_reason mapping and no employee override.
- Added service reason trimming/5-500 validation, mutation actor request guard, and safe RPC error mapping.
- Added optional canonical admin context for report/version reads while employee access remains self-scoped by default.

Tests: node --test src/lib/personalWeeklyReportReopenService.test.mjs (3 passed); npx tsc unavailable because TypeScript compiler is not installed in workspace.

Concerns: TypeScript compiler command could not run via npx; no production or database changes were made.
