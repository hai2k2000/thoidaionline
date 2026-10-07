# Task 1 report: personal weekly report reopen/version history

## Scope
Implemented the bounded migration contract and disposable SQL rehearsal for immutable completed weekly report versions and authorized reopen.

## Files
- `supabase/migrations/20261007100000_personal_weekly_report_reopen_versions.sql`
- `supabase/tests/personal_weekly_report_reopen_versions.sql`
- `src/lib/personalWeeklyReportReopenMigration.test.mjs`
- `scripts/schema-contracts.mjs` was inspected; no new required table/RPC entries were added because its snapshot contract is intentionally limited to cross-cutting baseline objects.

## Migration behavior
- Adds `public.personal_weekly_report_versions` with UUID identity, report foreign key, employee/department/period metadata, immutable snapshot fields, completion actor/time, created time, `(report_id, version_no)` uniqueness, and descending report/version index.
- Revokes direct table access from browser roles and grants read access only to `service_role`.
- Adds fail-closed update/delete trigger for version rows.
- Extends completion RPC to lock the report, preserve idempotent completion, allocate the next version, and insert the snapshot in the same transaction.
- Adds server-only reopen RPC with trimmed 5–500 character reason validation, employee ownership and 24-hour window checks, canonical `admin` role authorization, lazy legacy Version 1 seed, draft snapshot copy, and reopen audit event.
- Keeps completed report direct update/delete rejected except for the scoped RPC transition marker.
- Revokes browser execute and grants `service_role`; both RPCs are owned by `postgres`.

## TDD evidence
1. Added `personalWeeklyReportReopenMigration.test.mjs` before the migration.
2. Ran it and observed expected ENOENT failures because the migration did not exist.
3. Added the migration, iterated on contract mismatches, and reran focused tests to green.

## Verification
- `node --test src/lib/personalWeeklyReportMigration.test.mjs src/lib/personalWeeklyReportReopenMigration.test.mjs scripts/schema-contracts.test.mjs`
- Result: 9 passed, 0 failed.
- `git diff --check` passed.
- Disposable PostgreSQL runner was not available in this Windows checkout (`psql`/Docker unavailable), so the SQL rehearsal could not be executed here. The rehearsal file is rollback-scoped and uses the repository runner contract when run in the disposable PostgreSQL environment.

## Concerns
- The SQL rehearsal's exact-time fixture adjustments require the disposable superuser runner; they are intentionally inside a transaction that rolls back.
- No production database, service, ledger, or `/opt/thoidai-work` target was touched.
