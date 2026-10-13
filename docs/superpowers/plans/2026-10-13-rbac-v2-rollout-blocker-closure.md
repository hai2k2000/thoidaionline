# RBAC V2 Rollout Blocker Closure Implementation Plan

> **For agentic workers:** Use this plan task-by-task; do not merge, migrate, deploy, restart, or modify production grants in this checkpoint.

**Goal:** Close the RBAC V2 rollout inventory gap and document safe database/smoke readiness without performing production mutation.

**Architecture:** Reuse the merged artifact contract from canonical `integration/production`; do not create a second migration inventory or database access framework. Inspect the existing VPS Docker/PostgreSQL and smoke mechanisms read-only, then record any missing owner-provided credential/session prerequisites.

**Tech Stack:** Next.js standalone packaging, Node test runner, TypeScript, ESLint, Bash deployment helpers, PostgreSQL 17, Docker, GitHub Actions.

**Spec:** `RBAC_V2_PRODUCTION_READINESS` user request and `docs/operations/rbac-v2-migration-first-rollout.md`

## Global Constraints

- Do not merge, run production migration, deploy, restart service, change grants, alter credentials, change `pg_hba.conf`, or run cleanup APPLY.
- Do not print, commit, or persist plaintext database credentials, cookies, bearer tokens, or environment-file contents.
- Do not modify `supabase/migrations/20261015100000_rbac_v2_role_user_overrides.sql`.
- Use the canonical artifact contract and existing safe migration/deploy helpers.
- Keep production rollback pointers and the final `permission.manage` manager protected.

---

### Task 1: Confirm Canonical Artifact Contract

**Files:**
- Read: `scripts/package-standalone.mjs`
- Read: `scripts/verify-standalone-artifact.mjs`
- Read: `scripts/standalone-packaging.test.mjs`

- [x] Verify canonical `integration/production` includes the RBAC V2 migration in both package and verifier inventories.
- [x] Run focused packaging, artifact, deploy, rollback, migration runner, TypeScript, ESLint, and diff checks.
- [x] Record canonical SHA and CI evidence in the closure report.

### Task 2: Audit VPS Database Readiness

**Files:**
- Read: `/opt/thoidai-work/.env.local` and `/opt/thoidai-work/.env.production` by variable-name presence only.
- Read: `supabase_db_thoidai-work` container metadata and PostgreSQL client versions.
- Read: `docs/operations/safe-per-file-migrations.md`

- [x] Confirm healthy PostgreSQL 17.6 container and current production database identity without logging secrets.
- [x] Confirm existing backup/restore mechanisms and existing production baseline counts.
- [x] Determine whether an approved DB URL is available to the runner; if absent, stop without backup or migration.

### Task 3: Audit Authenticated Smoke Readiness

**Files:**
- Read: `scripts/contract-smoke.mjs`
- Read: `scripts/production/browser-path-smoke.mjs`
- Read: `scripts/production/deploy-gate.sh`

- [x] Identify required smoke credential variables and covered API/browser paths.
- [x] Confirm credentials are not present in the current rollout process without exposing values.
- [x] Record the owner action needed to provide a temporary authorized session through the secure channel.

### Task 4: Closure Report and PR

**Files:**
- Create: `RBAC_V2_ROLLOUT_BLOCKER_CLOSURE.md`

- [x] Report blocker A as closed by merged PR #14 and canonical SHA `36b4c117...`.
- [x] Report blocker B/C as readiness mechanisms identified but blocked on owner-provided credentials/session.
- [x] State production safety and exact PASS/FAIL evidence.
- [x] Commit and push the feature branch; open a PR targeting `integration/production`.
- [x] Stop at `RBAC V2 ROLLOUT BLOCKER CLOSURE — BLOCKED`.
