# JOURNALISM TASKS J3C PRODUCTION REPORT

Date: 2026-09-18 (Asia/Bangkok)

Final status: **ACTIVATED / OWNER MUTATION SMOKE PENDING**

JOURNALISM J3 is not closed. J4/UI was not started.

## A. Authoritative source

- Branch: `journalism-tasks-j3b-mutations`
- Source commit: `de5063c5155e3f25b10fdfa11271fc298370f1cb`
- Remote and local source HEAD matched before release creation.
- Source worktree was clean.
- `/opt/thoidai-work` was not modified.
- Metadata DTO contains only `workKindId`, `plannedPublicationAt`, `location`, and `editorialNotes`.
- No `expectedUpdatedAt`, `expectedTimestamp`, `version`, or `etag` is exposed.

## B. Release paths and rollback

- Previous active J2 release: `/opt/releases/thoidai-work/fad1124cad189a8e10e7f3aa1a07631e8ac31f72-j2p-envretry-20260918T050842Z`
- New J3C release: `/opt/releases/thoidai-work/de5063c5155e3f25b10fdfa11271fc298370f1cb-j3c-20260918T080957Z`
- Rollback target: the previous J2 release through the reversible systemd drop-in.
- Production checkout `/opt/thoidai-work` remains untouched and available as the preserved legacy rollback source.
- Activation drop-in: `/etc/systemd/system/thoidai-work.service.d/70-j3c-release.conf`.

## C. Pre-J3C production baseline

- Previous service: active; `/login=200`; anonymous `/api/tasks=401`.
- `TASK_RBAC_V2_ENABLED=true` before and after activation.
- Organization: 4 active / 4 inactive departments; 7 active / 6 inactive roles.
- NULL-department tasks: 8.
- Journalism work kinds: 10.
- Journalism details before migration: 0.
- RBAC before migration: 17 permissions / 116 grants.
- Existing baseline grant hash: `292d1d5863fe0e3bff05d4a37ce2bd7915eb0656a011a053e67912bfb57af0a6`.

## D. Backup and checksum manifest

- Verified pre-J3C backup: `/opt/thoidai-j3c-backups/20260918T080006Z`.
- Included database custom/schema dumps, migration ledger snapshot, grant tuples, organization counts, J2 counts, NULL-department task snapshot/hash, service/release metadata, environment-name presence, and checksums.
- Backup checksum verification passed.
- Activation metadata backup: `/opt/releases/thoidai-work/ops-backups/j3c-activation-20260918T081510Z`.
- No secret values were printed or written to this report.

## E. Migration application

- Migration: `20260918120000_journalism_tasks_j3_mutations.sql`.
- SHA-256: `38a60fc0056a4c0479a5062c412fb5c3a065e15dac6aef30f957690a6efd4ad3`.
- Method: `docker exec -i supabase_db_thoidai-work psql -U postgres -d postgres -v ON_ERROR_STOP=1`.
- Applied exactly once in one transaction; result `COMMIT`.
- Start: `2026-09-18T08:02:00Z`; end: `2026-09-18T08:02:01Z`.
- No `supabase db push`, `supabase db reset`, legacy replay, or broad ledger repair was run.

## F. Migration ledger state

- `20260917200000` = `MANUALLY_APPLIED_OUTSIDE_LEDGER`.
- `20260918100000` = `MANUALLY_APPLIED_OUTSIDE_LEDGER`.
- `20260918120000` = `MANUALLY_APPLIED/PER-FILE_OUTSIDE_LEDGER`.
- The production ledger table did not contain these manually applied versions; no fake registration was added.

## G. RBAC counts and grant verification

- Permissions: `19`.
- Grants: `128`.
- J3 permissions: `2`.
- J3 grants: `12`.
- Missing approved J3 tuples: `0`.
- Extra J3 tuples: `0`.
- Approved reference sorted-grant hash: `0bc039d7110e1b420349589dfb9f822c766ec3886cfa2f04947e0acab4d4233f`.
- The live role/permission/scope tuple set was compared against the approved 128-row set with no missing or extra rows. The direct SQL comma-joined serializer observed after activation produced `302d89be211a2b36fde7edb81aee355b6b0659fe1280b954fc8025cd78ccba17`; this is a serialization representation difference, not a tuple-set difference, and is recorded for owner review rather than treated as a grant drift.

## H. Exact J3 grant tuples

```text
admin|journalism.metadata.update|all
tong_bien_tap|journalism.metadata.update|all
pho_tong_bien_tap|journalism.metadata.update|all
truong_phong|journalism.metadata.update|department
pho_truong_phong|journalism.metadata.update|department
phong_vien|journalism.metadata.update|assigned
nhan_vien|journalism.metadata.update|assigned
admin|journalism.publication.manage|all
tong_bien_tap|journalism.publication.manage|all
pho_tong_bien_tap|journalism.publication.manage|all
truong_phong|journalism.publication.manage|department
pho_truong_phong|journalism.publication.manage|department
```

No `journalism.create` permission or inactive-role J3 grant was added.

## I. RPC and table security

- Public/anon/authenticated execute on the four J3 RPCs: `0`.
- Service-role execute on the four J3 RPCs: `4`.
- Direct Journalism table ACL for public/anon/authenticated: `0`.
- SECURITY DEFINER fixed-search-path violations: `0`.
- J2 RLS was not weakened.

## J. Rollback-only database transactional probe

- Used existing active actor, department, assignee, reviewer, and active work-kind records.
- Exercised atomic parent Task creation, Journalism detail creation, parent/detail audits, metadata update, and scheduled publication inside one explicit transaction.
- Transaction result: `ROLLBACK`.
- Parent Task residue: `0`.
- Journalism detail residue: `0`.
- Journalism audit residue: `0`.
- No permanent synthetic Journalism data was created.

## K. Legacy/J2 data integrity

- Departments: 4 active / 4 inactive, unchanged.
- Roles: 7 active / 6 inactive, unchanged.
- NULL-department tasks: 8, unchanged.
- Journalism work kinds: 10, unchanged.
- Journalism details: 0 after rollback-only probe.
- Existing migration history was not repaired or replayed.

## L. Environment and release guard

- New release was cloned from the exact approved commit, not built from `/opt/thoidai-work`.
- `.env.local` and `.env.production` symlink to the protected production environment files.
- `/opt/ops/thoidai-work/verify-release-env.sh` returned `release-env-check: PASS`.
- Required variable names were verified present without printing values.
- `TASK_RBAC_V2_ENABLED=true` was delivered server-side through systemd.
- `.next/cache` was writable by `thoidai-work`.

## M. Production build and artifact scan

- `npm ci`: PASS; 372 packages installed, 0 vulnerabilities reported.
- `npm run build`: PASS; Next.js production artifact generated with `BUILD_ID` present.
- Build used protected production public configuration, not dummy values.
- `example.invalid`, dummy keys, and dummy session marker: not found in `.next`.
- Server-only secret names: not found in `.next/static`.

## N. Isolated application preflight

- Started the new release as `thoidai-work` on localhost port `3010`.
- `/login`: `200`.
- Anonymous `/api/tasks`: `401`.
- Anonymous `POST /api/tasks/journalism/assign`: `401` with same-origin request guard.
- Anonymous `PATCH /api/tasks/{id}/journalism`: `401`.
- Anonymous `POST /api/tasks/{id}/journalism/publication`: `401`.
- Fatal/configuration/secret-output scan: `0` findings.
- Isolated process stopped after preflight.

## O. Activation readiness and switch

- Activation backup created immediately before switch.
- Systemd switched atomically/reversibly to the new release at approximately `2026-09-18T08:15:34Z`.
- `TASK_RBAC_V2_ENABLED=true` preserved.
- Current service working directory resolves to the new J3C release.

## P. Readiness and stability window

- Initial readiness poll observed the expected short startup connection refusal, then the next bounded poll passed.
- Passing readiness: service active, `/login=200`, anonymous `/api/tasks=401`, and all three anonymous J3 mutation routes=`401`.
- Stability checks remained active with all expected status codes; `NRestarts=0`.
- `.next/cache` remained writable.
- Recent service journal fatal/error/panic/uncaught/exception count: `0`.

## Q. J2 read regression

- Exact isolated PostgREST J2 gate passed:
  - no filter `4`
  - Journalism only `3`
  - Journalism exclude (`journalism=is.null`) `1`
  - work-kind `1`
  - publication status `1`
  - planned-publication range `2`
  - scoped `2`
  - pagination/order/count/nested detail passed
- No `42703`, duplicate parent rows, or visibility widening observed in the gate.

## R. Anonymous J3 route security

- All three application mutation routes returned `401` without credentials.
- Direct J3 RPC/table privilege checks remained denied to public, anon, and authenticated roles.

## S. Authenticated role/module smoke

- No authenticated smoke was fabricated by automation.
- Existing owner-authenticated smoke evidence for the active J2/RBAC release remains the prior approved baseline.
- A fresh owner-controlled J3 mutation smoke is still required before closure.

## T. Controlled owner mutation smoke

- Status: `PENDING`.
- No permanent production Journalism Task was created automatically.
- No publication or withdrawal was performed against real newsroom content.
- Owner may perform one designated controlled create/metadata/publication smoke and report only PASS/FAIL plus non-sensitive symptoms.

## U. Audit verification

- Rollback-only probe verified create, metadata, and publication audit paths inside the transaction, then removed all rows by rollback.
- No production audit rows were manufactured because owner mutation smoke is pending.

## V. Security counters

- Anonymous route failures were expected `401`, not application errors.
- New unexpected HTTP 500: `0` during readiness/stability checks.
- Service restart count after activation: `0`.
- RBAC mismatch counters were not exposed by the current production instrumentation during this step.

## W. Module regression

- Focused J3/J2 tests: PASS.
- TypeScript (`npx tsc --noEmit`): PASS.
- Changed-file ESLint: PASS.
- Exact J2 PostgREST gate: PASS.
- Existing J3B critical/module regression evidence remains: authorization/workflow `79/79`, module suite `83/83`.
- No code, grant, schema, RPC, or UI changes were made during activation.

## X. Rollback readiness

- Previous J2 release remains intact.
- Activation metadata and drop-in backup are stored under `/opt/releases/thoidai-work/ops-backups/j3c-activation-20260918T081510Z`.
- Rollback is application-only by removing/overriding `70-j3c-release.conf`, reloading systemd, and restarting the prior J2 release.
- Database migration remains additive and is not automatically rolled back.

## Y. Final production release

- Active release: `/opt/releases/thoidai-work/de5063c5155e3f25b10fdfa11271fc298370f1cb-j3c-20260918T080957Z`.
- Active commit: `de5063c5155e3f25b10fdfa11271fc298370f1cb`.
- Service: active.
- Flag: `TASK_RBAC_V2_ENABLED=true`.

## Z. Production final status

**JOURNALISM J3C = ACTIVATED / OWNER MUTATION SMOKE PENDING**

The deployment and non-authenticated security gates are complete. Do not start J4/UI. Await owner-controlled authenticated Journalism mutation smoke and explicit owner review before closing J3.
