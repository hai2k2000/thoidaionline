# ORG/RBAC Reconciliation R3 Retry Report

**Final state:** `ORG/RBAC RECONCILIATION = DONE`
**Owner smoke:** `PASS`
**Journalism J2:** `READY FOR OWNER APPROVAL` (not started)

## Exact candidate

- Approved R2 source commit: `13067f564cd7c1988e0f189a00d3cac4c5ed8b1d`.
- Candidate release: `/opt/releases/thoidai-work/13067f564cd7c1988e0f189a00d3cac4c5ed8b1d-r3-retry-20260917T170751Z`.
- Production checkout `/opt/thoidai-work` was not modified.
- Migration checksum: `fdce8d4ce7e19b1f67d9183b09bd7515dfd7987932f7ed55c187e736418dd801`.

## Readiness polling

- Poll interval: 2 seconds.
- Maximum window: 60 seconds / 30 attempts.
- Attempt 1: service active, transient connection refused while starting.
- Attempt 2: `/login=200` at approximately 3 seconds.
- Protected API: `401`.
- Stability window: 10/10 checks over 20 seconds, service active, `/login=200`, protected API `401`.
- `.next/cache`: writable by `thoidai-work`.
- Fatal journal errors, EACCES, and HTTP 500: not found.

## Code-only smoke

- Public route health: `/users=200`, `/departments=200`; protected pages redirect as expected; no 500/502/503.
- R2 focused tests: 9/9 PASS.
- TypeScript: PASS.
- Changed-file ESLint: 0 errors; one known hook warning.
- Regression characterization: 91/93 PASS with exactly the two documented pre-existing `evaluationUi.test.mjs` baseline failures.
- Production artifact scan: dummy markers and server-only secret values in `.next/static` were NOT FOUND.
- Selector/API behavior is covered by the focused R2 suite; no destructive user edits were performed.

## Migration result

- `20260917200000_org_rbac_r2_tbt_label.sql` applied explicitly as a single guarded per-file SQL transaction.
- `supabase db push` and `supabase db reset` were not used.
- Guard matched exactly one row with the expected old label.
- Explicit per-file SQL does not create a Supabase migration-ledger row; ledger version `20260917200000` remains absent by design.

## Label verification

- Before: `Tổng biên tập (chỉ xem công việc và nhân sự)`.
- After: `Tổng biên tập`.
- Role code, role ID, active state, level and assigned user count (1) unchanged.

## RBAC/org verification

- Permissions: 17.
- Role permission grants: 116.
- Missing: 0.
- Extra: 0.
- Grant tuple hash before/after: `292d1d5863fe0e3bff05d4a37ce2bd7915eb0656a011a053e67912bfb57af0a6`.
- Departments: 4 active / 4 inactive; no state changes.
- Roles: 7 active / 6 inactive compatibility; no state changes.
- Active staff: 26; no remap.
- Null-department tasks: 8; pre/post task snapshot hash unchanged.

## Owner authenticated smoke

Owner authenticated production smoke: **PASS**. No credentials, cookies, sessions, or tokens were provided to automation.

- Admin: PASS.
- `tong_bien_tap`: PASS; display label is `Tổng biên tập` and task behavior is unchanged.
- `pho_tong_bien_tap`: PASS.
- `truong_phong` / `pho_truong_phong`: PASS; own-department behavior unchanged.
- `phong_vien`: PASS.
- `nhan_vien`: PASS; `phong_vien` and `nhan_vien` remain distinct.
- Active role/department selectors: PASS.
- Inactive historical values are not selectable for new assignments: PASS.
- Permission UI remains read-only: PASS.
- Task authorization and cross-department visibility: PASS, no regression observed.
- Attendance, leave, schedule, online work, duty roster and evaluation: PASS.
- Unexpected HTTP 500 or authorization regression: none observed.

## Security health

- `TASK_RBAC_V2_ENABLED=true`.
- `SECURITY_CRITICAL_MISMATCH=0` and `RESTRICTIVE_MISMATCH=0` in the verified characterization/critical suite.
- No new cross-department visibility, authorization regression, service warning/error, or HTTP 500 observed.

## Rollback readiness

- Backup set: `/opt/releases/thoidai-work/ops-backups/org-rbac-r3-retry-20260917T170731Z`.
- Code rollback target: `/opt/releases/thoidai-work/phase1a-permission-ui-20260917T063502Z-226f774`.
- Label inverse SQL is the exact statement restoring the old label, guarded by code and current new label.
- Do not restore the whole DB unless corruption occurs.

## Current production

- Active release: `/opt/releases/thoidai-work/13067f564cd7c1988e0f189a00d3cac4c5ed8b1d-r3-retry-20260917T170751Z`.
- Service: active.
- `/login=200`; anonymous protected API `401`.
- Migration applied and owner authenticated smoke passed.

## Final decision

- `ORG/RBAC RECONCILIATION = DONE`
- `JOURNALISM J2 = READY FOR OWNER APPROVAL`
- Journalism J2 was not started automatically.
