# RBAC V2 Production Readiness Report

Date: 2026-10-13
Repository: `hai2k2000/thoidaionline`
Canonical branch: `integration/production`
Canonical SHA: `adac1984fd1d2859d7622a44426a8743c8c835e0`

## Executive Decision

**NO-GO for production rollout at this checkpoint.** The code and rollback gates are ready for owner review, but production migration, deployment approval, authenticated smoke credentials, and post-merge CI evidence are still required. No production mutation was performed.

## Production Read-only Baseline

Audit target: `vps-aylaspa`, current release `/opt/releases/thoidai-work/current`.

- Service is active/running, `NRestarts=0`, and `ExecMainStatus=0`.
- `/opt/thoidai-work/current` resolves to the expected release tree; `127.0.0.1:3001` is listening and `/login` returned HTTP 200.
- Free disk: `25,998,225,408` bytes (about 24.2 GiB), above the 20 GiB floor.
- PostgreSQL: 17.6; migration ledger: 108 rows; latest recorded version: `20261014100000`.
- Active roles: 7; permissions: 20; role grants: 125; direct user grants: 5.
- Users with role/direct overlap: 0; scope mismatches: 0.
- Effective `permission.manage` managers: 1 through role, 0 through direct grants.
- Existing direct grants are `asset.manage:all` and four `task.quick_report.create:all` rows.
- Production does not yet contain `user_permission_grants.effect`, `api_list_effective_permissions`, or `rbac_v2_assert_legacy_rollback_compatible`.

The audit was read-only. No grants, roles, database objects, symlinks, service state, or releases were changed.

## Migration Compatibility

- The RBAC V2 migration is additive and idempotent; it does not seed new permissions or grants.
- Disposable/local full-chain rehearsal passed, including applying the RBAC V2 migration twice, resolver behavior, mutation RPCs, scope validation, explicit deny, narrow direct allow, inactive role, and last-manager protection.
- Pre/post rehearsal evidence: 20 permissions, 29 role grants, and 0 user grants on both sides. No role-plus-direct-allow overlap existed in that rehearsal, so there was no unexpected effective-scope delta to reconcile.
- Production grants were not altered and production migration was not run.

## Rollback Compatibility Integration

PR #12: https://github.com/hai2k2000/thoidaionline/pull/12

- The feature branch is synchronized with canonical RBAC V2 (`adac1984...`) without force-push.
- Deployment and manual rollback invoke `check-rbac-rollback-compatibility.sh` before selecting an older application target.
- A target marked `rbac_v2=supported` is accepted without legacy-union evaluation. Legacy or missing metadata requires the database compatibility function.
- The gate fails closed when explicit effects exist but the compatibility function is absent, when the database URL is unavailable, or when the SQL function rejects a rollback.
- The SQL compatibility function rejects explicit denies and role-grant plus narrower direct-allow combinations that would widen access under a legacy union resolver.
- Application rollback and database rollback remain separate. The rollback path never removes the `effect` column or deny rows to force compatibility.
- CI now includes a dedicated rollback-gate fixture covering supported targets, rejected SQL checks, and missing database credentials.

## Validation Evidence

Passed locally:

- RBAC/UI/security focused tests: 52/52.
- Deployment, rollback, and standalone packaging tests: 14/14.
- Migration runner tests: 24/24.
- TypeScript: PASS (`npm exec tsc -- --noEmit`).
- Changed-file ESLint: PASS (0 errors, 0 warnings).
- `git diff --check`: PASS.
- Existing PR CI build/package checks before this update: PASS (runs `38345282242` and `38345286582`).

Linux-only deployment and rollback fixture scripts were not executable under Windows POSIX emulation and are configured to run in GitHub CI. No Windows packaging failure is treated as an RBAC failure. A fresh post-push Linux artifact run remains required before rollout approval.

## Rollout Plan (not executed)

1. Obtain owner approval and a fresh canonical-public artifact with verified provenance, manifest, checksum, and secret scan.
2. Re-run read-only production preflight and capture service, pointer, disk, migration-ledger, and rollback-target evidence.
3. Confirm the target database migration dependencies and run the compatibility gate before any activation.
4. Apply the RBAC V2 migration only under a separately approved production-migration checkpoint.
5. Activate the immutable artifact with the deployment lock and authenticated contract/browser smoke.
6. Verify effective permissions, explicit deny, scopes, audit rows, Asset, Quick Report, and affected APIs.
7. If any gate fails, stop or use only a deny-aware rollback target whose compatibility gate passes; never remove deny state to make rollback succeed.

## Remaining Blockers

- Owner merge approval for PR #12 and fresh post-push CI/artifact evidence.
- Explicit approval for production migration and activation.
- Authenticated smoke credentials and a verified deny-aware rollback target.
- Production post-migration effective-permission and audit-log verification.

## Production Safety

Production migration: **NO**
Production deploy/restart: **NO**
Production grants/data changed: **NO**
Retention cleanup APPLY: **NO**

Checkpoint: **RBAC V2 PRODUCTION READINESS — NO-GO**
