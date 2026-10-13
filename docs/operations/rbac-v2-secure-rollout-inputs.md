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

Smoke requires a short-lived owner-approved session. Existing scripts accept `THOIDAI_SMOKE_COOKIE` or `THOIDAI_SMOKE_BEARER`; they never create a user or bypass authentication.

Owner procedure directly on the VPS:

1. Log in through the normal application flow using an authorized owner/test account.
2. Open a private shell on the VPS and enter the short-lived value without echoing it:

```bash
read -rs THOIDAI_SMOKE_COOKIE
export THOIDAI_SMOKE_COOKIE
```

3. Confirm the account identity and required permissions using the read-only session/API checks before activation.
4. Run only the approved read-only contract/browser smoke during preparation.
5. Immediately remove the value:

```bash
unset THOIDAI_SMOKE_COOKIE
```

Do not paste the cookie/bearer into chat, files, GitHub comments, CI metadata, shell history, or reports. Do not change real-user grants or passwords for smoke.

## Preparation checks

- Unauthenticated `/api/permissions`, `/api/auth/session`, and `/api/tasks?journalism=false` return `401`.
- Authenticated smoke is ready only after the owner confirms the authorized account/session is present in the temporary shell.
- Any smoke data write requires an approved fixture and cleanup procedure; preparation remains read-only.
