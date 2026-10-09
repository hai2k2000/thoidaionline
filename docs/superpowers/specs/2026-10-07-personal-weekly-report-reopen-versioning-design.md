# Personal Weekly Report Reopen + Version History Design

**Status:** Approved for implementation; production deployment is explicitly out of scope.

## Goal

Allow an employee to reopen their own completed weekly report within 24 hours, allow an authorized admin to reopen any completed report, and preserve every completed snapshot as an immutable version.

## Design

- Add one bounded migration creating `public.personal_weekly_report_versions`, its `(report_id, version_no)` uniqueness/indexes, immutable trigger, and server-only RPC changes.
- Extend completion so each successful completion locks the report, allocates the next version number in the database transaction, inserts an immutable version, and updates the main report's latest snapshot atomically.
- Add a server-only reopen operation that derives the actor from the authenticated session, validates ownership/admin authorization and server time, requires a trimmed 5–500 character reason, lazily seeds Version 1 for legacy completed rows, copies the latest snapshot into draft fields, changes the report to `DRAFT`, and records `personal_weekly_report.reopened` in `audit_logs`.
- Keep the existing completed-row guard fail-closed: only the authorized reopen pathway may perform `COMPLETED -> DRAFT`; ordinary update/delete remains rejected.
- Extend repository/service/API/UI contracts with reopen state, version history, read-only historical versions, and the existing latest-snapshot DOCX behavior. Version 1 and later versions remain separately inspectable; reopened drafts are never presented as authoritative completed exports.

## Security and compatibility

- Browser requests never provide an employee override; server derives actor identity.
- Employee access is self-only and time-bounded; admin authorization reuses the canonical existing helper.
- Existing completed reports without version rows remain readable/exportable from `snapshot_payload` and are lazily versioned only when reopened.
- No Task, Department Plan, Quick Report, Personal Plan, Attendance, or unrelated RBAC semantics change.
- No broad backfill, destructive history cascade, migration replay, `supabase db push`, `supabase db reset`, ledger repair, or production deployment.

## Verification contract

Migration rehearsal must cover first completion, reopen, second completion, legacy lazy seed, 24-hour boundaries, admin/cross-user authorization, reason validation, immutable versions, audit, and direct mutation rejection. Application gates cover the A–N matrix plus existing weekly/DOCX and broader regressions, TypeScript, changed-file lint, diff check, route check, production-like build, artifact verification, and the repository disk gate.
