# CP5 Database Management V1

## CP5A - Security hardening

- Server-session and same-origin guards remain mandatory for mutations.
- Sensitive record types remain default-deny and explicit ACL denies retain precedence.
- Private file storage uses UUID-scoped keys, exclusive creation, SHA-256 verification, and resolved-path checks that fail closed on symlink/junction escape.
- Multipart upload rejects request bodies above the 50 MiB file budget plus bounded multipart overhead before parsing.
- Upload, download, export, restore, CRUD, and ACL changes emit audit/history evidence.

## CP5B - Performance plan

The Search RPC has bounded `limit`/`offset`, a GIN index on `search_document`, type/status and department/owner indexes, and database-side ACL filtering. No N+1 database loop is used by list/search.

Acceptance thresholds for a future synthetic benchmark:

- p95 search latency <= 250 ms at 10,000 synthetic records.
- p95 filtered search latency <= 400 ms at 10,000 records.
- p95 detail read latency <= 200 ms with 20 ACL rows and 10 files.
- zero unauthorized rows and zero metadata/count side-channel findings.

Benchmark execution is `NOT RUN` in this checkpoint because the local disk is below the 22 GiB preferred budget; no large dataset was created.

## CP5C - Backup/restore

`scripts/database-v1-backup.mjs` provides synthetic-only manifest, SHA-256 verification, and isolated restore verification. It refuses non-synthetic labels, enforces the 10 GiB hard floor before writes, prevents backup/restore path overlap, and never connects to production.

Runbook:

1. Prepare a synthetic SQL dump and private storage root outside the repository.
2. Run `node scripts/database-v1-backup.mjs verify <backup-root>` after creation.
3. Restore to a separate disposable directory with `node scripts/database-v1-backup.mjs restore <backup-root> <restore-root>`.
4. Verify the manifest and SHA-256 members before any database import.
5. A real `pg_restore`/production backup operation requires a separate owner-approved production checkpoint.
