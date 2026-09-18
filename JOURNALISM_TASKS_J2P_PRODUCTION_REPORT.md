# Journalism Tasks J2P Production Report

## Final Status

**J2P = ACTIVATED / OWNER AUTHENTICATED SMOKE PENDING**

The approved fixed source was rebuilt with the protected environment symlink fix and activated successfully. Readiness, stability, zero-data Journalism reads, and direct anonymous table denial pass. Authenticated owner role smoke has not been attempted automatically and remains the final owner-controlled gate.

## Approved Source

- Branch: `journalism-tasks-j2-schema-read-v2`
- Superseded commit: `3957d0b005ba3ae8eed4907bf131b434200727b7`
- Approved fixed commit: `fad1124cad189a8e10e7f3aa1a07631e8ac31f72`
- Report/ops follow-up commit: `0a87d5de6f60ee99e4afd48b4c1c96dced5d9dca`
- Local SHA = remote SHA
- Worktree: clean
- Authoritative migration SHA-256: `9f707262958fee0f160f5beafb42dbdca302c59b65f7bc9120607d0763f05c45`
- Superseded historical checksum: `ab08481b...` (documented in `JOURNALISM_J2P_CHECKSUM_RECONCILIATION.md`)

## PostgREST Integration Gate

Disposable PostgreSQL 17 + PostgREST v14.7 stack was rerun from the approved fixed commit. No production database or production data was used.

Passing cases:

- no Journalism filter: 4 parent tasks
- `journalism=only`: 3 parent tasks
- work-kind filter: 1 parent task
- publication-status filter: 1 parent task
- planned-publication range: 2 parent tasks
- authorized parent scope: 2 parent tasks
- count semantics: exact count 4
- pagination: HTTP 206, 2 rows
- deterministic ordering: PASS
- no duplicate parent rows: PASS
- nested Journalism normalization: object for one-to-one detail

`journalism=exclude` specifically returned HTTP 200 with the expected normal parent row, no Journalism parent row, and no `42703`. The corrected alias predicate was `journalism=is.null`.

The fixed source integration gate therefore passed all required filter, scope, count, pagination, ordering, duplicate, and nested-normalization cases. The later production activation failure was environmental: the release process did not provide the server Supabase configuration to the new clean release.

## Previous Failed Candidate (Superseded)

- Backup: `/opt/backups/thoidai-work/j2p-20260918T044111Z`
- Activation snapshot: `/opt/backups/thoidai-work/j2p-activation-20260918T045010Z`
- Applied migration: `20260918100000_journalism_tasks_j2_schema.sql` only
- Migration SHA-256: `9f707262958fee0f160f5beafb42dbdca302c59b65f7bc9120607d0763f05c45` (unchanged)
- Clean release: `/opt/releases/thoidai-work/fad1124cad189a8e10e7f3aa1a07631e8ac31f72-j2p-20260918T044334Z`
- Build artifact: `BUILD_ID=P3dr5Qt9NcB14HY2gkbR4`; marker/secret scans passed
- `.next/cache`: writable after ownership correction for `thoidai-work`
- Readiness result: **FAIL** (`/login=200`, protected `/api/tasks=500`)
- Failure evidence: service journal reported `Server Supabase configuration is incomplete` while loading protected routes
- Rollback: completed to `/opt/releases/thoidai-work/13067f564cd7c1988e0f189a00d3cac4c5ed8b1d-r3-retry-20260917T170751Z`
- Post-rollback health: service active, `/login=200`, protected `/api/tasks=401`
- That candidate was rolled back before this approved env-retry activation.

## Environment-Retry Activation

- Release: `/opt/releases/thoidai-work/fad1124cad189a8e10e7f3aa1a07631e8ac31f72-j2p-envretry-20260918T050842Z`
- Env delivery: `.env.local` and `.env.production` symlinks to `/opt/thoidai-work/` protected files
- Required env names: PRESENT (values not printed)
- Migration SHA: unchanged `9f707262958fee0f160f5beafb42dbdca302c59b65f7bc9120607d0763f05c45`
- Build: PASS; `BUILD_ID=ay2NDm6c4v51hSiNJyAsc`
- Artifact markers and server-only values in `.next/static`: NOT FOUND
- Isolated preflight: PASS (`/login=200`, protected `/api/tasks=401`)
- Production readiness: PASS on attempt 2 after transient startup refusal
- Stability window: PASS (service active, `/login=200`, protected `/api/tasks=401`, cache writable)
- Current production release: the env-retry release above
- Current service: active, `TASK_RBAC_V2_ENABLED=true`

## Zero-Data Journalism Production Smoke

- Normal list/detail DTO: PASS; existing tasks have `journalism=null`
- `journalism=only`: PASS, zero rows
- `journalism=exclude`: PASS, HTTP 206, normal authorized tasks only, no `42703`
- Work-kind filter: PASS, zero rows
- Publication-status filter: PASS, zero rows
- Planned-publication filter: PASS, zero rows
- Anonymous direct access to both Journalism tables: denied, HTTP 401
- No Journalism rows were created

## Authenticated Owner Smoke

Pending owner browser verification for Admin, Tổng biên tập, Phó tổng biên tập, Trưởng phòng, Phó trưởng phòng, Phóng viên, Nhân viên, and attendance/leave/schedule/online-work/duty/evaluation modules. No credentials, tokens, cookies, or synthetic sessions were used.

## Environment Regression Guard

Installed as an ops-only artifact (not application source): `/opt/ops/thoidai-work/verify-release-env.sh`. It checks symlink targets, protected-file ownership/mode/readability, and required variable names without printing values. A future deployment-hardening commit may formalize this guard.

## Production Safety State

- `/opt/thoidai-work`: untouched
- frozen forensic worktree: untouched
- production schema: additive J2 tables present; no existing task backfill
- migration `20260918100000`: applied once by explicit per-file `psql`; not registered in the migration ledger
- production backup: verified before migration
- service: restarted for failed-candidate rollback, then restarted for approved env-retry activation
- release: current release is the approved env-retry release below
- `TASK_RBAC_V2_ENABLED`: true
- J3: not started

## Required Disposition

The release is active and healthy through automated gates. Await owner authenticated smoke and explicit completion review; do not start J3 or change permissions/grants.

**JOURNALISM J2P = ACTIVATED / OWNER SMOKE PENDING**

Owner action required: complete authenticated smoke and report PASS/FAIL. Do not start J3.
