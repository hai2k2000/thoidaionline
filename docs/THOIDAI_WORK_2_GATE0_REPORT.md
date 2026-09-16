# Thoi Dai Work 2.0 - Gate 0 Report

Date: 2026-09-16 (Asia/Bangkok)

Scope: inventory, drift comparison, live-schema observation, backup, baseline and smoke checks only. No historical migration was executed, no migration ledger was repaired, and no RBAC 2.0 or `work_kind` schema was introduced.

## A. Git/source drift report

### Isolated baseline

- Worktree: `C:\Users\hai2k\Desktop\hai2k\vscode\thoidai-work-gate0`
- Branch: `gate0-20260916`
- Base: GitHub `origin/main`, commit `fb1058b`
- Worktree state: clean at creation; Gate 0 report is the only intended artifact.
- Production checkout: `/opt/thoidai-work`, branch `main`, HEAD `8702827389e7e2452681c9e88c8d8ea899856a4c`.

### Production modified files

`PROJECT_STATUS.md`; `deploy/systemd/thoidai-work.service`; all six `src/app/api/attendance/sync/*` routes; `src/app/api/work-schedule/route.ts`; `src/app/attendance/page.tsx`; `src/app/work-schedule/staff/page.tsx`; `src/components/AppNav.tsx`; `src/components/WorkScheduleAdminShell.tsx`; `src/components/WorkSchedulePageShell.tsx`; `src/components/phase2Navigation.ts`; `src/lib/attendanceBridgeAuth.ts`; `src/lib/workScheduleRepository.ts`.

All attendance sync routes, work-schedule route/pages/shells, navigation policy, and bridge-auth file match the clean local `main` content after normalization. The remaining semantic source drift is:

- `deploy/systemd/thoidai-work.service`: production hardening is real and should be brought back to Git after review. It runs as `thoidai-work`, binds the app to localhost, adds systemd sandboxing and explicit writable paths.
- `src/components/AppNav.tsx`: production UI/navigation revision differs materially (286 added/286 removed lines); manual review and targeted tests are required before commit.
- `src/lib/workScheduleRepository.ts`: production adds date-range/plan-type support and creator-scoped update/delete. This is a business change and must be committed only together with its migration/API/UI contract.
- `PROJECT_STATUS.md`: production operational history differs from GitHub; retain the factual history, but do not blindly overwrite the canonical status file.

### Production untracked files

- `.next.before-20260915T083000Z/` (494 MB): runtime build rollback artifact; do not commit.
- `docs/THOIDAI_SYSTEM_REVIEW.md` (24 KB): review artifact; commit only if accepted as maintained documentation.
- `src/lib/attendanceBridgeSignature.ts` (4 KB): likely source change for HMAC/replay protection; review and commit with its callers/tests if retained.
- `src/lib/leaveApprovalRange.test.mjs` (4 KB): test artifact; commit if it is part of the supported test suite.
- `supabase/migrations/20260915120000_personal_work_plans.sql`: historical migration file for live schema; preserve in Git, but do not register it until fully reconciled.

### Systemd and runtime

Service is active/running (`MainPID=552851`) with `npm run start -- --hostname 127.0.0.1 --port 3001`. No production source was changed in Gate 0.

## B. Migration drift matrix (15 missing ledger entries)

Live ledger ends at `20260901095000`. Classification is based on object/data evidence; no migration was replayed.

| Migration | Classification | Evidence / gap |
|---|---|---|
| `20260909110000_attendance_sync.sql` | APPLIED | `attendance_code` plus three attendance tables, unique/queue/date indexes, RLS and service-role ACLs exist; 24 codes mapped. |
| `20260909121500_seed_online_work_september.sql` | PARTIALLY_APPLIED | The target RPC/table path exists and 72 September rows (24 active, 48 cancelled) are present, but the exact six-person seed payload and final status cannot be proven from current state after later weekend cancellation. |
| `20260909143000_allow_hongninh_duty_editor.sql` | PARTIALLY_APPLIED | Duty editor function/index behavior is present, but later three-position migration superseded the function and the embedded seed cannot be attributed independently. Do not ledger-repair without historical evidence. |
| `20260909170000_three_position_duty_roster.sql` | APPLIED | Live duty positions are exactly `Xuất bản`, `Biên tập`, `Phóng viên`; active duty tasks cover 30 dates and cancelled legacy rows remain auditable. |
| `20260910090000_leave_requests.sql` | APPLIED | `leave_requests`, date/requester indexes, RLS, service-role ACLs, create/review/cancel RPCs and audit path exist. |
| `20260910150000_long_leave_tbt_approval.sql` | APPLIED | Live `api_review_leave_request` requires Tổng Biên Tập for requests of 3+ days. |
| `20260911083000_fix_first_login_default_password.sql` | PARTIALLY_APPLIED | Password trigger is present, but the one-time repair target set cannot be reconstructed from current state; audit action count for this exact repair is 0. |
| `20260911110000_enable_deputy_department_assignment.sql` | APPLIED | `pho_truong_phong` has a role-permission row with assignment and department-view flags enabled. |
| `20260911133000_scope_leave_review_to_department.sql` | APPLIED | Live review RPC contains same-department manager/deputy scope and TBT override. |
| `20260911150000_lock_task_completion_scores.sql` | APPLIED | RLS enabled and `anon`/`authenticated` revoked; service-role access remains. PostgreSQL owner ACLs are expected and are not public exposure. |
| `20260911170000_atomic_attendance_completion.sql` | APPLIED | Status check includes `completing`; active-request unique index covers pending/running/completing. |
| `20260911180000_align_deputy_assignment_reviewer.sql` | APPLIED | Live `api_assign_task_v2` has the aligned assignee/reviewer scope and service-role-only execute ACL. |
| `20260911190000_enforce_first_login_password_change.sql` | PARTIALLY_APPLIED | `must_change_password`, trigger and password RPCs exist; exact historical update set is not provable from current rows alone. |
| `20260911230000_atomic_attendance_log_merge.sql` | APPLIED | Live merge RPC is present with service-role-only execute ACL. |
| `20260915120000_personal_work_plans.sql` | APPLIED | `work_schedules.end_date`, `plan_type`, range/type constraints and range index exist. Ledger is still missing. |

No migration in this set is safe to replay automatically because seed/one-time assumptions and later superseding changes are present. `PARTIALLY_APPLIED` items require new reconciliation migrations, never edits to historical files.

## C. Schema live baseline

- PostgreSQL 17.6; database container `supabase_db_thoidai-work`.
- No `tasks.work_kind` column exists; all current tasks have non-null legacy `task_type`.
- No Topic-to-Task migration was introduced; future design remains `tasks.topic_id` only.
- Core RLS tables are enabled, with no direct `anon`/`authenticated` table grants observed for inspected sensitive tables.
- Service-role functions bypass RLS; API/RPC authorization remains mandatory.
- Concern for later hardening: `audit_direct_assignment_start()` still has PUBLIC/anon/authenticated execute grants.
- `online_work_schedules` contains 24 active September rows (72 total including cancelled history). `work_schedules` contains 4 legacy rows, no September `plan_type='work'` rows.

## D. Backup verification

Backup directory: `/opt/thoidai-work-backups/gate0-20260916T020734Z/`

- `postgres-full.custom`: 857,453 bytes
- `postgres-schema.sql`: 558,739 bytes
- `migration-ledger.txt`: 1,440 bytes
- `source-snapshot.tgz`: 834,097,012 bytes
- `metadata.txt`: commit, status, service and build identifier captured.
- `SHA256SUMS`: generated and verified. Key hashes: full `ee830798...38cbfe`; schema `ade42406...c5549a`; ledger `f07726d4...817c9d`; source `448ada7e...4b9e05`.

The dumps and snapshot are non-empty and checksum-stable. No existing backup was deleted or modified.

## E. Test/build baseline

Executed in the isolated worktree after dependency installation:

- `node --test`: exit 1; multiple pre-existing contract/UI failures. Relevant passing coverage includes attendance bridge signing/windows/deduplication, leave range logic, schedule range validation, and many authorization tests. No code was changed to hide failures.
- `npx tsc --noEmit`: exit 0.
- `npx eslint .`: exit 1; 25 errors and 30 warnings, mainly existing `no-explicit-any` and React effect/state rules.
- `npm run build`: exit 1 during page-data collection because production Supabase environment variables are intentionally absent in the clean worktree; compilation itself succeeds. Dynamic filesystem tracing warnings also appear for HR upload routes.
- `npm ci` cannot be used because the repository lockfile is out of sync with `package.json`; dependencies were installed with `npm install --no-package-lock --ignore-scripts` only in the isolated worktree.

## F. Smoke test result

Unauthenticated production probes:

- `/login`: HTTP 200.
- `/api/work-schedule`, `/api/tasks`, `/api/attendance`, `/api/leave-requests`, `/api/duty-schedule`, `/api/online-work`: HTTP 401.

Authenticated browser workflows (login, assignment, task management, completion, return, scoring, attendance, Wise Eye, leave, business trip, duty, online schedule, personal plans): NOT EXECUTED in Gate 0 because no credentials/session were exposed or stored. Existing automated tests cover many of these contracts, but they are not a substitute for an authenticated production smoke run.

## G. Record-count baseline

`staff_users` 31; `roles` 13; `departments` 8; `role_permissions` 13; `tasks` 253; active duty tasks 183; cancelled duty tasks 60; `task_assignees` 276; `task_status_events` 68; `task_recurrence_rules` 1; `task_recurrence_occurrences` 0; `audit_logs` 701; `performance_reviews` 177; `leave_requests` 4 (all approved); `attendance_punches` 51; `attendance_sync_requests` 14; `attendance_logs` 44; `task_completion_scores` 0; `online_work_schedules` 72 total/24 active September; `work_schedules` 4.

Task statuses: cancelled 60, done 2, in_progress 2, new 184, pending_review 5.

## H. Open risks

- Production source drift is not yet merged back to Git; AppNav and work-schedule repository need manual review.
- Fifteen migration versions are absent from the ledger; four are not safe to repair by blind insertion (two seed/one-time data migrations and one superseded function migration).
- Service-role authorization is security-critical because RLS is bypassed.
- Public execute grant on `audit_direct_assignment_start()` needs a separate least-privilege change.
- Audit trail lacks login success/failure/logout and request metadata; append-only DB privileges are not strict.
- Clean build needs a controlled non-secret environment or CI configuration.
- Existing test and lint failures must be triaged before Phase 1A.
- Production service is non-root, but the deployment/release workflow still needs an atomic release design.

## I. Exact migration-ledger repair proposal

Do not update `supabase_migrations.schema_migrations` now. First create a review table/report containing migration filename, SQL hash, object checks, data checks, verifier, timestamp and evidence. Proposed later action:

1. Register only migrations classified APPLIED after a second independent verification and SQL-hash match.
2. For each PARTIALLY_APPLIED migration, write a new forward-only reconciliation migration that checks current state and changes only missing objects/data; then register both the reconciliation migration and the original only if historical application is proven.
3. Keep `20260909121500_seed_online_work_september.sql` unregistered unless the exact seed is intentionally re-created as a new idempotent data migration.
4. Keep one-time password repair migrations unregistered unless audit evidence proves the target set and outcome.
5. Never run or edit an old migration to repair drift.

## J. Phase 1A readiness

**Not safe to start Phase 1A yet.** Gate 0 has completed the inventory and backup portions, but source drift, migration ledger ambiguity, failing baseline tests/lint, and lack of authenticated production smoke evidence remain. Phase 1A should begin only after the user approves this report and explicitly accepts a remediation order, starting with source reconciliation and ledger evidence—not RBAC schema changes.
