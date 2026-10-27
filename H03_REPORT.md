# H-03 Ledger Reconciliation

## Usage

```text
node scripts/production/ledger-reconcile.mjs checks --ledger ledger.txt > checks.sql
node scripts/production/ledger-reconcile.mjs report --results psql-output.txt
node scripts/production/ledger-reconcile.mjs backfill-sql --results psql-output.txt
```

The ledger is exported as one migration version per line. Run `checks.sql` with read-only `psql -At`; `backfill-sql` only prints SQL and never executes it.

## Regex limitations

The analyzer strips comments and recognizes only the specified CREATE/ALTER forms. It does not parse PostgreSQL grammar, so dynamic SQL, unusual quoting, unsupported multiline forms, renamed objects, overloaded signatures, and indirect dependencies may be missed. Objects dropped in the migration or a later migration are marked `dropped-later` and excluded from evidence counts.

## Proposed workflow

Claude exports the production ledger with a read-only query -> generate `checks.sql` -> run only those checks on production -> generate `report` -> owner approval -> generate and separately review `backfill-sql`. Do not rerun migration SQL.
