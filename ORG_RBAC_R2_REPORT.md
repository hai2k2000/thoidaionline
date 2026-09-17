# ORG/RBAC Reconciliation R2 Report

**Scope:** narrow implementation only; Journalism J2 remains paused.
**Branch:** `org-rbac-r2-narrow-reconciliation-impl`
**Base:** `226f7749bc9b2260f148e8d65665a0871a092d5b`
**Production:** not modified.

## A. Files changed

- `src/app/api/users/route.ts`
- `src/app/users/page.tsx`
- `src/lib/userReconciliationValidation.mjs`
- `src/lib/orgRbacR2.test.mjs`
- `supabase/migrations/20260917200000_org_rbac_r2_tbt_label.sql`
- `ORG_RBAC_R2_REPORT.md`

The prior R1 audit reports were used as read-only references outside the commit; they are not part of this implementation branch.

## B. API department validation

- POST/create looks up the immutable department ID and requires `active = true`.
- PATCH validates only a changed department ID; nonexistent and inactive targets return HTTP 400 with explicit machine-readable codes.
- An unchanged historical inactive value is preserved and readable; it is not accepted as a new target.
- Validation never uses display names.

## C. Selector behavior

- New-user department and role selectors expose active values only.
- Edit selectors retain the currently assigned historical inactive value as a disabled option.
- Active values remain selectable.
- Historical department labels include their immutable code, avoiding name-based identity ambiguity.

## D. Historical inactive-value behavior

Inactive departments and roles remain visible when currently assigned, marked `INACTIVE / HISTORICAL`, and cannot be selected for a replacement. Existing department/role active states and assignments are not changed.

## E. `tong_bien_tap` label migration

`20260917200000_org_rbac_r2_tbt_label.sql` updates only `roles.name`, guarded by exact role code and old label. Role ID, code, active state, level, users, grants, permissions, tasks, and authorization are untouched. The file includes an explicit rollback statement restoring the exact old label.

## F. Migration checksum

SHA-256: `fdce8d4ce7e19b1f67d9183b09bd7515dfd7987932f7ed55c187e736418dd801`.

## G. RBAC exact baseline verification

- Permission catalog: **17**.
- Exact role/permission/scope tuples: **116 role_permission_grants**.
- Missing tuples: **0**.
- Extra tuples: **0**.
- Corrected live role lifecycle count: **7 active roles / 6 inactive compatibility roles**. Earlier 8/5 wording was a report-counting error and is not a target.
- No grants or permissions are changed by R2.

## H. Null-department task verification

The **8 null-department tasks** with `department_id IS NULL` remain untouched. No inference, backfill, or reconciliation write targets tasks. Their null relationship does not become an implicit department match.

## I. Test commands/counts

- `node --test src/lib/orgRbacR2.test.mjs` — 9/9 PASS.
- Focused Phase 1A/RBAC/task/leave/attendance/schedule/online-work/duty/evaluation/admin run — 91/93 PASS. The only 2 failures are pre-existing `evaluationUi.test.mjs` expectations for the unrelated legacy phrase `Mức độ khó`; no R2 file or UI behavior caused them.

## J. TypeScript/lint/build

- `npm ci` — PASS in the isolated implementation worktree.
- `npx tsc --noEmit` — PASS.
- Changed-file ESLint — 0 errors; one pre-existing React hook warning in `src/app/users/page.tsx`.
- `git diff --check` — PASS.
- Production-safe Webpack build with the required non-secret dummy values — PASS.

## K. Production migration state

**NOT APPLIED.** No `supabase db push` or `supabase db reset` was run.

## L. Production deployment state

**NOT DEPLOYED.** `/opt/thoidai-work` was not modified, restarted, or switched.

## M. Rollback design

The migration is additive and label-only with an explicit inverse SQL statement. Application rollback is a normal branch revert before any future controlled release. No data remapping, grant change, RPC change, or compatibility-record deletion is involved.

## N. GO/NO-GO for R3 controlled production application

**NO-GO in R2.** R3 may be reviewed only after owner review of this report, the final verification evidence, and an explicit separate approval to apply the label migration in a controlled production change window.
