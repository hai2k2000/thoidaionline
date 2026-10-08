# Safe Per-File Migration Pipeline Implementation Plan

> **For agentic workers:** Execute inline task-by-task. Do not use bulk Supabase migration commands or mutate production.

**Goal:** Add a fail-closed per-file migration runner that applies one approved SQL file and records exactly one canonical ledger row as one controlled operation.

**Architecture:** A Node CLI validates one migration filename/hash, discovers the actual `supabase_migrations.schema_migrations` shape, snapshots sanitized ledger state, and chooses a transaction-safe apply or explicit postcondition-gated reconciliation path. A thin shell wrapper follows existing production script conventions; evidence is written without credentials. Pure fixtures cover failure modes, while disposable PostgreSQL validation runs the same CLI against an isolated database.

**Tech Stack:** Node.js ESM, `node:test`, PostgreSQL `psql`, Bash wrapper, Supabase migration ledger.

**Spec:** Owner request “IMPLEMENT SAFE PER-FILE MIGRATION LEDGER PIPELINE” (2026-10-08).

## Global Constraints

- Operate on exactly one explicitly supplied migration file/version.
- Never call `supabase db push`, `supabase db reset`, bulk replay, or Docker cleanup.
- Never print/store database passwords, tokens, or raw DB URLs containing credentials.
- Existing unresolved legacy migration versions remain untouched.
- Production is read-only for validation; no new production migration is applied.

### Task 1: Runner core and preflight tests

**Files:**
- Create: `scripts/production/safe-apply-migration.mjs`
- Create: `scripts/production/safe-apply-migration.test.mjs`
- Create: `scripts/production/safe-apply-migration.sh`
- Modify: `package.json`

- [x] Write tests for filename parsing, hash/tamper detection, DB target redaction, duplicate version detection, and exact-one ledger diff.
- [x] Implement pure helpers and CLI argument parsing.
- [x] Add dry-run and already-applied behavior with no SQL execution.
- [x] Add sanitized evidence writer.
- [x] Run focused tests and commit.

### Task 2: Transactional apply and explicit fallback

**Files:**
- Modify: `scripts/production/safe-apply-migration.mjs`
- Modify: `scripts/production/safe-apply-migration.test.mjs`

- [x] Add conservative transaction-safety classification for known PostgreSQL non-transactional statements.
- [x] Add single-transaction migration-plus-ledger insertion with `ON_ERROR_STOP`.
- [x] Add fallback mode that requires postcondition SQL before ledger registration.
- [x] Add explicit `MIGRATION_SQL_FAILED`, `POSTCONDITION_FAILED`, `LEDGER_REGISTRATION_FAILED`, and `LEDGER_DIFF_UNEXPECTED` outcomes.
- [x] Ensure SQL success plus ledger failure says `SCHEMA MAY BE APPLIED - DO NOT REPLAY MIGRATION`.
- [x] Run focused tests and commit.

### Task 3: Reconciliation mode and disposable coverage

**Files:**
- Modify: `scripts/production/safe-apply-migration.mjs`
- Modify: `scripts/production/safe-apply-migration.test.mjs`
- Create: `scripts/production/safe-apply-migration.disposable.sh`

- [x] Add `--reconcile-applied-version`, which never executes migration SQL.
- [x] Require absent ledger, exact file/hash, and passing postcondition SQL before inserting one row.
- [x] Cover cases A-L using isolated PostgreSQL/fixture harness, including legacy missing versions and credential redaction.
- [x] Run disposable rehearsal and commit.

### Task 4: Deployment integration and documentation

**Files:**
- Modify: `package.json`
- Modify: `docs/FINAL_READINESS_REPORT.md`
- Modify: `docs/THOIDAI_WORK_2_GATE06_REPORT.md`
- Create: `docs/operations/safe-per-file-migrations.md`

- [x] Expose canonical `migration:apply` and `migration:dry-run` commands through the wrapper.
- [x] Replace manual-apply guidance with the runner/reconciliation rule.
- [x] Document evidence, legacy safety, failure statuses, and recovery.
- [x] Run full final gates and production dry-run against an already-applied migration only.
- [x] Commit and push the feature branch.
