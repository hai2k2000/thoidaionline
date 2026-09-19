# J6 RELEASE PREPARATION RESULT

Checkpoint: READ-ONLY / PLAN-ONLY / VALIDATION-ONLY
Evidence date: 2026-09-19 (Asia/Bangkok)
Target: production VPS 103.216.118.49, project thoidai-work

No production database, RBAC, release, checkout, service, nginx, systemd, environment, or secret was changed. The dirty /opt/thoidai-work checkout was inspected only and was never reset, cleaned, stashed, or used as a build source.

## 1. Release scope

This package prepares a separately authorized rollout of:

- J6D Manual Publication Reporting v1, branch journalism-j6d-manual-publication-reporting, commit c8fbfef63d7037b699779d843a2cad15abebc4df.
- J6E Publication Verification & Audit, branch journalism-j6e-publication-verification-audit, commit 664fd6232ab22e8994a22bdabe65c9c6bccd3d3a.
- J6F Journalism Reporting Dashboard v1, branch journalism-j6f-reporting-dashboard, commit 4b88eca3019ffa222a7c1b3cdf697f9872c8f20b.

Preparation branch: journalism-j6-release-preparation, based directly on J6F 4b88eca3019ffa222a7c1b3cdf697f9872c8f20b. J6F has no migration and is read-only.

J6B MasterCMS Link Schema, J6C MasterCMS Read Connector, and J6G Manual Publication Reconciliation remain NO-GO/deferred.

## 2. Current production baseline

Read-only production evidence:

| Item | Observed value |
| --- | --- |
| Current release | /opt/releases/thoidai-work/078199d865a00ee216d429a1b1a3caad43da997d-j5f-20260919T013220Z |
| Current commit | 078199d865a00ee216d429a1b1a3caad43da997d (J5F) |
| Service | thoidai-work active; WorkingDirectory is the J5F release |
| Database container | supabase_db_thoidai-work |
| RBAC permissions | 21 |
| RBAC grants | 140 |
| Canonical RBAC hash | 99b3a0991ffd411825e188a5acbc1b67390c96763ff86b58c7197347f0148c3a |
| journalism_task_details | present, RLS enabled, PK task_id, FK to tasks(id) |
| audit_logs | present, actor_id FK to staff_users(id) |
| staff_users and RBAC tables | present |
| journalism_publication_reports | ABSENT |
| journalism_publication_verifications | ABSENT |
| journalism.publication.manage | present |
| journalism.publication.verify | ABSENT |
| J6D/J6E RPCs | absent |

The migration ledger is historical and does not represent every production change. J6D and J6E are not in the ledger, but actual catalogs were checked as the authority for these target objects. Do not infer object absence from ledger absence, and never use supabase db push or supabase db reset.

## 3. J6D dependency review

Migration: supabase/migrations/20260919110000_journalism_manual_publication_reporting.sql
SHA-256: cb1f33f74694b1546227224031f4ab2df5449f211905e509e1348bc0906e9f57
Size: 5,774 bytes

Objects created:

- public.journalism_publication_reports, UUID primary key and gen_random_uuid default.
- task_id FK to journalism_task_details(task_id) ON DELETE CASCADE.
- reported_by FK to staff_users(id) ON DELETE RESTRICT.
- Unique one-report-per-Task constraint.
- Bounded trimmed URL, title, and note checks.
- published_at, created_at, updated_at; published_at and reported_by indexes.
- updated_at trigger using existing public.touch_journalism_updated_at().
- RLS enabled; public, anon, authenticated revoked; service_role receives table CRUD.
- SECURITY DEFINER api_upsert_journalism_publication_report_v1, fixed search_path, postgres owner, service_role execute only.

Dependencies confirmed in production: journalism_task_details, staff_users, audit_logs, api_assert_journalism_access, and touch_journalism_updated_at. The RPC checks journalism.publication.manage, locks on update, rejects stale updated_at with 40001, derives actor through the server route, and writes audit data. It does not touch article_url, publication_status, Task title/status, Topics, or Series.

The file has explicit BEGIN/COMMIT and is transaction-safe with ON_ERROR_STOP=1. It is not rerun-idempotent: CREATE TABLE, indexes, and trigger have no IF NOT EXISTS. Preflight object absence and a single apply are mandatory.

Conflict risk: HIGH if any target object already exists.
Transaction-safe: YES.
J6D production migration: GO only after all future gates.

## 4. J6E dependency review

Migration: supabase/migrations/20260919120000_journalism_publication_verification.sql
SHA-256: 7c2b23f84e7a760d7a836fe5269a4d341535fe0350c080fb89bbc1d310bebe7b
Size: 5,457 bytes

Objects and RBAC:

- Inserts journalism.publication.verify with ON CONFLICT DO NOTHING.
- Adds exactly five grants: admin/all, tong_bien_tap/all, pho_tong_bien_tap/all, truong_phong/department, pho_truong_phong/department.
- Creates journalism_publication_verifications with report FK ON DELETE CASCADE and verifier FK ON DELETE RESTRICT.
- Checks decision in verified/rejected and requires a bounded note for rejection.
- Stores publication_report_updated_at and append-only history indexes.
- RLS enabled; public, anon, authenticated revoked; service_role select/insert only.
- SECURITY DEFINER api_record_journalism_publication_verification_v1, fixed search_path, postgres owner, service_role execute only.

J6E requires J6D first. It uses the live access assertion, audit_logs, staff_users, and RBAC tables, all confirmed present. The RPC rechecks Task scope and the dedicated permission, locks the report, blocks self-verification, derives verified_by from the server actor, and rejects stale report versions with 40001.

J6E has explicit BEGIN/COMMIT. Permission/grant inserts are conflict-safe; target table/index creation is not rerun-idempotent. No phong_vien or nhan_vien verify grant is expected.

Conflict risk: HIGH if target table/index exists.
Transaction-safe: YES.
J6E production migration: GO only after J6D verification and all future gates.

## 5. J6F runtime dependency

J6F adds /journalism/reports only. It reuses the existing Task scope helper, fails closed for unauthorized department filters, bounds the read to 5,000 authorized Tasks, and derives metrics from those rows. It reads both J6D reports and J6E verification history.

J6F adds no migration, permission, grant, view, RPC, index, CMS operation, mutation, ranking, or performance score. It must not activate until both tables, RPCs, and the J6E grant are verified.

## 6. Production schema observations

Confirmed read-only:

- journalism_task_details exists with PK task_id, tasks FK, publication checks, timestamp trigger, and RLS.
- touch_journalism_updated_at() exists with search_path pg_catalog, public; ACL limited to postgres/service_role.
- api_assert_journalism_access(uuid, uuid, text) exists as SECURITY DEFINER; ACL limited to postgres/service_role.
- audit_logs.actor_id references staff_users.id.
- staff_users has role and department foreign keys.
- roles, permissions, role_permission_grants, and active target roles exist.
- No J6D/J6E table, trigger, RPC, permission, or grant exists.

No probe object, temporary table, function, permission, grant, or ledger row was created.

## 7. Migration order

1. Confirm owner authorization, fresh backup, current J5F release, dirty-checkout preservation, source checksums, and actual object absence.
2. Apply J6D once, per-file, in its reviewed transaction.
3. Verify J6D objects, ACLs, RLS, RPC, and zero rows.
4. Apply J6E once, per-file, in its reviewed transaction.
5. Verify J6E objects, ACLs, RPC, zero rows, permission, and exactly five grant tuples.
6. Recompute RBAC counts/hash.
7. Build and activate the immutable J6 application release.
8. Run J6D/J6E/J6F, RBAC, regression, and zero-data smoke tests.
9. Monitor the existing service/application/database signals.

Migration-first is preferred because both migrations are additive and old J5 code ignores the new relations. The combined J6 app must not run against old DB or J6D-only DB.

## 8. Compatibility matrix

| Pairing | Result | Reason |
| --- | --- | --- |
| J5 code + old DB | SAFE | Current production pairing. |
| J5 code + J6D DB | SAFE | Additive table is ignored by J5. |
| J5 code + J6D/J6E DB | SAFE | Additive tables/permission are ignored by J5. |
| J6 code + old DB | BROKEN | J6 queries reference missing J6D/J6E relations. |
| J6 code + J6D DB only | BROKEN | J6E relation/RPC is missing. |
| J6 code + J6D/J6E DB | SAFE | Runtime relations, RPCs, and grants exist. |

## 9. RBAC delta

The authoritative algorithm is role_code|permission_code|scope, sorted by raw UTF-8 bytes, joined with LF and no final newline.

| | Before J6E | Expected after J6E |
| --- | ---: | ---: |
| Permissions | 21 | 22 |
| Grants | 140 | 145 |
| Canonical hash | 99b3a0991ffd411825e188a5acbc1b67390c96763ff86b58c7197347f0148c3a | b882158102425caaa2de75628d074c025c2b73a7606a2979b352846a477705c9 |

The after hash was computed read-only from the live tuple set plus the five exact reviewed J6E rows. It must be recomputed against actual rows after any future apply. Any count/hash/tuple mismatch is NO-GO.

## 10. Backup requirements

Before future apply, create and verify a fresh timestamped package containing:

- full custom-format database dump plus schema and ledger exports;
- current release path, commit/build identifier, systemd unit/drop-ins;
- RBAC tuple snapshot, counts, and canonical hash;
- both migration source checksums;
- pre-migration object and data invariants;
- SHA-256 manifest.

Existing established evidence is under /opt/releases/thoidai-work/ops-backups/j5f-20260919T003934Z, including database.dump, migration-checksums.txt, RBAC canonical snapshots, systemd-unit-and-dropins.txt, and manifests. No new backup was created here.

## 11. Release artifact plan

Build from clean J6F commit 4b88eca3019ffa222a7c1b3cdf697f9872c8f20b (or this docs-only preparation commit after owner review), never from /opt/thoidai-work. Use the observed immutable convention /opt/releases/thoidai-work/<commit>-j6-<timestamp>. Preserve J5F release 078199d865a00ee216d429a1b1a3caad43da997d-j5f-20260919T013220Z as application rollback target.

The future artifact must pass non-secret env validation, dependency install, TypeScript, changed-file lint, focused/regression tests, build, artifact secret scan, and isolated HTTP preflight.

## 12. Migration application plan (future; NOT EXECUTED)

Use the established explicit per-file psql process, never an automated runner:

1. Re-run ledger/object preflight and exact source SHA checks.
2. Copy exactly one reviewed SQL file into the DB container with docker cp.
3. Apply with docker exec -i supabase_db_thoidai-work psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/<exact-file>.
4. Verify J6D before copying/applying J6E.
5. Repeat for J6E.
6. Verify schema, ACLs, RLS, rows, grants, and hash.

Both files contain BEGIN/COMMIT. Do not add migration-ledger rows in this feature rollout. Do not rerun a failed file without proving transaction rollback and object state. Never run supabase db push/reset.

## 13. Deployment sequence

1. Obtain explicit owner authorization for production rollout.
2. Record production status without modifying the dirty checkout.
3. Verify fresh backup and all checksums.
4. Verify prerequisites and target absence.
5. Apply J6D per-file and verify.
6. Apply J6E per-file and verify.
7. Verify 22 permissions / 145 grants / expected hash.
8. Build and activate immutable J6 release with a numbered systemd drop-in.
9. Poll service/auth health and run smoke tests.
10. Observe stability window and preserve evidence.
11. If any gate fails, stop and use application rollback.

No step above was executed in this preparation checkpoint.

## 14. Smoke test plan

J6D: open an in-scope Journalism Task; create/read/update URL, title, published_at, note; verify server reporter and audit; verify stale update is HTTP 409; verify Task title/status, article_url, publication_status, Topics, and Series are unchanged; test unauthorized/out-of-scope access.

J6E: verify authorized Xác nhận/Từ chối controls; normal reporter cannot verify; report author cannot self-verify; verify/reject writes server identity and append-only history; rejection requires reason; report edit yields Cần xác minh lại; reverify current version; stale decision yields safe 409.

J6F: visit /journalism/reports; verify all KPI labels; test date/status/publication/verification/assignee/department/Topic/Series filters; test department-scoped manager and reporter visibility; test bounded recent/attention lists; test zero reports and zero verification rows.

RBAC/regression: verify five exact J6E tuples and no reporter grant; run J3/J4/J5 Journalism, Task visibility/assignment, Topic/Series, auth, and normal Task smoke. Confirm no CMS operation.

## 15. Zero-data and backfill

J6D and J6E start with zero rows. J6F must render correctly with zero reports and zero verification history. No mandatory historical backfill is required. Do not invent reports from existing article_url, publication status, or public URLs. J6D publication_url and existing article_url remain separate and are never synchronized by this rollout.

## 16. Monitoring

Use existing logs only. Monitor HTTP 5xx on J6D/J6F, unexpected 401/403, J6D/J6E 409 conflicts, verification RPC errors, RLS/missing-relation errors, dashboard rendering failures, latency, service active state, restart count, and cache writability. Do not add monitoring infrastructure here.

## 17. Rollback

Preferred rollback is application-only: switch the systemd release back to the preserved J5F release, verify /login/protected API/service state, and leave additive J6 tables/functions/permission in place. Destructive DROP TABLE/DROP FUNCTION/permission or grant deletion is not a first response and requires a separately approved maintenance checkpoint. Never reset, clean, or stash /opt/thoidai-work.

## 18. GO/NO-GO gates

GO only if backup, source checksums, object preflight, SQL review, J6D apply/verify, J6E apply/verify, exact 22/145 RBAC/hash, immutable artifact, rollback target, all smoke tests, zero-data behavior, and scope isolation are PASS.

NO-GO on any unknown, object collision, grant/hash mismatch, ACL/RLS mismatch, missing relation, failed backup, failed scope test, new regression, or MasterCMS boundary violation. GO here means ready for a separately authorized production checkpoint, not deployment authorization.

## 19. Known risks

- Outside-ledger history makes bulk Supabase runners unsafe.
- J6D/J6E table/index/trigger creation is not rerun-idempotent.
- J6 app is broken on old DB or J6D-only DB.
- J6F caps authorized reporting reads at 5,000 Tasks.
- Zero-data activation must be exercised.
- article_url and publication_url are separate.
- J6E is internal Work audit history, not proof of external URL/CMS existence.
- Application rollback intentionally leaves additive schema.

## 20. Explicit non-goals

No production apply/deploy/restart/ledger repair/grant reconciliation; no supabase db push/reset; no data backfill; no URL fetch or external mutation; no MasterCMS credentials/schema/connector/webhook/worker/polling; no J6G/J6B/J6C.

## 21. Final recommendation

J6D/J6E/J6F is technically ready for a separately authorized production rollout checkpoint. Apply additive J6D, then additive J6E/RBAC, verify, then activate immutable J6 and smoke/monitor. Do not execute from this document alone.

# REQUIRED FINAL REPORT

## J6 RELEASE PREPARATION RESULT

~~~
Status: READY FOR SEPARATELY AUTHORIZED PRODUCTION CHECKPOINT
Branch: journalism-j6-release-preparation
Commit: docs: prepare journalism j6 production rollout
Local HEAD: recorded after commit
Remote HEAD: recorded after push
Push: to git@github.com:hai2k2000/thoidaionline.git after owner-authorized checkpoint
Worktree: clean after commit
Production changed: NO
~~~

## PRODUCTION BASELINE VERIFIED

~~~
Current release: /opt/releases/thoidai-work/078199d865a00ee216d429a1b1a3caad43da997d-j5f-20260919T013220Z
Current RBAC permissions: 21
Current RBAC grants: 140
Canonical hash: 99b3a0991ffd411825e188a5acbc1b67390c96763ff86b58c7197347f0148c3a
J6D table present: NO
J6E table present: NO
J6E permission present: NO
~~~

## MIGRATION REVIEW

### J6D

~~~
Migration: 20260919110000_journalism_manual_publication_reporting.sql
Dependencies: journalism_task_details, staff_users, audit_logs, api_assert_journalism_access, touch_journalism_updated_at — present
Objects created: report table, 2 indexes, updated_at trigger, service-only RPC, RLS/ACL changes
Conflict risk: HIGH if target exists; preflight required; not rerun-idempotent
Transaction-safe: YES
GO/NO-GO: GO conditional on future gates
~~~

### J6E

~~~
Migration: 20260919120000_journalism_publication_verification.sql
Dependencies: J6D report table plus staff_users, audit_logs, api_assert_journalism_access — J6D first
Objects created: verification table, 2 indexes, append-only service-only RPC, RLS/ACL, 1 permission, 5 grants
RBAC delta: +1 permission, +5 grants
Conflict risk: HIGH if table/index exists; grant insert is conflict-safe but DDL is not
Transaction-safe: YES
GO/NO-GO: GO conditional on J6D verification and future gates
~~~

## EXPECTED POST-J6 RBAC

~~~
Permissions before: 21
Permissions after: 22
Grants before: 140
Grants after: 145
Canonical hash before: 99b3a0991ffd411825e188a5acbc1b67390c96763ff86b58c7197347f0148c3a
Canonical hash after: b882158102425caaa2de75628d074c025c2b73a7606a2979b352846a477705c9
~~~

## COMPATIBILITY MATRIX

~~~
J5 code + old DB: SAFE — current pairing.
J5 code + J6D DB: SAFE — additive table ignored.
J5 code + J6D/J6E DB: SAFE — additive objects ignored.
J6 code + old DB: BROKEN — missing J6 relations.
J6 code + J6D DB: BROKEN — missing J6E relation/RPC.
J6 code + J6D/J6E DB: SAFE — all runtime objects exist.
~~~

## PROPOSED PRODUCTION SEQUENCE

~~~
1. Confirm fresh verified backup and current J5F release.
2. Confirm actual object absence and migration checksums.
3. Apply J6D per-file in its transaction.
4. Verify J6D objects, ACLs, RLS, RPC, and zero rows.
5. Apply J6E per-file in its transaction.
6. Verify J6E objects/RPC/ACLs, permission, five grants, zero rows.
7. Validate 22/145 RBAC and expected hash.
8. Build/activate immutable J6 release after owner authorization.
9. Smoke-test J6D.
10. Smoke-test J6E.
11. Smoke-test J6F and scope isolation.
12. Monitor stability window and preserve evidence.
~~~

## BACKUP

~~~
DB backup method: existing verified custom-format pg_dump plus schema/ledger/RBAC/release/systemd metadata package under /opt/releases/thoidai-work/ops-backups; fresh package required before rollout
Release rollback target: current J5F release /opt/releases/thoidai-work/078199d865a00ee216d429a1b1a3caad43da997d-j5f-20260919T013220Z
RBAC snapshot: sorted role_code|permission_code|scope with counts and canonical SHA-256
Backup verified: existing method/evidence verified; fresh J6 pre-apply backup is a future gate and was not created here
~~~

## ROLLBACK

Application-only rollback to J5F; leave additive schema/RBAC in place; investigate with preserved backup. Destructive reversal requires a later approved maintenance checkpoint.

## SMOKE TEST PLAN

~~~
J6D: report create/read/update, server identity, stale 409, audit, unchanged Task/J5 fields, scope denial.
J6E: permitted/unauthorized/self verification, verify/reject, stale version, edit invalidation, append-only history.
J6F: dashboard KPIs, filters, scoped counts, bounded lists, zero-data rendering, read-only links.
RBAC: exact five verify tuples, no reporter grant, 22/145/hash after apply.
Regression: J3/J4/J5 Journalism, Task visibility/assignment, Topic/Series, auth, no CMS operation.
~~~

## GO / NO-GO

~~~
J6D production migration: GO — conditional on authorized preflight/backup
J6E production migration: GO — conditional on verified J6D and exact RBAC delta
J6F application rollout: GO — conditional on both migrations and smoke pass
Overall J6 release: GO — ready for a separately authorized production checkpoint
~~~

## CHECKS

~~~
git diff --check: PASS
TypeScript: PASS on J6F base validation; preparation changes are docs-only
ESLint: PASS on changed application files (0 errors; existing AppNav warnings only)
J6D tests: PASS, combined focused J6D/J6E/J6F 22/22
J6E tests: PASS, combined focused J6D/J6E/J6F 22/22
J6F tests: PASS, combined focused J6D/J6E/J6F 22/22
Journalism regression: PASS on J6F baseline validation
Full suite: 468 total, 436 pass, 32 known baseline failures; no new failures versus J6E baseline
Build: PASS on J6F base validation with non-secret placeholders; existing dynamic filesystem warnings only
~~~

Fresh preparation worktree has no node_modules; its doc-only focused node test run was 22/22 PASS. No production-linked DB reset or migration replay was used.

## FILES CHANGED

~~~
JOURNALISM_J6_RELEASE_PREPARATION.md
~~~

## MASTER CMS SAFETY

~~~
MasterCMS API called: NO
Reported URL fetched: NO
CMS credential used: NO
CMS schema assumed: NO
J6B started: NO
J6C started: NO
J6G started: NO
~~~

## NEXT ACTION

~~~
NEXT: J6 Production Rollout — requires explicit owner authorization
~~~

Production DB changes: NO
Production RBAC changes: NO
Production files changed: NO
Production service restart: NO
Production release changed: NO
