# Journalism J6E — Publication Verification & Audit

## Purpose and boundary

J6E adds an internal Work-owned verification workflow for the manual publication report introduced by J6D. A report records that a Work user reported an article as published; a verification records that an authorized, independent Work user reviewed that report. J6E does not change Journalism task state, `publication_status`, `article_url`, or the J6D report-edit workflow.

MasterCMS is completely disconnected. J6B remains **NO-GO** and J6C remains **NO-GO**. J6E does not call, fetch, scrape, infer, authenticate to, or verify any external publication URL or MasterCMS resource.

## Verification state model

The effective state is derived from the report's append-only history and the current report `updated_at`:

- `unverified`: there is no verification decision.
- `verified`: the newest decision whose `publication_report_updated_at` equals the current report `updated_at` is `verified`.
- `rejected`: the newest decision for the current report version is `rejected`.
- `stale`: history exists, but no decision matches the current report version. Editing the J6D report therefore requires a new review without deleting the old decision.

When several decisions exist for one version, server/database creation order (`created_at`, then stable id ordering in the DTO) makes the newest decision effective. No state is stored as a mutable flag on the report.

## History and database

Migration `supabase/migrations/20260919120000_journalism_publication_verification.sql` adds `public.journalism_publication_verifications`. Each row stores the report id, `verified`/`rejected` decision, optional note (required for rejection), server-derived verifier, the reviewed report-version timestamp, and server-created timestamp. The table has decision/note checks, indexes, RLS enabled, and no browser grants. Only the service role can select/insert through the server RPC; there is no update/delete UI or RPC.

The migration is additive and does not rewrite J6D columns or existing migrations. The history foreign key follows the existing report lifecycle. Production has not received this migration.

## Authorization and concurrency

J6E uses the dedicated permission `journalism.publication.verify`, rather than overloading `journalism.publication.manage`. The route first requires an authenticated session and Task view access, then checks the scoped permission. The server RPC calls `api_assert_journalism_access` again, locks the current report row, and derives `verified_by` from the authenticated actor. A reporter cannot verify their own report, even if the client hides the button or the actor has the permission.

The client submits only `decision`, `note`, and `expectedReportUpdatedAt`. The RPC compares the expected timestamp to the locked current report. A mismatch raises `40001`, mapped to HTTP 409; the UI refreshes once and does not retry against stale data.

## API and audit behavior

`POST /api/tasks/[id]/journalism/publication-verification` accepts an allowlisted payload. Decisions are `verified` or `rejected`; rejection requires a bounded Unicode note of at most 5,000 characters. No actor/reviewer/verifier id is accepted from the browser.

Every successful decision creates one immutable domain-history row and a generic `audit_logs` event (`journalism_publication_verified` or `journalism_publication_rejected`). Audit data records the report version and note length, not the full note text.

## UI

The Task detail “Xuất bản” card keeps all J6D create/update behavior and adds the derived verification label: “Chưa xác minh”, “Đã xác minh”, “Bị từ chối”, or “Cần xác minh lại”. Current verifier, time, note/rejection reason, and a newest-first expandable history are shown without raw UUIDs. “Xác nhận” and “Từ chối” actions render only for an authorized non-reporter when a report exists. Rejection requires a reason. Historical rows are retained and identified as historical/current report versions.

## RBAC impact

The migration contains a prepared, unapplied grant plan for the new permission:

- `admin`, `tong_bien_tap`, `pho_tong_bien_tap`: `all` scope;
- `truong_phong`, `pho_truong_phong`: `department` scope;
- no reporter/phóng viên grant.

This is code/migration preparation only. Canonical production RBAC has not been changed.

## Checks and limitations

Focused J6E tests cover validation, permission/self-verification guards, server-derived identity, stale-version semantics, append-only history, UI labels/actions/history, and the MasterCMS boundary. J6D and Journalism regression suites remain required before commit. The workflow records internal human decisions; it intentionally does not establish that an external URL is reachable or that an article exists in MasterCMS.

## Next checkpoint

If J6E validation passes, the recommended next checkpoint is **J6F — Journalism Reporting Dashboard v1**. Do not begin it automatically.
