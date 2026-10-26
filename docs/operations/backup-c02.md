# C-02 managed backups

Backups live under `/opt/ops/thoidai-work/backups/managed`, split into `daily/` and `predeploy/`. Each complete backup has `postgres.dump`, `storage.tar.gz`, and `manifest.txt`; `.partial` directories are unpublished. Retention keeps seven daily backups, one per ISO week for four weeks, one per month for three months, and five predeploy backups. `.keep` and unknown names are protected. `THOIDAI_BACKUP_MAX_MB` defaults to 500 MB with a 50 MB reserve; the script never deletes outside its own root.

Owner approval is required before installation. Run `install -m 0750 scripts/production/thoidai-backup.sh /usr/local/sbin/thoidai-backup`, copy the four units to `/etc/systemd/system/`, then `systemctl daemon-reload` and `systemctl enable --now thoidai-backup.timer thoidai-backup-status.timer`.

Restore drill: use a temporary container, wait for initialization, revoke the default ACL, and restore with `supabase_admin`, reusing `scripts/production/c01-dryrun.sh` when available. Offsite storage is deferred and needs an owner-provided destination.