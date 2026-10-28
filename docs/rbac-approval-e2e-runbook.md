# RBAC approval v1 disposable HTTP rig

Run the sequence from a clean Claude shell. All values below are environment variables; do not paste their values into logs or committed files.

1. Bundle the checked-out source and scripts into the VPS staging directory expected by the deployment bundle workflow.
2. On the VPS, export `THOIDAI_RBAC_E2E_APPROVED=1`, `RBAC_E2E_PASSWORD`, `RBAC_E2E_JWT_SECRET`, `BUNDLE_DIR`, and (optionally) `POSTGRES_IMAGE`/`RBAC_E2E_REST_PORT`, then run `bash scripts/production/rbac-approval-e2e-rig.sh up`. PostgREST authenticates over the private Docker network as `supabase_admin` because the restored image provides that TCP role/password; no known `authenticator` password is assumed.
3. Create an SSH tunnel from the Windows machine to the printed PostgREST port, bound locally at `127.0.0.1:55432`.
4. Start the proxy: `REST_PORT=55432 PROXY_PORT=54320 node scripts/dev/supabase-rest-proxy.mjs`.
5. Start Next development with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54320`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-rig-jwt-client-value>`, and the repository's normal development variables, without printing values.
6. Set `BASE_URL=http://127.0.0.1:3000` and `RBAC_E2E_PASSWORD` in the matrix shell, then run `node scripts/production/rbac-approval-e2e-matrix.mjs`.
7. Spot-check the UI: login as `rep_a1`, `rep_a2`, `manager_a`, `ptbt`, and `tbt`; verify queue visibility; approve/reject controls; stale revision conflict; permission detail/history; revoke of `rep_a1`; and inactive-user login denial.
8. When finished, stop Next/proxy/tunnel and run `bash scripts/production/rbac-approval-e2e-rig.sh down` on the VPS. Confirm `status` shows no `rbac-e2e-*` containers.

If a stale or already-reviewed mutation is mistakenly raised with SQLSTATE `40001`, PostgREST retries the transaction and the request can loop instead of returning a conflict. The matrix has a 20-second request timeout; if the backend is looping, run the rig `down` command to clear the looping backend before restarting the rig.
