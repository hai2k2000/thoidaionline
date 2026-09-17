# ORG/RBAC Reconciliation R3 Final Report

**Result:** `ROLLED BACK / NO-GO`
**Date:** 2026-09-17 UTC
**Scope:** controlled production application of approved R2 only.
**Journalism J2:** `STILL PAUSED`

## A. Exact approved R2 commit

- Branch: `org-rbac-r2-narrow-reconciliation-impl`
- Commit: `13067f564cd7c1988e0f189a00d3cac4c5ed8b1d`
- Local SHA = remote SHA before deployment.
- Worktree was clean before deployment.
- Approved migration checksum: `fdce8d4ce7e19b1f67d9183b09bd7515dfd7987932f7ed55c187e736418dd801`.

## B. Release paths

- Previous active release: `/opt/releases/thoidai-work/phase1a-permission-ui-20260917T063502Z-226f774`
- Candidate R3 release: `/opt/releases/thoidai-work/13067f564cd7c1988e0f189a00d3cac4c5ed8b1d-r3-20260917T164145Z`
- Candidate was created from a clean archive of the exact approved commit.
- Production checkout `/opt/thoidai-work` was not modified.

## C. Backup/checksums

Backup set:
`/opt/releases/thoidai-work/ops-backups/org-rbac-r3-20260917T163850Z`

Included: database custom dump, schema-only dump, migration ledger, production status/diff/stat, current HEAD, active release metadata, service runtime/unit metadata, rollback drop-in metadata, and SHA-256 manifest. No secrets were printed or included in the report.

## D. Production-safe artifact verification

- `npm ci`: PASS.
- Real protected production public build configuration was used through protected environment references; values were not printed.
- `next build --webpack`: PASS.
- `example.invalid`: NOT FOUND.
- `dummy-anon-key`: NOT FOUND.
- `dummy-service-role-key`: NOT FOUND.
- `dummy-session-secret`: NOT FOUND.
- Server-only secret values in `.next/static`: NOT FOUND.
- Candidate `.next/cache` was writable by `thoidai-work`.

## E. Code deployment result

The candidate release was switched reversibly with `TASK_RBAC_V2_ENABLED=true`. The immediate probe was executed directly after restart and received connection refused before readiness; under the approved safety rule the candidate was rolled back without applying the migration. The service then recovered on the previous release.

Post-rollback evidence:

- Service: active.
- Active release: previous release path above.
- `/login`: HTTP 200.
- Anonymous `/api/tasks`: HTTP 401.
- `TASK_RBAC_V2_ENABLED`: `true`.
- Candidate drop-in: removed.

## F. Code-only smoke

Not completed because the immediate code deployment health gate failed and R3 required rollback before smoke/migration. No destructive user changes were attempted.

## G. Migration checksum

`20260917200000_org_rbac_r2_tbt_label.sql` SHA-256:
`fdce8d4ce7e19b1f67d9183b09bd7515dfd7987932f7ed55c187e736418dd801`

## H. Migration application result

**NOT APPLIED.** The migration ledger contains zero rows for version `20260917200000`. No `supabase db push`, reset, unresolved migration replay, or forced SQL update was run.

## I. `tong_bien_tap` before/after

- Before: `Tổng biên tập (chỉ xem công việc và nhân sự)`.
- After: unchanged, because migration was not applied.
- Code, role ID, active state, level, assignments and grants: unchanged.

## J. Department/user lifecycle verification

Post-rollback counts: 4 active departments, 4 inactive historical departments, 7 active roles, 6 inactive compatibility roles, 26 active staff, and 0 users requiring remap. No department or role state changed.

## K. Exact RBAC verification

- Permissions: 17.
- Grants: 116.
- Missing: 0.
- Extra: 0.
- Grant tuple hash before/after: `292d1d5863fe0e3bff05d4a37ce2bd7915eb0656a011a053e67912bfb57af0a6`.

## L. NULL-department tasks

All 8 historical tasks with `department_id IS NULL` remain unchanged. No backfill or inference occurred.

## M. Authenticated smoke

Not requested after rollback. Owner authenticated smoke must wait for a separately approved retry after the readiness/activation procedure is corrected.

## N. Module regression

Candidate predeploy verification: R2 focused tests 9/9 PASS; TypeScript PASS; changed-file ESLint 0 errors with one pre-existing warning; production-safe build PASS. The documented baseline regression run remained 91/93 PASS with exactly 2 pre-existing `evaluationUi.test.mjs` failures.

## O. Security / RBAC health

No new authorization mismatch was observed. No production migration or grant change occurred. Final live baseline remains exact: 17 permissions, 116 grants, 8 null-department tasks, and unchanged grant hash.

## P. Rollback readiness/result

Rollback was immediate and successful. Previous release path, service drop-in, database dump, schema dump, migration ledger, source metadata and checksums remain available in the backup set. No database rollback was necessary because the migration was never applied.

## Q. Final production state

- Active release: `/opt/releases/thoidai-work/phase1a-permission-ui-20260917T063502Z-226f774`
- Service: active.
- Flag: `TASK_RBAC_V2_ENABLED=true`.
- `/login`: 200.
- Anonymous protected API: 401.
- Production checkout remains preserved and dirty state was not overwritten.

## R. Final decision

`ORG/RBAC RECONCILIATION = ROLLED BACK / NO-GO`

The only observed blocker was the immediate post-restart readiness probe during candidate switch. Owner review is required before any retry. Do not apply the label migration or start Journalism J2 from this state.
