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

Automated anonymous read gate passed. Owner-controlled authenticated browser smoke also passed. One designated internal Journalism UI test Task was created and retained; it was not deleted automatically.

## N. Filters / read-path regression

J4B-5 focused and J2 regression evidence remains `124/124 PASS`, including Journalism-only/exclude (`journalism=is.null`), work-kind, publication-status, planned range, pagination/count/order, nested detail, and no `42703`. Production authenticated filter smoke remains owner-pending.

## O. Create-page smoke

Anonymous page gate reached `/tasks/assign` and `/tasks/assign?kind=journalism` without 500 after authentication redirect. Owner authenticated smoke confirmed the Journalism form rendered correctly, active work kinds loaded, recurrence was absent, exactly one parent Task was created, the detail page rendered, and initial publication status was `not_published`.

## P. Owner authenticated create smoke

**PASS.** Owner used one designated internal test Journalism Task. Exactly one parent Task was created through the Journalism create UI. No credentials, cookies, sessions, or tokens were sent to Codex.

## Q. Metadata smoke

**PASS.** Authorized owner saw `Chỉnh sửa thông tin`, changed approved metadata once, saw success feedback and the refreshed server value, and confirmed there was no `articleUrl`, publication-status, or `publishedAt` field in the metadata form.

## R. Schedule / cancel smoke

**PASS.** Owner scheduled a future Vietnam-local time exactly once; the state became `Đã lên lịch` and displayed correctly. Owner then cancelled the schedule exactly once; the state returned to `Chưa xuất bản` and planned time cleared.

No fake publish/withdraw production smoke was performed. This was intentional: J4B/J3 isolated tests already cover publish URL validation, immutable URL behavior, published/withdrawn transitions, withdrawal reason, locking/concurrency, and 409 handling; creating a fake public URL or changing newsroom-like content in production would add unnecessary risk.

## S. Permission-aware UI smoke

**PASS.** Automated server authorization and J4B-5 matrix evidence passed. Owner-controlled smoke confirmed metadata visibility matched effective permission, `phong_vien`/`nhan_vien` had no publication controls, department-scoped users did not gain cross-department authority, and TBT/PTBT/Admin behavior matched approved backend scope.

## T. Normal Task regression

**PASS.** `/tasks/assign` remained normal Task by default, recurrence remained available, normal Task detail showed no Journalism UI, and normal list/filter/workflow behavior remained healthy. J4B-5 focused compatibility evidence also passed.

## U. Module smoke

No broad production mutations were performed. Existing attendance, leave, schedule, online work, duty roster, evaluation, users/admin, and read-only permissions evidence remained healthy; no new 500, fatal error, or authorization regression was reported during owner smoke.

## V. Client security scan

New artifact static bundle contains no service-role secret name/value, `SESSION_SECRET`, `service_role`, direct Journalism RPC access, direct Journalism table mutation credentials, or role-string authorization shortcut.

## W. RBAC / backend unchanged

Read-only production checks:

- permissions: `19`;
- role grants: `128`;
- Journalism work kinds: `10`;
- Journalism detail rows before owner smoke: `0`; owner subsequently reported one designated test Journalism Task created through the UI (exact identifier was not included in the owner message).
- canonical grant hash remains owner-approved `1e87d9404fef719a22f8a4369d871a09df1a93bb46a7d7512c22affe245943bc`;
- `TASK_RBAC_V2_ENABLED=true`;
- no migration, schema, RPC, RLS, permission, or grant command was run.

## X. Test Task disposition

One designated internal J4 UI test Journalism Task (owner-reported title: `[J4 UI TEST] Journalism production smoke`) was created during owner smoke. It remains retained and was not deleted automatically. Owner may retain, archive, or complete it through the normal Task workflow.

## Y. Rollback readiness

Rollback is application-only and targets the preserved J3 release in section D. The pre-activation snapshot records the prior service state and drop-ins. No database rollback is required or permitted for J4C.

## Z. Final production health and status

- Active release: `/opt/releases/thoidai-work/e5f726dedd480929b6424db55fc083cd6a4afb26-j4c-20260918T134200Z`.
- Application commit: `e5f726dedd480929b6424db55fc083cd6a4afb26`.
- Service: active; `NRestarts=0`.
- `/login=200`; anonymous `/api/tasks=401`; anonymous Journalism mutation APIs `401`.
- `TASK_RBAC_V2_ENABLED=true`.
- Permissions `19`; grants `128`; canonical grant hash unchanged.
- No new 500, fatal error, or restart loop.

Owner authenticated UI smoke: **PASS**.

**J4C = CLOSED**

**JOURNALISM J4 = DONE**

J4 production activation is closed. No J5, CMS Connector, Topics/Series, KPI, AI, migration, grant, schema, RPC, or further deployment has been started.
