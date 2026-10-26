# C-02 CODEX Report

## Files created

- `scripts/production/thoidai-backup.sh`
- `scripts/production/thoidai-backup.test.mjs`
- `deploy/systemd/thoidai-backup.service`
- `deploy/systemd/thoidai-backup.timer`
- `deploy/systemd/thoidai-backup-status.service`
- `deploy/systemd/thoidai-backup-status.timer`
- `docs/operations/backup-c02.md`
- `scripts/production/backup-restore-drill.sh`

## Validation

| Command | Result |
| --- | --- |
| `bash -n scripts/production/thoidai-backup.sh` | PASS |
| `bash scripts/production/thoidai-backup.sh self-test` | `SELF_TEST=PASS` |
| `bash -n scripts/production/backup-restore-drill.sh` | PASS |
| `node --test scripts/production/thoidai-backup.test.mjs` | 3 passed, 0 failed |
| `git diff --check` | PASS; no output |

## C-02 restore drill

The restore drill is a verify-only VPS script. It selects and validates the newest complete daily backup, restores into an isolated Supabase PostgreSQL container, and compares required table counts with production read-only queries. It uses the C01 isolation/readiness contracts (`main` guard, `INCOMPLETE` status guard, cleanup trap, `--network none`, 512 MiB memory, init-log wait, three readiness probes, and four-role check). It does not dump production, write production, restart services, inspect/top the production container, or print secrets. The local workspace validation intentionally does not execute Docker, SSH, or the drill.

## Fix D1/D2 (first VPS run)

- D1: predecessor lookup now considers only direct child directories in `daily` whose names pass `valid_name`, excluding dot-prefixed partial directories; newest is selected by name.
- D2: partial cleanup uses an `EXIT` trap with an initialized cleanup flag, clears the flag after atomic rename, and is safe under `set -u`.
- Regression coverage runs two distinct fake `pg_dump` backups and a third identical dump, asserting exit 0, valid daily count, no remaining `.partial`, `last-success`, and the expected `DUPLICATE_OF` target.

No real `run`, `retention --apply`, Docker, SSH, network, or VPS command was executed.

## Retention example: 40 daily snapshots

For 40 snapshots dated consecutively from newest to oldest, the policy keeps:

| Rule | Kept |
| --- | --- |
| Daily window | 7 newest snapshots |
| ISO-week reserve | Newest snapshot in each ISO week, up to 4 weeks |
| Monthly reserve | Newest snapshot in each month, up to 3 months |
| Protected/unknown | `.keep` is always kept; unknown names are skipped and never deleted |

The exact total can be lower than the sum because one snapshot can satisfy more
than one rule. Predeploy retention independently keeps the 5 newest snapshots.

Illustrative names retained from a 40-day run (assuming one snapshot at
02:40 UTC daily): `20261026T024000Z-daily` through
`20261020T024000Z-daily` for the daily window, plus the newest snapshots at
the remaining ISO-week boundaries and month boundaries within the configured
four-week/three-month reserves. Older snapshots are reported as `DELETE=` in
dry-run output, never removed unless `--apply` is explicitly used.

## VPS assumptions not verified here

- The production host has `docker`, `flock`, GNU `tar`, `sha256sum`, `stat`,
  `realpath`, `date`, and `pg_restore` available as assumed by the task.
- `supabase_db_thoidai-work` exists and accepts the documented peer-authenticated
  `postgres` commands.
- `/opt/thoidai-work/storage` exists and cache directories, if present, should be
  excluded by the tar patterns.
- The owner will approve installation and provide an offsite destination in a
  later phase; offsite replication is intentionally not implemented here.

## Claude review fix
- `pg_restore --list` now uses `docker exec -i` (stdin was not forwarded, so verification always failed).
- Known limitation: `pg_dump -Fc` embeds a timestamp, so byte-level dedupe rarely triggers; bounded retention keeps size small (~1.5 MB per backup).

## Claude review fixes (round 2)
- Duplicate path now removes its .partial directory (previously leaked ~1.5 MB per duplicate run).
- manifest.txt records relative file names; restore drill accepts relative, absolute and "*"-prefixed names.
- Drill cleanup uses docker rm -f -v to avoid anonymous volume leaks.
- First VPS run needed the backup root to exist before ReadWritePaths namespacing; install doc creates it with install -d -m 0700.

## Restore drill fixes (VPS runs 1-2)

- Temp PostgreSQL readiness now waits up to 90 x 2 seconds for the exact init-complete log, then requires three consecutive 2-second probes combining `pg_isready` with all four Supabase roles checked through loopback `psql -h 127.0.0.1 -U supabase_admin`; timeout output includes the sanitized final 30 log lines.
- Temp ACL setup now mirrors the C01 default-privilege revokes for `postgres` and `supabase_admin`, and prints `TEMP_DEFAULT_ACL_PUBLIC=0` before restore.
- Every temporary-container `psql`/`pg_restore` call uses loopback and `supabase_admin`, fixing the first VPS authentication failure.
- Restore `already exists` errors are tolerated and excluded from the first-20 error report; table-count comparisons remain the PASS/FAIL gate, with a non-zero restore exit failing only when no table count is available.

## Restore drill round 3

- Changed restore scope to application data only: `public` and `supabase_migrations`; Supabase system schemas remain image-provided.
- Preserved temporary default-privilege revokes and loopback `supabase_admin` access. If the temporary image already contains `supabase_migrations.schema_migrations`, the drill truncates that temporary table before restore to avoid duplicate migration keys.
- Count checks now include sanitized `psql` stderr (printable characters, max 300 characters) in `DRILL_ERROR`; restore errors still report `RESTORE_ERRORS` and the first 20 non-`already exists` lines.
- Known limitation: disaster recovery requires the same Supabase stack version because `auth`, `storage`, `realtime`, extensions, and vault schemas are supplied by the image rather than restored by this application-data drill.
