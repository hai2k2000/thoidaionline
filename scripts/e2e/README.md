# Phase 3B.1 isolated authenticated E2E

The workflow in `.github/workflows/phase3b-isolated-e2e.yml` is a disposable,
non-production harness. It runs on an Ubuntu GitHub-hosted runner and creates
one private Docker network containing PostgreSQL 17 and a pinned PostgREST
container. The application runtimes only receive a `127.0.0.1` PostgREST URL
and generated test JWT/session secrets.

The fixture applies the representative production migration chain through
`20261015100000_rbac_v2_role_user_overrides.sql`, seeds synthetic users/assets,
and grants the PostgREST `service_role` only inside the disposable database.
No production URL, Supabase key, database backup, session secret, or real user
data is read or uploaded.

Both exact source commits are built independently with the sandbox URL because
`NEXT_PUBLIC_SUPABASE_URL` is embedded at build time:

- old production application: `bd4803933d6b98fd6996852992be566e6286ea67`
- canonical RBAC V2 application: `36b4c117a365355062ccfa5d78afbfb7a2be7197`

HTTP checks cover login/session, asset visibility and authorization, permission
management, quick-report allow/deny behavior, user override inherit/allow/deny,
and self-override protection. The new runtime additionally runs Playwright
browser smoke for `/login`, `/assets`, and `/tasks/quick-report`.

The builds are sandbox-only and are never eligible for production activation.
The runner removes the worktrees, containers, network, and temporary secrets in
the final workflow step. This harness does not prove production migration or
activation safety; those remain separate owner-approved gates.
