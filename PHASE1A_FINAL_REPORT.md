# PHASE 1A FINAL REPORT - PERMISSION UI READ-ONLY

Date: 2026-09-17
Branch: `phase1a-permission-ui-readonly`
Deployed source commit: `226f7749bc9b2260f148e8d65665a0871a092d5b`
Final branch/report commit: see pushed branch `phase1a-permission-ui-readonly`
Approved source baseline: `77ad72d443bc58c964a890ecd0fe2f391e473738`

## Scope

- Replaced the legacy mutation-heavy `/permissions` screen with one read-only RBAC matrix.
- Source of truth is `roles`, `permissions`, and `role_permission_grants`.
- Hierarchy is ROLE -> MODULE -> PERMISSION -> SCOPE.
- Active and inactive/compatibility roles remain visible, including empty-grant roles.
- No RBAC schema, grant, RPC, migration, task authorization, or production checkout changes.
- Permission editing remains backlog.

## Authorization

- Server page gate and API gate both derive the actor from the authenticated server session.
- Access requires explicit RBAC `permission.manage`; legacy `role_code === "admin"` inference is not used.
- Live verification: `admin | permission.manage | all` exists.
- Client-supplied actor, role, permission, and scope values are not trusted.

## API Safety

- `GET /api/permissions` returns only role metadata and matrix data needed by the UI.
- `POST`, `PUT`, `PATCH`, and `DELETE` return explicit HTTP `405` read-only responses.
- Existing production caller inventory was limited to the legacy `/permissions` page and route; the page no longer calls mutation methods.

## Verification

- Permission UI contract tests: `7/7` PASS.
- RBAC/checkpoint/task authorization suite: `52/52` PASS.
- Full repository test comparison: `0` branch-only failures; `33` pre-existing baseline failures are also present on approved commit `77ad72d...` and were not introduced by this branch.
- TypeScript: PASS (`npx tsc --noEmit`).
- Changed-file ESLint: PASS.
- `git diff --check`: PASS.
- Production-safe Webpack build: PASS, exit code `0`.
- Artifact scan: `example.invalid=0`, all dummy markers `=0`, server-only secret names absent from `.next/static`.

## Release

- Active release: `/opt/releases/thoidai-work/phase1a-permission-ui-20260917T063502Z-226f774`.
- `TASK_RBAC_V2_ENABLED=true`.
- Service: active/running.
- `/login`: HTTP `200`.
- Anonymous `/api/permissions`: HTTP `401`.
- Anonymous `POST /api/permissions`: HTTP `405`.
- Anonymous `/permissions` page: HTTP `307` to `/login`.
- `.next/cache`: writable.
- Recent service journal: `0` warning/error matches.
- Observed shadow mismatch counters: `SECURITY_CRITICAL_MISMATCH=0`, `RESTRICTIVE_MISMATCH=0`.

## Backup and Rollback

- Predeploy backup: `/opt/releases/thoidai-work/ops-backups/permission-ui-predeploy-20260917T061845Z`.
- DB dump SHA-256: `d9c602c0fb2e0ba086c13fe333de6efeb73ec11a0597998254b4d4a08e9d0b02`.
- Production source archive SHA-256: `a00c91f1bd453fc409bd1b1fac137f7a2e3dbefbf6a83083fe7bf56dda56c988`.
- Rollback target remains `/opt/thoidai-work` with its existing dirty state; it was not modified.

## Owner Smoke Gate

Automated activation checks are complete. Authenticated admin smoke must be performed manually by the owner in a browser:

- login and open `/permissions`;
- verify role/module/permission/scope matrix and inactive compatibility roles;
- verify unauthorized account is denied;
- verify task, attendance, leave, schedule, and admin behavior has no regression;
- review aggregate shadow counters.

No credentials, password, cookie, session, token, or synthetic session was used or recorded.

## Status

**READY FOR OWNER AUTHENTICATED SMOKE**

Do not start Journalism Tasks or permission editing until owner smoke is explicitly approved.

