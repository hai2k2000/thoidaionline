# Phase 1A – Checkpoint 1 Report

Date: 2026-09-16
Branch: `phase1a-checkpoint1`
Baseline: `d8cc779` (same as `origin/main` before this checkpoint)
Scope: RBAC Core Schema only

## A. Permission catalog thực tế

Migration `supabase/migrations/20260916100000_phase1a_rbac_core.sql` adds 17 catalog entries:

- Task: `task.view`, `task.create`, `task.assign`, `task.comment`, `task.edit_all`, `task.review`, `task.score`, `task.evaluate.step1`, `task.evaluate.step2`.
- Staff: `staff.view`, `staff.manage`.
- Permission/evaluation: `permission.manage`, `evaluation.rubric.manage`.
- Attendance/leave/schedule: `attendance.view_self`, `attendance.view_all`, `leave.view_self`, `schedule.view_self`.

Catalog entries are based on live `role_permissions`, `src/lib/authorization.ts`, server routes, RPC definitions, and existing characterization tests. No `work_kind`, journalism, topic, or speculative module permission was added.

## B–C. Role → permission → scope mapping and evidence

Scopes use lowercase consistently: `self`, `assigned`, `department`, `all`.

| Roles | Permission | Scope | Evidence | Mapping reason |
|---|---|---|---|---|
| `admin` | `staff.view`, `staff.manage`, `permission.manage` | `all` | live flags; `/api/users`; `/api/permissions`; admin handlers | Admin manages and views organization staff/roles. |
| `admin` | `task.view`, `task.create`, `task.assign`, `task.comment`, `task.edit_all`, `task.evaluate.step1`, `evaluation.rubric.manage` | `all` | live flags; `canTaskAction`; `canAssignToDepartment`; evaluation helper/RPC | Matches current admin-wide task and rubric behavior. |
| `admin` | `attendance.view_self`, `attendance.view_all` | `self`, `all` | `/api/attendance` admin organization guard | Personal and organization attendance are both available. |
| `admin` | `leave.view_self`, `schedule.view_self` | `self` | leave and work-schedule routes | Self-service views remain available. |
| `tong_bien_tap` | `staff.view` | `all` | `/api/users` allowlist | Organization staff view. |
| `tong_bien_tap` | `task.view`, `task.create`, `task.assign`, `task.comment`, `task.evaluate.step2` | `all` | `ORGANIZATION_VIEW_ROLES`; role exception in assignment; live flags; evaluation RPC | Preserves leadership organization task behavior. |
| `tong_bien_tap` | `leave.view_self`, `schedule.view_self` | `self` | authenticated self-service routes | Self-service views. |
| `tbt_read_only` | `staff.view`, `task.view` | `all` | `/api/users` allowlist; `ORGANIZATION_VIEW_ROLES`; read-only guard | View-only organization access. Role is inactive in live data but mapping is retained for compatibility. |
| `tbt_read_only` | `leave.view_self`, `schedule.view_self` | `self` | authenticated self-service routes | No mutation permission is implied. |
| `pho_tong_bien_tap` | `task.view` | `assigned`, `department` | live `can_view_department_tasks`; `canTaskAction` | Related and department task visibility. |
| `pho_tong_bien_tap` | `task.create`, `task.assign` | `all` | live `can_create_task`, `can_assign_task`; leadership assignment policy | Existing leadership assignment behavior. |
| `pho_tong_bien_tap` | `task.comment` | `assigned`, `department` | live `can_comment`; `canTaskAction` | Comment only on visible related/department tasks. |
| `pho_tong_bien_tap` | `leave.view_self`, `schedule.view_self` | `self` | authenticated self-service routes | Self-service views. |
| `pho_truong_phong` | `task.view` | `assigned`, `department` | live flags; `canTaskAction` | Related and own department task visibility. |
| `pho_truong_phong` | `task.create` | `all` | live `can_create_task` | Existing create behavior. |
| `pho_truong_phong` | `task.assign` | `department` | live `can_assign_task`; `canAssignToDepartment` | Assignment is department-scoped. |
| `pho_truong_phong` | `task.comment` | `assigned`, `department` | live `can_comment`; `canTaskAction` | Visible task comments. |
| `pho_truong_phong` | `leave.view_self`, `schedule.view_self` | `self` | authenticated self-service routes | Self-service views. |
| `truong_phong` | `task.view` | `assigned`, `department` | live flags; `canTaskAction` | Related and own department task visibility. |
| `truong_phong` | `task.create` | `all` | live `can_create_task` | Existing create behavior. |
| `truong_phong` | `task.assign` | `department` | live `can_assign_task`; `canAssignToDepartment` | Assignment is department-scoped. |
| `truong_phong` | `task.comment` | `assigned`, `department` | live `can_comment`; `canTaskAction` | Visible task comments. |
| `truong_phong` | `leave.view_self`, `schedule.view_self` | `self` | authenticated self-service routes | Self-service views. |
| `phong_vien`, `nhan_vien` | `task.view` | `self`, `assigned` | `canTaskAction` relation checks | Own/assigned/related task access only. |
| `phong_vien`, `nhan_vien` | `task.create` | `all` | live `can_create_task=true` | Preserves current create behavior. |
| `phong_vien`, `nhan_vien` | `task.comment` | `self`, `assigned` | live `can_comment`; `canTaskAction` | Comments require visible related task. |
| `phong_vien`, `nhan_vien` | `leave.view_self`, `schedule.view_self` | `self` | authenticated self-service routes | Self-service views. |
| `bien_tap_vien`, `tri_su` (inactive) | `task.create`, `task.edit_all` | `all` | live compatibility rows | Retained only to reflect existing role rows; no active users currently use these roles. |

## J. NEEDS_REVIEW mappings (not seeded as grants)

The following have workflow/resource-dependent rules that cannot be represented safely as a static role/scope grant in this checkpoint:

- `task.submit`, `task.return`, `task.approve`, `task.score`, `task.reopen`, `task.cancel`.
- `task.update`, `task.attachment`, and fine-grained review/score authority.
- `leave.review_department`, `leave.review_all`.
- `attendance.view_department`, `schedule.view_department`, `schedule.view_all`.

They remain governed solely by the existing server helpers/RPCs. Catalog labels for `task.review` and `task.score` exist for future shadow-mode work, but no new grant changes current authorization.

## D. Schema/migration

- Added `public.permissions` with unique non-empty code and module constraints.
- Added `public.role_permission_grants` with foreign keys, lowercase scope check, and unique `(role_id, permission_id, scope)`.
- Added permission and role/scope indexes.
- Enabled RLS on both tables.
- Kept `public.role_permissions` unchanged.

## E. Backup/checksum

Backup directory: `/opt/thoidai-work/backups/phase1a-checkpoint1-20260916T043151Z`

- `database.dump` custom format: 857,641 bytes.
- `schema.sql`: 558,739 bytes.
- `migration-ledger.txt`: 107 rows.
- `source-snapshot.tgz`: 387,448,832 bytes; `.env*`, `.next`, `node_modules`, backups, and dumps excluded.
- SHA-256 manifest generated and verified on VPS.
- Source commit captured: `8702827389e7e2452681c9e88c8d8ea899856a4c`.

No secrets, cookies, tokens, passwords, or environment values were included in the report.

## F. Migration execution

- Applied explicit/per-file: `20260916100000_phase1a_rbac_core.sql`.
- Result: `CREATE TABLE` x2, indexes x2, RLS x2, ACL revoke/grant, 17 permission rows, 68 grant rows, `COMMIT`.
- Ledger row recorded as `20260916100000 | phase1a_rbac_core`.
- Legacy unresolved migrations were not replayed, edited, or marked applied.

## G. ACL/RLS verification

Verification SQL passed:

- Both tables exist and have RLS enabled.
- Scope and uniqueness constraints exist.
- Required indexes exist.
- `anon` and `authenticated` have no table `SELECT` privilege.
- Only `service_role` received table DML grants; no browser policy was added.

## H. Seed verification

- `permissions`: 17 rows.
- `role_permission_grants`: 68 rows.
- `role_permissions`: unchanged at 13 rows.
- `roles`: 13 rows; active staff: 26 rows.

## I. Test/build result

- RBAC core contract tests: PASS (2/2).
- Targeted authorization/attendance/leave/task tests: PASS (20/20).
- `npx tsc --noEmit`: PASS.
- Lint changed test file: PASS.
- `npm run build`: PASS with existing non-blocking Turbopack warnings for dynamic HR upload filesystem tracing.
- Production service after migration: `active`.

## K. Rollback path

No application code or legacy authorization was changed. If rollback is required, stop application writes, restore the pre-migration database custom dump, and remove only the checkpoint ledger row and the two additive tables in a reviewed recovery procedure. Do not replay historical migrations or use `supabase db reset`/`supabase db push`.

## L. Checkpoint 2 decision

**GO for owner review of Checkpoint 2; implementation status: STOPPED at Checkpoint 1 as required.**

Checkpoint 2 (TypeScript/DB authorization helpers and shadow mode) has not started. Owner approval is required before any further RBAC implementation.
