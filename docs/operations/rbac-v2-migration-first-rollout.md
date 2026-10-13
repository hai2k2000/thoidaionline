# RBAC V2 Migration-First Rollout

Status: owner review only. This runbook does not authorize production mutation.

## Compatibility matrix

| Application | Database | Result | Decision |
| --- | --- | --- | --- |
| Old | Old | Current production baseline is healthy. | GO for baseline only |
| New RBAC V2 | Old | Missing `user_permission_grants.effect` and RBAC V2 RPCs. | NO-GO |
| New RBAC V2 | New | Exact migration and SQL regression passed; application E2E smoke remains required. | Conditional GO |
| Old | New | Legacy RPCs remain and legacy ACLs were preserved; old-app runtime smoke is still required. | Conditional GO |

## Rehearsal evidence

- Backup restore fixture: `/opt/thoidai-work/ops-backups/asset-ui-permission-deploy/20261011T130022Z/production-db.dump` (1,221,456 bytes), restored with PostgreSQL 17 tooling.
- Exact migration: `supabase/migrations/20261015100000_rbac_v2_role_user_overrides.sql`.
- Migration SHA-256: `DA1C7A84B919CE690F5396AAD98B35BB7F82566F435EAAF8470C45A5B07FC463`.
- Exact-file runner: first apply PASS; second invocation `ALREADY_APPLIED`; target ledger row count exactly one.
- Isolated SQL regression: `RBAC_SQL_TEST=PASS`; `effect`, new RPCs, legacy RPCs/ACLs, and grant counts verified. Production was not written.

## Rollback scenarios

### A. Migration succeeds; new application is not activated

Keep the old release running. Validate old-app login, session, Asset and Quick Report paths against the migrated fixture before any activation approval. Do not undo the migration merely because activation is delayed.

### B. Migration succeeds; new application activation or smoke fails

Use the tested application rollback gate only if `rbac_v2_assert_legacy_rollback_compatible()` passes. Restore the prior application pointers and health-check. If compatibility fails, hold RBAC mutations and use a forward-fix path; do not roll back to an application that could widen access.

### C. New application is live and overrides/denies exist

Freeze permission mutations, preserve immutable evidence, and choose a forward fix. Automatic application rollback is prohibited while deny rows or widening direct allows could change legacy-union semantics. PITR/database restore is not an automatic rollback because it can lose post-backup data.

## Production rollout gates

1. **GO:** owner-approved maintenance window, fresh backup/PITR verification, exact migration SHA, disk floor >=20 GiB, and deploy lock acquired.
2. **NO-GO:** ledger/schema/RPC preflight mismatch, backup or restore evidence failure, insufficient disk headroom, or missing authenticated smoke session.
3. Apply only the exact migration file through the safe exact-file runner; never replay pending migrations.
4. Post-migration, verify ledger, schema, RPC ownership/EXECUTE ACLs, audit behavior, and unchanged grant counts before application activation.
5. Obtain separate owner approval for canonical artifact activation. Verify provenance/checksum, service health, authenticated RBAC/Asset/Quick Report smoke, and rollback pointers.
6. Retention remains dry-run; no unattended cleanup or APPLY.

## Evidence and stop conditions

Record backup/checksum, migration checksum, ledger result, artifact source SHA, artifact digest, service health, pointer snapshot, disk before/after, and smoke results. Stop immediately on any failed mandatory gate. Production database, grants, users, release pointers, service, symlinks, timers, and data remain unchanged until separately approved.
