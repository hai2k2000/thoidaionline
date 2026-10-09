# Eligibility fix report

Status: complete

Changes:

- Added `api_personal_weekly_reopen_eligibility(p_actor, p_report_id)` to the existing bounded migration.
- Kept the RPC `SECURITY DEFINER`, owned by `postgres`, revoked from `public`, `anon`, and `authenticated`, and executable only by `service_role`.
- The RPC derives admin state with `public.phase7_is_admin(p_actor)`, checks report ownership, and evaluates the employee window with database `now()`.
- Repository loads now call the RPC with only the authenticated actor and report id. The local clock and local role/ownership eligibility helper are no longer used for load state.
- Added normalization that fails closed for malformed or unknown RPC responses.
- Added migration and repository/service regression tests, including no client supplied role or clock.

Verification:

- `node --test src/lib/personalWeeklyReportReopenMigration.test.mjs`: 5 passed.
- `node --test src/lib/personalWeeklyReportReopenService.test.mjs src/lib/personalWeeklyReportService.test.mjs`: 16 passed.
- `npx tsc --noEmit`: passed.
- `git diff --check`: passed.

Concerns:

- PostgreSQL disposable rehearsal was not run in this wave because no disposable database runner/connection was available in the worktree. Production was not contacted or changed.
