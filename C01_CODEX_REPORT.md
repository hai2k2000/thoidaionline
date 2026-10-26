# C-01 Codex Report — Stage 1 CODE
Status: CODE_DONE
Worktree / branch / HEAD (git rev-parse HEAD): `C:\Users\hai2k\Documents\Codex\thoidai-work\c01-anon-lockdown` / `security/c01-anon-access-lockdown` / `db18d106f1f9acfa6024d0d5b1913a3d3ddd3e6b`
RuleCodex source: offline verified snapshot of `hai2k2000/rulecodex` main at `ad0778f1311a025096df0bf9c3df566590361a65` (policy 1.2.0), from `C:\Users\hai2k\Desktop\hai2k\claude\cpay\codex-handoff\rulecodex-snapshot\SNAPSHOT_SOURCE.txt`; Codex read the complete `rule.md`, `GLOBAL_DEPLOY_POLICY.md`, `skills/local-vps-deploy/SKILL.md`, and `skills/don-dep-vps/SKILL.md` without network access.

## Files changed
- `supabase/migrations/20261027090000_anon_access_lockdown.sql` — copied verbatim from the C-01 source.
- `supabase/migrations/20261027090100_storage_anon_lockdown.sql` — copied verbatim from the C-01 source.
- `scripts/production/verify-anon-lockdown.sql` — copied verbatim from the C-01 source.
- `src/lib/anonAccessLockdown.test.mjs` — copied verbatim from the C-01 source.
- `deploy/nginx/thoidai-work-supa-allowlist.conf` — localhost/VPS-only `/supa/` allowlist fragment.
- `scripts/production/c01-dryrun.sh` — self-contained VPS dry-run with disk gate, read-only production dumps, temporary restore, embedded SQL, role checks, SHA-256 evidence and EXIT cleanup trap.
- `scripts/package-standalone.mjs` — appended both C-01 migrations to the ordered `MIGRATION_REFERENCE` packaging list.
- `scripts/verify-standalone-artifact.mjs` — appended both C-01 migrations to the artifact reference contract.
- `scripts/standalone-packaging.test.mjs` — updated the ordered migration-reference assertion for the two C-01 migrations.

The four copied files match byte-for-byte (SHA-256 source = destination):
- `20261027090000_anon_access_lockdown.sql`: `681D1A00E61FBDCB17EE02FB91680E65F79817EE53D5D0CA6835B2BA2957A413`
- `20261027090100_storage_anon_lockdown.sql`: `B13BE1D8E42D56C119DDC087C15B9B91E2BF5366B95137C442FBC42D223ACAD6`
- `verify_anon_lockdown.sql`: `77DB99F89EB621C07AC7D0129747FBF03A6454D6D988A6C2D732A5B9374A42E4`
- `anonAccessLockdown.test.mjs`: `CCBEEFABF25A0657F05E50D84DB5183A12D7CF78F79737DFF9A3EB24D000CBF6`

## Validation
- `node --test src/lib/anonAccessLockdown.test.mjs src/lib/backendSecurityHardening.test.mjs`: 8/8 PASS.
- TypeScript: `npx.cmd tsc --noEmit` exit 0.
- ESLint: changed JavaScript/MJS files exit 0.
- `node --test scripts/standalone-packaging.test.mjs`: 11/11 PASS.
- `git diff --check`: PASS.
- `bash -n scripts/production/c01-dryrun.sh`: PASS (Git Bash).
- `shellcheck`: unavailable on this host.
- Round 2 revalidation: `node --test src/lib/anonAccessLockdown.test.mjs src/lib/backendSecurityHardening.test.mjs scripts/standalone-packaging.test.mjs` = 19/19 PASS; `bash -n scripts/production/c01-dryrun.sh` = PASS; `git diff --check` = PASS.

## Dry-run script
- Checks `/` free space against 11 GiB (10 GiB floor plus 1 GiB headroom) and prints `DISK_*` plus `MEMORY_*` evidence.
- Uses only the two permitted production `docker exec ... pg_dump` commands, stores schema/ledger dumps in a chmod-0700 UTC directory, and prints dump SHA-256 values before cleanup.
- Starts the specified Supabase Postgres image without published ports and with `--memory 512m`; waits for `pg_isready` with timeout.
- Restores schema and migration ledger, prints restore warnings, runs embedded BEFORE verification, primary migration as `postgres`, storage migration as `supabase_admin`, and embedded AFTER verification.
- Prints `BEFORE_*`, `AFTER_*`, `ROLE_*`, `TRIGGER_INSERT`, `MIGRATION_*`, `SCHEMA_RESTORE`, `LEDGER_RESTORE`, `DRYRUN_STATUS` and cleanup `KEY=VALUE` lines.
- EXIT `trap` always attempts to remove the temporary container, volume and directory, then reports `CLEANUP_CONTAINER`, `CLEANUP_VOLUME` and `CLEANUP_DIR`.

## Deviations / Blockers
- Round 1 deviation: the public migration embedded in `scripts/production/c01-dryrun.sh` was not byte-for-byte identical to the source migration. It replaced the source transaction preamble (`begin`, lock timeout, statement timeout) with `set role postgres` while retaining `commit`; this was undocumented in the Round 1 report. Round 2 removes that deviation by embedding the exact source bytes and verifying their SHA-256 before execution.
- No production/VPS dry-run was executed in Stage 1, as required by the task constraints.
- `shellcheck` was not installed; `bash -n` passed.
- No Git write operation, package installation, network access, SSH, Docker command, or `.env` read was performed.

## Round 2 fixes
- R1: embeds both migration files as lossless gzip/base64 payloads, reconstructs the exact bytes, prints `SQL_PUBLIC_SHA256` and `SQL_STORAGE_SHA256`, and fails unless they match `681d1a00...` and `b13be1d8...`.
- R2: executes the storage migration through a direct `supabase_admin` connection; no `set role supabase_admin` is used.
- R3: restores the schema as `supabase_admin` without `ON_ERROR_STOP`, prints `SCHEMA_RESTORE_ERRORS`, and prints up to the first 20 filtered error lines; the baseline gate determines whether the restore is trustworthy.
- R4: runs service/anon role probes through `supabase_admin`; anon denial passes only for the exact expected table/function permission errors, while all other errors print `ERROR` plus a reason and exit nonzero.
- R5: starts the temporary database container with `--network none`.

- R6: compares BEFORE values with the production baseline and stops with `DRYRUN_STATUS=INCONCLUSIVE` before migrations on mismatch; AFTER requires all leak/missing/storage/RLS counts to be zero and the service-role RPC count to remain 108 before PASS.

## Round 3 fixes (dry-run run 1)
- R7: waits for the image's `PostgreSQL init process complete; ready for start up.` log marker, then requires three consecutive 2-second-spaced checks where `pg_isready` succeeds and `supabase_admin` sees all four required roles. Timeout evidence includes the sanitized last 30 container-log lines; successful startup prints `TEMP_DB_INIT=COMPLETE` and `TEMP_DB_HEALTH=PASS`.
- LOW: restore-error counting and the first-20-line excerpt now include both `ERROR:` and `FATAL:` records.
- Scope preserved: embedded SQL payloads, SHA-256 checks, baseline comparison, role checks, and cleanup were not changed.
- Validation: `bash -n scripts/production/c01-dryrun.sh` = PASS; `node --test src/lib/anonAccessLockdown.test.mjs scripts/standalone-packaging.test.mjs` = 14/14 PASS; `git diff --check` = PASS.

## Quan sát thêm (không xử lý)
- Existing standalone packaging is the repository's migration registry, so it was updated together with its verifier and focused contract test.

## Round 4 fixes (dry-run run 2)
- R8: before schema restore, revokes public-schema default privileges for `postgres` and `supabase_admin` across tables, sequences and functions using `-U supabase_admin` with `ON_ERROR_STOP=1`, then prints `TEMP_DEFAULT_ACL_PUBLIC`.
- R8: adds a read-only `storage.buckets` data dump with SHA-256 evidence; removes matching bucket IDs in the temporary database and restores the dump with `ON_ERROR_STOP=1` immediately after the migration ledger. `storage.objects` is untouched.
- Scope preserved: embedded SQL payloads and SHA-256 checks, baseline/AFTER criteria, role checks and cleanup remain unchanged.
- Validation: `bash -n scripts/production/c01-dryrun.sh` PASS; `node --test src/lib/anonAccessLockdown.test.mjs scripts/standalone-packaging.test.mjs` 14/14 PASS; `git diff --check` PASS. No script, Docker, SSH, network, package install, Git write, or `.env` read was performed.

## Round 5 fixes (dry-run run 3)
- R9: wraps the executable body in `main()` so Bash parses the complete function before any `docker exec -i` can consume the script stream; the final file line is `main "$@"; exit $?`.
- R9: redirects `psql_as` from `/dev/null` for the `TEMP_DEFAULT_ACL_PUBLIC` query, the only `docker exec -i` call without a file or heredoc input.
- R9: tracks whether PASS was printed; the EXIT cleanup trap converts any zero exit before `DRYRUN_STATUS=PASS` into `DRYRUN_STATUS=INCOMPLETE` with exit 1 while preserving cleanup evidence.
- Scope preserved: SQL payloads and SHA-256 checks, R7, R8, baseline/AFTER criteria and role checks are unchanged.
- Validation: `bash -n scripts/production/c01-dryrun.sh` PASS; `node --test src/lib/anonAccessLockdown.test.mjs scripts/standalone-packaging.test.mjs` 14/14 PASS; `git diff --check` PASS. No dry-run script, Docker, SSH, network, package install, Git write, or `.env` read was performed.

## Round 6 fixes (dry-run run 4)
- R10: the temporary `storage.buckets` conflict-delete transaction now sets `session_replication_role = replica`, reports `STORAGE_BUCKETS_CONFLICTS`, and deletes only matching bucket IDs.
- R10: bucket restore is assembled into a temporary transaction with the same temporary-only replica setting, preserving the dump content unchanged; the C-01 storage migration continues to run normally without replica mode.
- Scope preserved: main/status guard, embedded SQL payloads and SHA-256 checks, R7, R8, baseline/AFTER criteria and role checks are unchanged.
- Validation: `bash -n scripts/production/c01-dryrun.sh`; `node --test src/lib/anonAccessLockdown.test.mjs scripts/standalone-packaging.test.mjs`; `git diff --check`.

## Claude fix after dry-run run 5
- Dry-run run 5 matched the production baseline and exposed a real bug in the public migration: `acldefault(case ... end, oid)` passed `text`; fixed with an explicit `::"char"` cast (verified read-only on production: returns exactly the 9 exposed tables). New public SQL SHA-256 `aa26878d...`; dry-run payload and expected SHA updated; storage payload unchanged.

## Stage 3 apply runbook
- Added `scripts/production/c01-apply.sh` as a five-step, one-step-per-invocation production runbook (`backup|migrate|storage|nginx|verify`) requiring `--approved`, a non-blocking deploy `flock`, `main`/EXIT status guard, explicit stdin for every `docker exec -i`, no service/container restart, and no secret output.
- Embedded public migration, storage migration, and `verify-anon-lockdown.sql` as gzip+base64 payloads. The runbook decodes each payload into a temporary file and checks SHA-256 before use: public `aa26878df83a3e5ba3aebb8ecdcb2e870ffa662d279231b404aa283c357e0e30`, storage `b13be1d8e42d56c119ddc087c15b9b91e2bf5366b95137c442fbc42d223acad6`, verify `77db99f89eb621c07ac7d0129747fbf03a6454d6d988a6c2d732a5b9374a42e4`.
- Static validation required by the apply spec: `bash -n scripts/production/c01-apply.sh`, focused Node tests, and `git diff --check`. No script, SSH, Docker, network, package install, Git write, or `.env` read was performed in this sandbox.
- Payload `cmp` validation: PASS for public migration, storage migration, and verify SQL after gzip+base64 decode; all three match repository sources byte-for-byte.

## Stage 3 apply runbook - review round 1 fixes
- A1: migration execution and ledger writes now fail explicitly on errors; ledger writes use `supabase_admin`, verify the inserted version count, and migrate/storage branching uses explicit `if` statements.
- A2: BEFORE counts now compare against the documented production baseline and emit `BASELINE_MATCH=YES/NO`; AFTER uses zero leak counts and RPC count 108. Count prefixes are `BEFORE_*` and `AFTER_*`.
- A3: nginx location matching uses POSIX `[[:space:]]` in both `grep -E` and `awk`.
- A4: ledger insertion uses `supabase_admin` while public migration execution remains `postgres`.
- A5: EXIT cleanup removes only the temporary work directory; backups and `c01-last-backup` are preserved.
- Scope preserved: only `scripts/production/c01-apply.sh` and this report were changed in this round. Per request, no script, test, Git, network, SSH, Docker, package installation, or `.env` access was performed.
