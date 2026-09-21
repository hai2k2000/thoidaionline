# J2 Isolated Database Tests

These SQL files are scratch-database behavior checks. They must not be run against production.

1. Create a disposable PostgreSQL database with a stub `public.tasks` table and the roles `anon`, `authenticated`, and `service_role` (with `BYPASSRLS`).
2. Run `j2_isolated_schema_test.sql) from this directory; it applies the J2 migration to the disposable database and checks schema, constraints, and direct-client denial.
3. Run `j2_isolated_read_test.sql` after the schema script; it checks parent-row filtering, count, ordering, pagination, and authorized scope.
4. Remove the disposable database/container after the run.

Production migration status remains NOT APPLIED.
