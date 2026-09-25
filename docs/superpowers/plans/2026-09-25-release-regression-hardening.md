# Release Regression Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended; inline execution is allowed for this task). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent stale-lineage releases and recurring list-page regressions through production ancestry, authenticated contracts, schema checks, provenance, canary validation, and application-only rollback.

**Architecture:** Add fail-closed scripts and focused tests around the existing standalone release flow. The release candidate must descend from the recorded production commit and originate from `integration/production`; artifacts carry immutable provenance and contract results. Canary and post-deploy gates use the same authenticated contract runner, while rollback changes only the application symlink/service state.

**Tech Stack:** Node.js ESM scripts/tests, Bash deployment helpers, Next.js standalone artifacts, PostgreSQL/Supabase checks through existing environment configuration.

**Spec:** User-approved Release Regression Hardening specification pasted in the task.

## Global Constraints

- No production deployment, migration, account creation, database mutation, or credential changes in this task.
- Existing Personal Plan, Journalism, Event Assignment, Online Work, Attendance, Task Approval, and Print behavior remain unchanged.
- Guards fail closed and never repair migration ledgers automatically.
- Secrets and credential values must never be printed or committed.
- Existing releases, backups, and rollback targets are preserved.

### Task 1: Dynamic release ancestry and integration guard

**Files:** `scripts/check-release-baseline.mjs`, `scripts/check-release-baseline.test.mjs`, `RELEASE_BASELINE.md`

- [ ] Write tests for candidate ancestry from a supplied production commit and rejection of stale candidates or non-integration branches.
- [ ] Implement environment/file based production commit resolution and require `integration/production` ancestry when repository metadata is available.
- [ ] Preserve packaged-artifact fallback while recording the resolved production parent.
- [ ] Run focused tests and commit.

### Task 2: Artifact provenance and release metadata

**Files:** `scripts/package-standalone.mjs`, `scripts/verify-standalone-artifact.mjs`, `scripts/artifact-provenance.mjs`, tests

- [ ] Write failing equality tests for local HEAD, remote HEAD, artifact source, metadata commit, production parent, integration baseline, and contract result.
- [ ] Add provenance generation/verification without exposing secrets.
- [ ] Make packaging fail on mismatch and include required migration/route references.
- [ ] Run focused tests and commit.

### Task 3: Authenticated API contract suite

**Files:** `scripts/contract-smoke.mjs`, `scripts/contract-smoke.test.mjs`, `scripts/required-api-contracts.mjs`

- [ ] Define response-shape contracts and empty-list expectations for tasks, schedules, Journalism, attendance, notifications, and session.
- [ ] Add safe login/session support using environment-provided credentials; redact all credential material.
- [ ] Add canary/base URL and role matrix support, with explicit skip/fail behavior when credentials are unavailable.
- [ ] Run unit tests and static contract validation.

### Task 4: Database/schema and PostgREST guards

**Files:** `scripts/check-production-schema.mjs`, `scripts/check-production-schema.test.mjs`, `scripts/check-postgrest-schema.mjs`

- [ ] Write tests for required columns/tables/RPC/status values and migration ledger consistency.
- [ ] Implement read-only checks using `psql`/HTTP and fail closed on missing or ambiguous schema.
- [ ] Add schema-cache verification for required REST fields/RPCs without automatic repair.

### Task 5: Cache permissions, disk guard, lock, canary and rollback

**Files:** `scripts/production/deploy-gate.sh`, `scripts/production/check-cache-permissions.sh`, `scripts/production/rollback-application.sh`, tests

- [ ] Write tests for cache ownership, free-space thresholds, lock acquisition, atomic activation, and rollback safety.
- [ ] Implement checks and application-only rollback helpers; do not mutate production in validation.
- [ ] Ensure retention runs only after successful validation and keeps rollback targets.

### Task 6: Documentation/status and full validation

**Files:** `PROJECT_STATUS.md`, `DEPLOY_CHECKLIST.md`, release docs

- [ ] Document canonical baseline, command sequence, role coverage, and current EACCES cache finding.
- [ ] Run focused tests, TypeScript, lint, baseline/route guards, build, and artifact verification.
- [ ] Commit and push the branch; report production unchanged.
