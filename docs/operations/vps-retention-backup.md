# Thoi Dai operations proposals

## Backup h? s? CSDL

`thoidai-backup.service` ch?y qua `thoidai-backup.timer` h?ng ng?y l?c 02:40 gi? Vi?t Nam, c? `Persistent=true` v? tr? ng?u nhi?n t?i ?a 10 ph?t. Backup managed t?n t?i trong `/opt/ops/thoidai-work/backups/managed/daily` v? `/opt/ops/thoidai-work/backups/managed/predeploy`; t?i th?i ?i?m ki?m tra VPS gi? kho?ng 20 b?n daily v? predeploy. M?i b?n c? PostgreSQL custom dump v? `storage.tar.gz`.

`DATABASE_RECORD_STORAGE_ROOT=/opt/thoidai-work/storage/database-records` hi?n n?m trong `/opt/thoidai-work/storage`, v? v?y `storage.tar.gz` ?? bao g?m h? s? CSDL. Script ch? t?o th?m `database-records.tar.gz` n?u ???ng d?n h? s? ???c c?u h?nh ra ngo?i storage root, tr?nh archive tr?ng l?p.

R?i ro c?n l?i: c?c backup ?ang n?m tr?n c?ng ? ??a VPS v? ch?a c? b?n sao off-site. Vi?c ch?n ??ch off-site, m? h?a, l?ch truy?n v? retention ngo?i VPS c?n ch? d? ?n quy?t ??nh ri?ng.

## Retention

Retention m?c ??nh dry-run. `--apply` c?n y?u c?u `THOIDAI_RETENTION_APPROVED=1`. Script b?o v? lifecycle pointers, `.keep`, `build-evidence`, `ops-backups`, N release m?i nh?t v? m?i release c?n ???c process, symlink ho?c c?u h?nh systemd/nginx tham chi?u. M?i l?n ch?y ghi TSV evidence.

?? xu?t ch?a ?p d?ng: systemd timer h?ng tu?n ch?y `release-retention.sh --dry-run` v? g?i b?o c?o. Ch? ??i sang APPLY sau ph? duy?t ri?ng c?a ch? d? ?n.

## Unit drop-in ?? xu?t

```ini
# /etc/systemd/system/thoidai-work.service.d/40-release-preflight.conf
[Service]
ExecStartPre=
ExecStartPre=/usr/bin/test -f /opt/releases/thoidai-work/current/.release-meta
```

Sau ph? duy?t m?i ch?y `systemctl daemon-reload`, restart service v? health-check. Kh?ng c? l?nh n?o ???c ?p d?ng tr?n VPS trong ??t n?y.
