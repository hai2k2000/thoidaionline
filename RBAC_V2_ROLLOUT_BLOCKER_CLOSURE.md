# RBAC V2 Rollout Blocker Closure

Date: 2026-10-13
Repository: `hai2k2000/thoidaionline`
Target: `vps-aylaspa`
Checkpoint: no merge, migration, deploy, restart, or production grant change

## Decision

**BLOCKED — ready for owner-provided rollout credentials and a later retry.**

The artifact inventory blocker is closed in canonical production. Database and authenticated smoke mechanisms are identified, but the required approved runtime credentials/session are not available in the current rollout process. No production mutation was attempted.

## Blocker A — Migration Inventory

Closed by merged PR #14:

- Canonical `integration/production`: `36b4c117a365355062ccfa5d78afbfb7a2be7197`.
- PR: https://github.com/hai2k2000/thoidaionline/pull/14 (merged; required CI checks passed).
- Canonical artifact CI run: `38353438657` (success).
- Artifact commit: `36b4c117a365355062ccfa5d78afbfb7a2be7197`.
- Artifact: `thoidai-standalone-36b4c117a365355062ccfa5d78afbfb7a2be7197`.
- `MIGRATION_REFERENCE` contains `supabase/migrations/20261015100000_rbac_v2_role_user_overrides.sql` exactly once.
- Artifact metadata and verifier use the same migration inventory.
- Standalone verifier: PASS.
- Artifact manifest/checksum verifier: PASS (`3554` entries).
- Artifact metadata: `rbac_v2=supported`, `build_config=canonical-public`, `env_model=runtime-injected`.
- Artifact `.artifact-manifest.json` SHA-256: `4e26a0ef011019ac49ec0ea87c75dd29b9a25ed7ab535d60cccbc7a4b7c72b96`.

The merged migration file was not changed. The old artifact was not rewritten or its checksum edited; a new canonical artifact was downloaded for verify-only staging at `/opt/ops/thoidai-work/rollout-artifact-36b4c117a365355062ccfa5d78afbfb7a2be7197`.

## Blocker B — Database Connection Readiness

Read-only inspection on `vps-aylaspa` found:

- Production database container: `supabase_db_thoidai-work`, PostgreSQL 17.6, healthy.
- Container exposes host port `54332`; `psql`, `pg_dump`, and `pg_restore` 17.6 are available inside the approved container.
- Existing backup/restore infrastructure is present under `/opt/thoidai-work/ops-backups` and `/opt/ops/thoidai-work/backups`; no new backup was created in this checkpoint.
- Database identity probe through the container returned `postgres` database/user with local server address; credentials were not printed.
- Current read-only baseline remains: ledger 108 rows, latest `20261014100000`, 20 permissions, 125 role grants, 5 direct grants, 0 role/direct overlaps, 0 scope mismatches, and 1 effective `permission.manage` manager.
- `user_permission_grants.effect`, `api_list_effective_permissions`, and `rbac_v2_assert_legacy_rollback_compatible` are still absent, as expected before migration.
- Application `.env` files contain no `DATABASE_URL`, `SUPABASE_DB_URL`, or `THOIDAI_RBAC_DB_URL`. No systemd DB URL was present.

Status: **mechanism identified, approved pipeline credential not provisioned**.

Required owner action: provide an approved, temporary DB connection to the rollout process through the secure channel, preferably as `THOIDAI_RBAC_DB_URL`, or explicitly authorize the existing Docker-local PostgreSQL runner invocation without persisting its credential. Do not paste the URL/password into chat, commit it, or alter database access configuration.

## Blocker C — Authenticated Smoke Readiness

Existing smoke mechanisms were confirmed:

- `scripts/contract-smoke.mjs` requires `THOIDAI_SMOKE_COOKIE` or `THOIDAI_SMOKE_BEARER` and checks 13 authenticated API contracts, including session, tasks, schedules, journalism, attendance, and notifications.
- `scripts/production/browser-path-smoke.mjs` checks authenticated task-list and assignment paths.
- Deployment gate requires authenticated smoke evidence for activation; authentication is never bypassed.
- Current rollout environment has neither smoke variable set. No production user, password, session, cookie, or bearer token was created or changed.

Required owner action: perform an authorized login through the normal secure channel and make a short-lived cookie or bearer value available to the deployment process without sending it in chat. Smoke should use an approved test/owner account and must not alter real user grants.

## Additional Safety Verification

- Current service: active/running, `ExecMainStatus=0`, `NRestarts=0`, `/login=200`, port 3001 open.
- Disk: approximately 24.1 GiB free after artifact staging, above the 20 GiB floor; no build ran on VPS.
- Current/previous/rollback-1/rollback-2 pointers were read and unchanged.
- Final effective `permission.manage` manager baseline remains 1; no permission mutation was run.
- No cleanup APPLY, Docker prune, release deletion, systemd change, or credential rotation occurred.

## Validation

On clean branch `codex/rbac-v2-rollout-blocker-closure` from canonical `36b4c117...`:

- Focused artifact/deploy/rollback tests: `21/21 PASS`.
- Safe migration runner tests: `24/24 PASS`.
- TypeScript: PASS.
- Changed-file ESLint: PASS.
- `git diff --check`: PASS.
- Canonical CI artifact run `38353438657`: PASS.

## Production Safety

- Database migration: **NO**.
- Production backup: **NO new backup created**.
- Service restart/deploy: **NO**.
- Release/symlink changes: **NO**.
- Grants/users/roles changed: **NO**.
- Cleanup APPLY: **NO**.

## Retry Gate

Retry is allowed only after the owner supplies the secure DB connection and authenticated smoke session, and after a fresh preflight confirms disk, pointers, baseline counts, rollback compatibility path, and final manager protection. The next checkpoint may then perform backup, disposable restore/rehearsal, migration, activation, and smoke under the separately authorized rollout procedure.

Final checkpoint: **RBAC V2 ROLLOUT BLOCKER CLOSURE — BLOCKED**
