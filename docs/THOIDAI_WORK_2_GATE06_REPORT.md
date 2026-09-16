# Thoi Dai Work 2.0 - Gate 0.6 Baseline Stabilization Report

Date: 2026-09-16 (Asia/Bangkok)

Scope: source reconciliation, migration-runner analysis, metadata-only ledger repair, baseline stabilization and security review. No RBAC tables, `work_kind`, Topic schema, workflow change or historical migration SQL execution was performed.

## A. Main/source reconciliation status

- Clean branch: `gate0-20260916`, based on `origin/main` `fb1058b`.
- Reconciliation commit: `9cb7f6d` (systemd non-root hardening, lockfile metadata and Gate 0.5 report).
- Production service hardening is represented in Git; it was not deployed from this branch.
- HMAC bridge, personal-plan migration/test and AppNav/work-schedule source were already present and hash-matched production; no blind copy was made.
- `.next.before-*`, backups, runtime files and secrets remain untracked/excluded.
- `PROJECT_STATUS.md` still requires manual editorial merge because production history contains stale/conflicting claims. It was not auto-overwritten.
- The branch is clean after this report. Local `main`/GitHub remote was not force-updated or pushed; production was not changed.

## B. Migration runner behavior

Evidence reviewed:

- `package.json` has only `dev`, `build`, `start`, and `lint`; no migration script.
- No `.github` CI workflow exists.
- `deploy/systemd` contains app/evaluation/recurrence/port-guard units only; no migration unit or startup hook.
- `supabase/config.toml` has `[db.migrations] enabled=true`, so Supabase CLI `db push/reset` would consider ordered files in `supabase/migrations`.
- Production has no `supabase` CLI/systemd migration runner; prior changes are documented as manual `psql`/per-file operations.

Conclusion: the application does not automatically run unregistered migrations. A future `supabase db push` or `db reset` would be unsafe while four legacy files are unresolved because the CLI could replay them. Operational rule: do not run bulk Supabase migration commands until the legacy files are quarantined/baselined or explicitly reconciled.

## C. Ledger before/after

Fresh backup was taken before metadata repair. Ledger before had 96 rows and ended at `20260901095000`. A metadata-only transaction inserted exactly 11 rows with `statements='{}'`; no migration file was executed. Ledger after has 107 rows. Set diff contains exactly the 11 requested versions and no removals. The four unresolved versions remain absent:

`20260909121500`, `20260909143000`, `20260911083000`, `20260911190000`.

## D. Eleven migration final verification

All 11 previously verified migrations passed the independent final check and were metadata-registered:

`20260909110000`, `20260909170000`, `20260910090000`, `20260910150000`, `20260911110000`, `20260911133000`, `20260911150000`, `20260911170000`, `20260911180000`, `20260911230000`, `20260915120000`.

For each file, SQL was read in the clean branch, SHA-256 was recorded in Gate 0.5, and live tables/columns/constraints/indexes/functions/triggers/RLS/ACL/data effects were checked. No SQL migration was replayed. `work_kind`, Topic and journalism schema remain absent by design.

## E. Four legacy unresolved migrations

- `20260909121500`: `LEGACY_UNRESOLVED`; September online rows exist through a later normalized schedule path, but exact seed provenance is not provable. Do not register/replay.
- `20260909143000`: `LEGACY_UNRESOLVED`; its duty function/index was superseded by the three-position roster migration. Do not register/replay.
- `20260911083000`: `LEGACY_UNRESOLVED`; trigger exists and current password state is repaired, but exact one-time target set is not reconstructable. Do not register/replay.
- `20260911190000`: `LEGACY_UNRESOLVED`; `must_change_password` and password RPCs exist, but historical update provenance is not reconstructable. Do not register/replay.

Their absence does not block additive migrations technically after the operator rule above is followed; the risk is specifically bulk CLI replay. Safe future options are an explicit baseline/quarantine configuration or a reviewed reconciliation migration, not fake applied rows.

## F. Critical test suite

Focused security/workflow suite: **79/79 pass**. It covers signed sessions, authorization scope, task assignment/completion/scoring, leave approval, attendance authorization/HMAC/replay, duty/online/personal schedule permissions and service-role boundaries.

Full suite remains 352 total / 319 pass / 33 fail. Remaining failures are classified as obsolete or stale UI contract, behavior-without-test-update, likely lint/UI issues, or environment-dependent; no critical auth/data-integrity failure was found in the focused suite.

## G. Remaining test/lint debt

- TypeScript: pass.
- `npm ci --ignore-scripts --no-audit --no-fund`: pass after lockfile reconciliation; no dependency version upgrade.
- `npm run build`: pass with non-secret dummy Supabase/session values; 3 existing HR dynamic-filesystem tracing warnings.
- Full ESLint: still fails (25 errors, 30 warnings), mostly pre-existing `no-explicit-any` and React effect-state rules. No new warning was introduced by the reconciliation commit.
- Full test debt: 33 failures remain; do not rewrite tests solely to obtain green.

## H. Authenticated smoke result

Production public probes: `/login` HTTP 200; protected task, attendance, leave and schedule APIs HTTP 401. Role-by-role authenticated smoke was not executed because no safe test credentials/session were provided. Manual checklist is prepared for employee, department manager, leadership/TBT and admin, covering login/logout, task workflow, scope, attendance/sync, leave/trip, duty/online/personal plans and forbidden cross-scope access. No production data was created.

## I. `audit_direct_assignment_start` grant result

Function definition confirms it is a `SECURITY DEFINER` trigger function invoked by `tasks.audit_direct_assignment_start`; it is not an application RPC caller. PUBLIC, anon and authenticated execute grants are unnecessary. A local trigger test was not run against a disposable clone in this session, so revoke safety is **not yet proven**. No grant change was made. Keep this as a separate security-hardening task before production revoke.

## J. Backup/checksum evidence

Fresh pre-repair backup: `/opt/thoidai-work-backups/gate06-20260916T033806Z/`.

Contains full custom dump (838 KB), schema dump (546 KB), ledger-before export (3.9 KB), source snapshot (796 MB), metadata, and SHA-256 manifests. Checksums verified for all primary files. Ledger before/after exports and exact added-set diff are present. Service was `active`; production HEAD/build identifiers are recorded in `metadata.txt`.

## K. Open risks

- Source reconciliation is now fast-forwarded and pushed to GitHub `main` at `daedd51`; production was not deployed.
- Four legacy migration histories remain unresolved and must never be bulk-replayed.
- Full suite/lint debt remains.
- Authenticated production smoke is still pending owner-provided safe test access.
- Trigger grant revoke still needs disposable-clone proof.
- `PROJECT_STATUS.md` needs manual factual merge.

## L. Phase 1A decision

**NO-GO.** Gate 0.6 has stabilized metadata and critical tests, but GO criteria are not all satisfied: authenticated smoke is pending, trigger-grant revoke safety is unproven, and full baseline debt remains. Stop here and await owner review.

## M. Starting baseline if later approved

Current GitHub `main` baseline: `daedd51`. Live schema is unchanged by Gate 0.6; live ledger is 107 rows with exactly the 11 verified additions above and the four unresolved versions absent.
