# C-02 CODEX Report

## Files created

- `scripts/production/thoidai-backup.sh`
- `scripts/production/thoidai-backup.test.mjs`
- `deploy/systemd/thoidai-backup.service`
- `deploy/systemd/thoidai-backup.timer`
- `deploy/systemd/thoidai-backup-status.service`
- `deploy/systemd/thoidai-backup-status.timer`
- `docs/operations/backup-c02.md`

## Validation

| Command | Result |
| --- | --- |
| `bash -n scripts/production/thoidai-backup.sh` | PASS |
| `bash scripts/production/thoidai-backup.sh self-test` | `SELF_TEST=PASS` |
| `node --test scripts/production/thoidai-backup.test.mjs` | 2 passed, 0 failed |
| `git diff --check` | PASS; no output |

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
