# RBAC V2 Secure Rollout Inputs

Status: preparation only. This document does not authorize production migration or activation.

## Database input

The approved VPS-local database is the healthy `supabase_db_thoidai-work` PostgreSQL 17.6 container. The existing runner accepts a PostgreSQL URL through a named environment variable, so no source adapter or new credential mechanism is required.

For an owner-approved rollout window, create the URL only in the current shell/process. Resolve the existing container password in memory, set `PGPASSWORD` and `THOIDAI_RBAC_DB_URL` for the exact command, and unset both immediately afterward. Do not echo the variables, put them in a file, add them to systemd, or include them in evidence.

```bash
dbpass=$(docker inspect supabase_db_thoidai-work --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | sed -n 's/^POSTGRES_PASSWORD=//p' | head -n1)
export PGPASSWORD="$dbpass"
export THOIDAI_RBAC_DB_URL=postgresql://postgres@127.0.0.1:54332/postgres
unset dbpass

# Run only the explicitly approved backup, dry-run, rehearsal, gate, or migration command.

unset PGPASSWORD THOIDAI_RBAC_DB_URL
```

The exact migration SHA must be checked before apply. Invoke the safe runner with `--db-url-env THOIDAI_RBAC_DB_URL`; its evidence contains only sanitized database identity.

## Authenticated smoke input

Smoke requires a short-lived owner-approved session. Existing scripts accept `THOIDAI_SMOKE_COOKIE` or `THOIDAI_SMOKE_BEARER`; they never create a user or bypass authentication. The owner must run one command in one private SSH shell so the identity check and both smoke scripts are children of the same process. An independently launched Codex SSH shell does not inherit the owner's exported variables.

After logging in normally with an authorized owner/test account, run exactly:

```bash
bash scripts/production/run-authenticated-smoke.sh
```

The command prompts for `cookie` or `bearer`, then reads the value without echoing it. Enter the complete cookie header field for `THOIDAI_SMOKE_COOKIE`, for example `thoidai_work_session=<value>`; enter only the token for `THOIDAI_SMOKE_BEARER` (no `Bearer ` prefix). The script then performs read-only `/api/auth/session` identity validation, read-only `/api/permissions` validation, authenticated contract smoke, and browser-path smoke in that same shell.

Expected success markers are:

- `authenticated identity: PASS`
- `permission catalog: PASS`
- `authenticated-contracts: PASS (13)`
- `browser-task-list-path: PASS (7)`
- `session variables cleared`

On any failure, the command exits non-zero and still prints `session variables cleared`. The `EXIT`, `HUP`, `INT`, and `TERM` traps remove both session variables, including interruption during hidden input. The session is cleared before the command returns; it is never available to a separate shell.

Do not paste the cookie/bearer into chat, files, GitHub comments, CI metadata, shell history, or reports. Do not change real-user grants or passwords for smoke.

## Preparation checks

- Unauthenticated `/api/permissions`, `/api/auth/session`, and `/api/tasks?journalism=false` return `401`.
- Authenticated smoke is ready only after the owner confirms the authorized account/session is present in the temporary shell and observes the four PASS markers plus cleanup.
- Any smoke data write requires an approved fixture and cleanup procedure; preparation remains read-only.

## Gate evidence distinctions

- The pre-migration rollback compatibility gate already passed read-only; it is not evidence of a post-migration deny/narrow-allow compatibility check.
- Migration dry-run classification and checksum validation are not a disposable backup/restore rehearsal. Backup and disposable restore remain separate owner-approved rollout steps.
