# JOURNALISM TASKS J4C PRODUCTION REPORT

Date: 2026-09-18
Status: ACTIVATED / OWNER UI SMOKE PENDING

## A. Provenance verification

- Authoritative J4 application commit: `e5f726dedd480929b6424db55fc083cd6a4afb26`.
- Owner-reported J4B-5 branch/report commit: `53e4d78a968655dc5c4963336aeb0c24db611b46`.
- Verified graph: commits after the application commit are report/docs only.
- Remote branch `journalism-tasks-j4b5-final-polish` resolves to `53e4d78...`.
- No application/runtime/test source changed after `e5f726d...`.

## B. Authoritative application commit

J4C was built from exact commit `e5f726dedd480929b6424db55fc083cd6a4afb26`; no deployment was made from a worktree.

## C. Report commit

This report is a report-only commit on the approved J4B-5 branch. Application source remains unchanged.

## D. Previous / new release

- Previous production release and rollback target: `/opt/releases/thoidai-work/de5063c5155e3f25b10fdfa11271fc298370f1cb-j3c-20260918T080957Z`.
- New active release: `/opt/releases/thoidai-work/e5f726dedd480929b6424db55fc083cd6a4afb26-j4c-20260918T134200Z`.
- New release commit: `e5f726dedd480929b6424db55fc083cd6a4afb26`.
- New BUILD_ID: `kjfXTLPUJ4HEB7AaFI4Q_`.

## E. Pre-activation production health

- Production HEAD: `8702827389e7e2452681c9e88c8d8ea899856a4c`.
- Service was active with `NRestarts=0`.
- Local health before switch: `/login=200`, anonymous `/api/tasks=401`.
- Public hostname DNS was unavailable from the host during this check; loopback service checks were used.
- Existing production worktree dirty state was preserved and not modified.

## F. Activation metadata backup

Snapshot: `/opt/releases/thoidai-work/ops-backups/j4c-preactivation-20260918T133805Z`.

It contains production git status/diff/stat/untracked list, current HEAD, systemd unit/drop-ins, service state, environment symlink metadata, current BUILD_ID, and checksum manifest. No secret values were recorded.

## G. Environment symlink guard

- New release `.env.local` -> `/opt/thoidai-work/.env.local`.
- New release `.env.production` -> `/opt/thoidai-work/.env.production`.
- `/opt/ops/thoidai-work/verify-release-env.sh`: PASS.
- Required variable names were present without printing values.
- `TASK_RBAC_V2_ENABLED=true` was preserved; no J4-specific feature flag was introduced.

## H. Production build / BUILD_ID

- `npm ci`: PASS, no reported vulnerabilities.
- `npm run build`: PASS using protected production configuration.
- BUILD_ID: `kjfXTLPUJ4HEB7AaFI4Q_`.
- Static generation completed successfully.
- `.next/cache` was made writable within the new release only for `thoidai-work`; `/opt/thoidai-work` was not changed.

## I. Artifact secret / dummy scan

- `example.invalid`: not found.
- `dummy-anon-key`: not found.
- `dummy-service-role-key`: not found.
- `dummy-session-secret`: not found.
- Server-only secret names were absent from `.next/static`.
- No secret values were printed or copied into the report.

## J. Isolated preflight

Ran the new release on unused localhost port `3199` under `thoidai-work` with the production environment symlinks.

- `/login=200`.
- Anonymous `/api/tasks=401`.
- `/tasks`, `/tasks/assign`, and `/tasks/assign?kind=journalism` redirected to authentication without 500.
- Anonymous Journalism mutation APIs returned `401` with a valid same-origin `Origin` header.
- No fatal/error loop or secret output observed.
- Preflight process was stopped after verification.

## K. Release switch / readiness

Systemd drop-in `/etc/systemd/system/thoidai-work.service.d/80-j4c-release.conf` points to the new immutable release and keeps `TASK_RBAC_V2_ENABLED=true`. After restart:

- service active;
- active WorkingDirectory is the new J4C release;
- `/login=200`;
- anonymous `/api/tasks=401`;
- `/tasks/assign` and `/tasks/assign?kind=journalism` reachable without server 500;
- `.next/cache` writable.

## L. Stability window

Repeated loopback checks over approximately 30 seconds remained healthy. `NRestarts` remained `0`; no fatal/error/500/restart-loop entries appeared in the recent service journal.

## M. Read-only Task / J4 smoke

Automated anonymous read gate passed. Authenticated browser smoke is intentionally pending owner action. No production Task was created or mutated by this activation step.

## N. Filters / read-path regression

J4B-5 focused and J2 regression evidence remains `124/124 PASS`, including Journalism-only/exclude (`journalism=is.null`), work-kind, publication-status, planned range, pagination/count/order, nested detail, and no `42703`. Production authenticated filter smoke remains owner-pending.

## O. Create-page smoke

Anonymous page gate reached `/tasks/assign` and `/tasks/assign?kind=journalism` without 500 after authentication redirect. Owner must verify the rendered normal/Journalism forms in the browser; no submit was performed automatically.

## P. Owner authenticated create smoke

**PENDING OWNER ACTION.** Use one clearly labelled internal test Journalism Task only. Do not send credentials, cookies, sessions, or tokens to Codex.

## Q. Metadata smoke

**PENDING OWNER ACTION.** Verify the authorized owner sees `Chỉnh sửa thông tin`, edits a safe field once, sees success feedback and refreshed value, and sees no URL/publication-status field.

## R. Schedule / cancel smoke

**PENDING OWNER ACTION.** Verify one future Vietnam-local schedule request, state `Đã lên lịch`, then one cancel request returning to `Chưa xuất bản` with cleared planned time. No fake publish/withdraw was performed.

## S. Permission-aware UI smoke

Automated server authorization and J4B-5 matrix evidence passed. Owner-controlled authenticated role smoke is pending; do not fabricate users or sessions.

## T. Normal Task regression

No production mutation was performed. J4B-5 focused compatibility evidence passed: normal Task remains normal, recurrence remains in normal create, and Journalism controls render only for Journalism Tasks.

## U. Module smoke

No broad production mutations were performed. Existing module regression evidence remains green within the approved focused suites; authenticated production smoke is pending owner review.

## V. Client security scan

New artifact static bundle contains no service-role secret name/value, `SESSION_SECRET`, `service_role`, direct Journalism RPC access, direct Journalism table mutation credentials, or role-string authorization shortcut.

## W. RBAC / backend unchanged

Read-only production checks:

- permissions: `19`;
- role grants: `128`;
- Journalism work kinds: `10`;
- Journalism detail rows before owner smoke: `0`;
- canonical grant hash remains owner-approved `1e87d9404fef719a22f8a4369d871a09df1a93bb46a7d7512c22affe245943bc`;
- `TASK_RBAC_V2_ENABLED=true`;
- no migration, schema, RPC, RLS, permission, or grant command was run.

## X. Test Task disposition

No owner smoke Task exists yet. If owner creates one, it will not be deleted automatically; owner may retain/archive it according to the existing workflow.

## Y. Rollback readiness

Rollback is application-only and targets the preserved J3 release in section D. The pre-activation snapshot records the prior service state and drop-ins. No database rollback is required or permitted for J4C.

## Z. Final release / status

**J4C = ACTIVATED / OWNER UI SMOKE PENDING**

**JOURNALISM J4 = NOT YET CLOSED**

Owner must complete authenticated create, metadata, schedule/cancel, permission-aware, and normal Task browser smoke before J4 can be marked DONE. No J5, CMS Connector, Topics/Series, KPI, AI, migration, grant, schema, RPC, or further deployment has been started.
