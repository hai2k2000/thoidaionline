# Safe per-file migrations

Production schema changes use one explicitly approved migration file at a time.
The canonical command is:

```bash
MIGRATION_DB_URL='postgresql://...' \
  bash scripts/production/safe-apply-migration.sh \
  --file supabase/migrations/20261007100000_example.sql \
  --db-url-env MIGRATION_DB_URL
```

The URL is read from the named environment variable and is never written to evidence. The runner prints only a sanitized host/database identity and the migration SHA-256.

## Preflight and dry-run

Use `--dry-run` before an approved apply:

```bash
MIGRATION_DB_URL='postgresql://...' \
  bash scripts/production/safe-apply-migration.sh --dry-run \
  --file supabase/migrations/20261007100000_example.sql \
  --db-url-env MIGRATION_DB_URL
```

The runner validates the `YYYYMMDDHHMMSS_name.sql` filename, confines the file to `supabase/migrations`, rejects duplicate version filenames, hashes the exact bytes, discovers the live ledger columns, and snapshots the sanitized ledger before any write. If the version is already present it returns `ALREADY_APPLIED` and does not execute SQL.

## Apply behavior

Transaction-safe SQL runs as one PostgreSQL transaction:

```text
BEGIN
  exact migration SQL
  exact canonical ledger row
COMMIT
```

The ledger row mirrors the installed `supabase_migrations.schema_migrations` representation discovered during preflight. The runner verifies that the only ledger diff is one added target version. Any other diff fails closed.

Statements such as `CREATE INDEX CONCURRENTLY`, `VACUUM`, transaction-control commands, and other known non-transactional operations use the explicit fallback. The fallback executes the exact file, requires a caller-supplied postcondition SQL that returns `pass`, then registers only the target version. If SQL succeeds but postcondition or registration fails, the output is:

```text
SCHEMA MAY BE APPLIED - DO NOT REPLAY MIGRATION
```

Do not rerun the migration. Use reconciliation only after independently proving the schema is complete.

## Reconciliation

Reconciliation never executes migration SQL:

```bash
MIGRATION_DB_URL='postgresql://...' \
  bash scripts/production/safe-apply-migration.sh \
  --reconcile-applied-version \
  --expected-sha256 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  --postcondition-sql ops/postconditions/20261007100000.sql \
  --file supabase/migrations/20261007100000_example.sql \
  --db-url-env MIGRATION_DB_URL
```

It requires an absent target ledger row, the exact expected SHA-256, and a passing postcondition. It then inserts exactly one target row and verifies the ledger diff. It never registers unresolved legacy versions.

## Evidence and statuses

Evidence files live under `ops/evidence/migrations` by default with mode `0600`. They contain timestamp, version, filename, SHA-256, sanitized target, ledger snapshots represented by statement hashes, result, and ledger diff. They do not contain passwords, tokens, or raw connection URLs.

Statuses are `PRECHECK_FAILED`, `ALREADY_APPLIED`, `MIGRATION_SQL_FAILED`, `POSTCONDITION_FAILED`, `LEDGER_REGISTRATION_FAILED`, `LEDGER_DIFF_UNEXPECTED`, `DRY_RUN`, and `PASS`.

Known missing historical migrations remain untouched. Never use `supabase db push`, `supabase db reset`, migration replay, ledger-wide repair, `docker system prune`, or `docker volume prune` as a shortcut.

## Validation

Run repository tests and the disposable PostgreSQL rehearsal:

```bash
npm run migration:test
npm run migration:disposable
```

The disposable script uses a temporary PostgreSQL 17 container and removes it on exit. For the production safety check, run `migration:dry-run` against an already-applied recent migration and require `ALREADY_APPLIED`; do not apply a new production migration as part of this feature.
