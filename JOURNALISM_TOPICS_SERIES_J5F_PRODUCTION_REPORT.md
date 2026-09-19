# Journalism Topics / Series J5F Production Report

Status: **J5F = MIGRATED + ACTIVATED / OWNER UI SMOKE PENDING**

Journalism J5 remains open until the owner completes an authenticated UI smoke. No production Topic, Series, membership, reorder, Task, or fabricated session was created by this run.

## A. Approval and provenance

- Work was resumed from the approved post-J5C RBAC reconciliation checkpoint.
- Authoritative application commit: `078199d865a00ee216d429a1b1a3caad43da997d`.
- J5E report commit: `66f3452229cdbdd79e2f299544357359c5606386`.
- J5D migration SHA-256: `fa6bbc73eabd787c386df2d7861b0a996d618b0f5da00801afc0247fc5e198ba`.
- The historically dirty `/opt/thoidai-work` checkout was not reset, cleaned, or used as the runtime source.

## B. RBAC hash reconciliation

The authoritative canonical algorithm is:

`role_code|permission_code|scope`, sorted by raw UTF-8 bytes, joined with LF, with no final newline, then SHA-256.

- Pre-J5 backup: 128 grants, 4775 bytes, hash `1e87d9404fef719a22f8a4369d871a09df1a93bb46a7d7512c22affe245943bc`.
- Current post-J5C/J5D state: 21 permissions, 140 grants, 5354 bytes, hash `99b3a0991ffd411825e188a5acbc1b67390c96763ff86b58c7197347f0148c3a`.
- Current minus pre-J5 backup: exactly the approved 12 J5C tuples.
- Pre-J5 backup minus current: 0 tuples.
- Isolated and production tuple sets: identical (added 0, removed 0).
- The former isolated value `38001df3dfb0751f1288033bf415251a8314e0866caf5dfa231c10f7b0772638` is **SUPERSEDED / NON-REPRODUCIBLE** under the authoritative algorithm (CASE B: serialization/evidence discrepancy). Production grants were not changed during reconciliation or activation.

Evidence and the pre-J5 database backup remain under:

`/opt/releases/thoidai-work/ops-backups/j5f-20260919T003934Z/`

Backup SHA-256: `16b279bef4a7580928cfdf2c3008b9b0e5e313c1d6243cc097c6a1caf1b5a4a9`.

## C. Database state and migration safety

- J5B, J5C, and J5D were applied explicitly per-file; `supabase db push`, `supabase db reset`, and migration-ledger repair were not used.
- Migration ledger remains unchanged.
- J5 tables exist with RLS enabled: `editorial_topics`, `editorial_series`, `editorial_topic_tasks`, `editorial_series_items`.
- J5 RPCs have `search_path=pg_catalog, public`; `PUBLIC`, `anon`, and `authenticated` execute are false; `service_role` execute is true.
- Current counts: Topics 0, Series 0, Topic-task associations 0, Series items 0, Tasks 253, Journalism task details 0.
- No automatic J5 data was seeded and no existing Task data was mutated.

## D. Pre-activation J4C compatibility

Before switching the application, the J4C release remained healthy against the additive J5 database state: service active, `NRestarts=0`, `/login=200`, anonymous `/api/tasks=401`, and Task routes redirected safely without 500 responses. The pre-activation snapshot is in `continuation-20260919T014600Z/`.

## E. Immutable J5E release

- Release: `/opt/releases/thoidai-work/078199d865a00ee216d429a1b1a3caad43da997d-j5f-20260919T013220Z`.
- `.env.local` and `.env.production` point to the existing production environment files.
- `verify-release-env.sh`: PASS.
- `npm ci`: PASS.
- Production build: PASS.
- BUILD_ID: `-ZyE4cNZUmx87WukzRHtS`.
- Artifact scan: clear for `example.invalid`, `dummy-anon-key`, `dummy-service-role-key`, `dummy-session-secret`, and client-bundle secret markers.
- `.next/cache`: writable by `thoidai-work`.

## F. Isolated preflight

The release was run on `127.0.0.1:3137` as `thoidai-work`, then stopped by its exact PID after checks. `/login` returned 200; protected pages returned safe auth redirects; no fatal/error/restart loop was observed. Mutation requests with same-origin headers returned 401 as required.

The initial curl probes without `Origin`/`Referer` returned 403 `invalid_origin`; this is the intentional same-origin CSRF guard in `requireMutationActor`, not an authorization bypass or application failure. Re-running with same-origin headers returned 401 for Topic, Series, association, and reorder endpoints.

## G. Controlled activation

- Existing reversible systemd mechanism was retained.
- Added `/etc/systemd/system/thoidai-work.service.d/90-j5f-release.conf` pointing to the immutable J5E release with `TASK_RBAC_V2_ENABLED=true`.
- The J4C `80-j4c-release.conf` and release remain intact as the application rollback target:
  `/opt/releases/thoidai-work/e5f726dedd480929b6424db55fc083cd6a4afb26-j4c-20260918T134200Z`.
- `systemctl daemon-reload` and a single controlled service restart completed successfully.

Readiness polling passed on the first attempt: service active, `NRestarts=0`, `/login=200`, anonymous `/api/tasks=401`, all Task/Journalism filter routes without 500, and all anonymous J5 mutation APIs returned 401 with same-origin headers.

## H. Stability window

Thirty-second stability window passed: service remained active, `NRestarts` stayed at 0, no fatal/error/500 loop was observed, and the J5E cache remained writable.

## I. Post-activation read-only smoke

- Active `WorkingDirectory` is the J5E release above.
- Active flag: `TASK_RBAC_V2_ENABLED=true`.
- `/login=200`; `/api/tasks=401`.
- `/tasks`, `/tasks/assign`, Journalism Task Center filters, and `/journalism/structures` returned safe redirects (307) without server 500.
- Anonymous Topic/Series management, Topic/Series association, and Series reorder requests returned 401 with same-origin headers.
- Artifact security scan remained clear.
- Database invariants remained 21 permissions / 140 grants, canonical hash `99b3...`, four RLS tables, secure RPC ACLs, zero seeded structure/association rows, 253 Tasks, and zero Journalism task details.

## J. Rollback readiness

Application-only rollback is prepared by switching the systemd release drop-in back to the preserved J4C release. No automatic database rollback is indicated or performed. The database backup and evidence directory above are preserved for an approved recovery procedure if a real DB/security failure is later identified.

## K. Owner UI smoke pending

The owner must perform the authenticated, clearly labelled production UI smoke for Topic/Series create/edit/archive, Task attach/detach, filters, permission-aware rendering, ordering (only with safe existing test Tasks), and J4 regressions. This run intentionally stopped before those mutations.

## Final status

**J5F = MIGRATED + ACTIVATED / OWNER UI SMOKE PENDING**

**JOURNALISM J5 = NOT YET CLOSED**
