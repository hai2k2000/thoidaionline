# J6 PRODUCTION ROLLOUT RESULT

```text
Status: PARTIAL — STOPPED before mutation smoke gates
Production rollout: STOPPED
Active release: /opt/releases/thoidai-work/4b88eca3019ffa222a7c1b3cdf697f9872c8f20b-j6-20260919T095500Z
Active commit: 4b88eca3019ffa222a7c1b3cdf697f9872c8f20b
Service: active/running; NRestarts=0
Rollback performed: NO
Production worktree touched: NO (/opt/thoidai-work was not modified)
Evidence timestamp: 2026-09-19 UTC
```

The additive J6D/J6E database changes, exact RBAC delta, immutable J6F release, and activation all passed. The rollout is not reported as full success because no safe controlled Journalism Task fixture exists for the required write smoke tests.

## BACKUP

```text
Backup path: /opt/releases/thoidai-work/ops-backups/j6-20260919T094433Z-rollout-retry
DB dump: database.dump (verified custom-format dump)
Schema export: schema.sql
Migration ledger: migration-ledger.tsv
RBAC snapshot: rbac-tuples.txt, rbac-counts.txt, rbac-canonical.txt
Release/systemd evidence: current-release-*.txt, service-state.txt, systemd-unit-and-dropins.txt
Migration checksums: migration-checksums.txt
Manifest: SHA256SUMS
Backup verification: PASS; files present, dump completed, manifest/checksums verified
```

An earlier backup attempt using an incompatible `pg_dump -X` invocation failed and was retained as evidence only; it was not used for rollout.

## GATE SUMMARY

| Gate | Result | Evidence |
| --- | --- | --- |
| 0 baseline | PASS | J5F baseline recorded before rollout |
| 1 fresh backup | PASS | Verified package above |
| 2–4 J6D | PASS | Exact source hash, apply, schema/RLS/ACL/RPC checks |
| 5–7 J6E/RBAC | PASS | Exact source hash, apply, schema/RLS/ACL/RPC/RBAC checks |
| 8 immutable build | PASS | TypeScript, lint, focused tests, build and non-secret validation |
| 9 activation | PASS | Final `zz-j6-release.conf`, service healthy |
| 10 health | PASS | HTTP and service checks below |
| 11 J6D mutation smoke | NOT RUN | No safe Journalism Task fixture |
| 12 J6E mutation smoke | NOT RUN | Depends on GATE 11 report |
| 13 J6F authenticated scope smoke | NOT RUN | No authorized fixture/account smoke sequence |
| 14 regression/monitoring | PARTIAL | Read-only monitoring completed; mutation-dependent checks not run |
| 15 evidence | PASS | This report |

## J6D MIGRATION

```text
Migration: 20260919110000_journalism_manual_publication_reporting.sql
Migration SHA: cb1f33f74694b1546227224031f4ab2df5449f211905e509e1348bc0906e9f57
Preflight: PASS; dependencies present and target objects absent
Apply: PASS; exact file only, per-file production procedure
Transaction: PASS; migration completed transactionally
Table: public.journalism_publication_reports exists; row count 0
RPC: public.api_upsert_journalism_publication_report_v1 exists; server-only ACL
RLS: enabled
ACL: public/anon/authenticated direct access false; service_role access true
Verification: PASS; PK/FK/unique/check constraints, indexes, updated_at trigger verified
```

## J6E MIGRATION

```text
Migration: 20260919120000_journalism_publication_verification.sql
Migration SHA: 7c2b23f84e7a760d7a836fe5269a4d341535fe0350c080fb89bbc1d310bebe7b
Preflight: PASS; J6D PASS, expected roles present, target objects absent
Apply: PASS; exact file only, per-file production procedure
Transaction: PASS; migration completed transactionally
Table: public.journalism_publication_verifications exists; row count 0
RPC: public.api_record_journalism_publication_verification_v1 exists; server-only ACL
RLS: enabled
ACL: public/anon/authenticated direct access false; service_role access true
Verification: PASS; decision/report/verifier constraints and append-only indexes verified
```

## RBAC

```text
Before permissions: 21
After permissions: 22
Before grants: 140
After grants: 145
Before hash: 99b3a0991ffd411825e188a5acbc1b67390c96763ff86b58c7197347f0148c3a
After hash: b882158102425caaa2de75628d074c025c2b73a7606a2979b352846a477705c9
Expected five verify grants match: YES
Unexpected verify grants: NONE
```

The five exact `journalism.publication.verify` grants are: `admin/all`, `tong_bien_tap/all`, `pho_tong_bien_tap/all`, `truong_phong/department`, and `pho_truong_phong/department`. No grant was added for `phong_vien` or `nhan_vien`.

## RELEASE

```text
Source commit: 4b88eca3019ffa222a7c1b3cdf697f9872c8f20b
Release path: /opt/releases/thoidai-work/4b88eca3019ffa222a7c1b3cdf697f9872c8f20b-j6-20260919T095500Z
Build ID: JJyUQjs1CmaAVsRWsTC9o
Build: PASS; focused J6D/J6E/J6F tests 22/22, TypeScript PASS, changed-file ESLint 0 errors, production build PASS
Artifact secret scan: PASS with non-secret validation values
Systemd activation: PASS; /etc/systemd/system/thoidai-work.service.d/zz-j6-release.conf
Service health: active/running; WorkingDirectory matches release; NRestarts=0
Rollback target preserved: /opt/releases/thoidai-work/078199d865a00ee216d429a1b1a3caad43da997d-j5f-20260919T013220Z
```

The initial J6 drop-in ordering was corrected by the final `zz-j6-release.conf`; the resulting service state is healthy with no restart loop.

## GATE 10 HEALTH CHECK

Through `https://thoidai.online`:

```text
/login: 200
/journalism/reports: 307 -> /login (expected unauthenticated protection)
/api/auth/session: 401 (expected without credentials)
```

The same checks passed against the local service on `127.0.0.1:3001`. Runtime logs after activation contained no new missing-relation, permission, RLS, RPC, module, or environment errors.

## J6D SMOKE

```text
Create: NOT RUN — no safe controlled Journalism Task fixture
Read: READ-ONLY route protection checked; authenticated task read not run
Update: NOT RUN
Server reporter: NOT RUN
Stale conflict: NOT RUN
Authorization: Route protection PASS; mutation authorization not exercised
J5 fields unchanged: NOT RUN
```

## J6E SMOKE

```text
Verifier permission: NOT RUN
Reporter permission: NOT RUN
Self-verification blocked: NOT RUN
Verify: NOT RUN
Edit -> stale: NOT RUN
Reverify: NOT RUN
History preserved: NOT RUN
Reject path: NOT RUN
```

## J6F SMOKE

```text
Dashboard: unauthenticated redirect PASS; authenticated dashboard not exercised
KPIs: NOT RUN with authenticated fixture
Filters: NOT RUN
Recent publications: NOT RUN
Attention list: NOT RUN
Zero-data behavior: DB tables verified at zero rows; authenticated UI rendering not exercised
Department scope: NOT RUN
Reporter scope: NOT RUN
Aggregate leakage: NOT RUN
```

Production data evidence at the stop point was:

```text
public.tasks: 253
public.journalism_task_details: 0
public.journalism_publication_reports: 0
public.journalism_publication_verifications: 0
public.journalism_work_kinds: 10
```

No fake newsroom data, invented publication URL, or unapproved fixture was created.

## REGRESSION

```text
Task: read-only health only; mutation smoke not run
Journalism: release/runtime route protection PASS; authenticated mutation smoke not run
Topics: not re-mutated during rollout
Series: not re-mutated during rollout
Auth: /login 200 and unauthenticated session 401 PASS
RBAC: exact post-J6 counts/hash/tuple set PASS
```

Known validation baseline remained unchanged: full suite evidence was `468 total, 436 pass, 32 baseline failures`, with no new failure attributed to J6.

## MONITORING

```text
HTTP 5xx: no new 5xx observed in targeted health checks
Auth errors: expected unauthenticated 401 only
RPC errors: none observed in post-activation service logs
RLS errors: none observed
Missing relations: none observed
Service restarts: NRestarts=0
Other: no runtime module/build/environment errors observed
```

## MASTER CMS SAFETY

```text
MasterCMS API called: NO
Reported URL fetched: NO
CMS credential used: NO
CMS schema assumed: NO
J6B started: NO
J6C started: NO
J6G started: NO
```

## FINAL PRODUCTION STATE

```text
J6D: ACTIVE (database objects/RPC present; no report rows)
J6E: ACTIVE (database objects/RPC/RBAC present; no verification rows)
J6F: ACTIVE (immutable release serving traffic)

Permissions: 22
Grants: 145
Canonical hash: b882158102425caaa2de75628d074c025c2b73a7606a2979b352846a477705c9

J6 overall: PARTIAL / STOPPED before required mutation and authorization smoke gates
```

## FILES / PRODUCTION OBJECTS CHANGED

```text
DB objects created: J6D/J6E additive tables, indexes, trigger/RPC objects
RBAC rows added: one permission and five exact grants
Release directory created: /opt/releases/thoidai-work/4b88eca3019ffa222a7c1b3cdf697f9872c8f20b-j6-20260919T095500Z
Systemd drop-in changed: zz-j6-release.conf (activation drop-in)
Service restart: required activation restart completed; currently healthy
Documentation/evidence: this report; no feature-code hot edit
```

## ISSUES / DEVIATIONS

1. Required mutation smoke gates could not be safely executed because production has no Journalism Task detail fixture (`journalism_task_details=0`). Creating fake newsroom data is expressly prohibited.
2. Therefore J6D, J6E, and authenticated J6F scope smoke remain NOT RUN; this is a hard partial-stop, not a pass.
3. The first activation drop-in ordering was incorrect; it was corrected with `zz-j6-release.conf`. Final activation is healthy and stable.
4. An earlier `pg_dump -X` backup attempt failed; the separate retry backup listed above passed and was used.

## NEXT RECOMMENDED CHECKPOINT

Obtain owner-approved controlled Journalism Task fixture/account strategy, then resume only GATE 11 onward. Do not start J6G, J6B, or J6C automatically. Do not perform destructive DB cleanup or rollback; application-only rollback to the preserved J5F release remains the safe emergency path.

## SAFETY INVARIANTS

```text
supabase db push: NOT RUN
supabase db reset: NOT RUN
/opt/thoidai-work modified: NO
Migration ledger manipulated: NO
MasterCMS contacted: NO
Production secrets included: NO
```
