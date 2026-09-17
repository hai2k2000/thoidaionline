# ORG/RBAC R1 Reconciliation Dry-Run Report

**Checkpoint:** R1 - dry run only  
**Evidence date:** 2026-09-17 (Asia/Bangkok)  
**Production inspected:** `103.216.118.49`  
**Audit branch:** `org-rbac-reconciliation-audit`  
**R0 report commit:** `b8143245df7eefbd35410eb3550a2b9ba0373c5b`

No database write, grant change, user/department/role update, migration, source deployment, service restart, or Journalism J2 work was performed.

## Executive result

- Current organization data already matches the owner-approved target structure.
- Users requiring a role or department change: **0**.
- Department rows requiring an active-state change: **0**.
- Role rows requiring an active-state change: **0**.
- Phase 1A permission catalog: **17**, matching the approved baseline.
- Phase 1A role-permission grants: **116**, matching the approved post-Checkpoint-2 baseline exactly; missing **0**, extra **0**.
- The earlier R0 report statement of 64 grants was a report/counting error, not live grant drift. It must not be used as a migration target.
- Eight historical tasks have `department_id = NULL`; none can be safely auto-inferred under the approved policy.
- R1 recommendation: proceed only to an owner-reviewed narrow code/label checkpoint. No broad data reconciliation is needed.

## A. Exact current to target department diff

| Code | Current name | Current active | Target active | Target classification | Data action | Selector target |
|---|---|---:|---:|---|---|---|
| `general` | Phòng Tổng hợp | yes | yes | ordinary department | none | selectable |
| `truyenthong` | Phòng Truyền thông | yes | yes | ordinary department | none | selectable |
| `editorial` | Phòng Nội dung | yes | yes | ordinary department | none | selectable |
| `leadership` | Ban Biên tập | yes | yes | organization-level leadership unit | none | selectable only where leadership is a valid business target |
| `operations` | Phòng Trị sự | no | no | historical/compatibility | preserve immutable ID/code/name | non-selectable for new assignments |
| `admin` | Phòng Trị sự | no | no | historical/compatibility | preserve immutable ID/code/name | non-selectable for new assignments |
| `content` | Phòng Phóng viên | no | no | historical/compatibility | preserve immutable ID/code/name | non-selectable for new assignments |
| `reporter` | Phòng Phóng viên | no | no | historical/compatibility | preserve immutable ID/code/name | non-selectable for new assignments |

Exact row diff: **0 inserts, 0 updates, 0 deletes**.

The two `Phòng Trị sự` rows and two `Phòng Phóng viên` rows must remain distinct. Display name is not a valid reconciliation key.

## B. Exact current to target role diff

| Role code | Current active | Target active | Target class | Current users | Data action | Selector target |
|---|---:|---:|---|---:|---|---|
| `tong_bien_tap` | yes | yes | active management | 1 active | display-label correction proposed separately | selectable |
| `pho_tong_bien_tap` | yes | yes | active management | 1 active | none | selectable |
| `truong_phong` | yes | yes | active management | 3 active | none | selectable |
| `pho_truong_phong` | yes | yes | active management | 1 active | none | selectable |
| `nhan_vien` | yes | yes | active staff | 7 active | none | selectable |
| `phong_vien` | yes | yes | active reporter/editorial staff | 10 active, 5 inactive | none; do not collapse into `nhan_vien` | selectable |
| `admin` | yes | yes | admin/system | 3 active | none | selectable only by authorized admin workflow |
| `tbt_read_only` | no | no | legacy inactive | 0 | preserve | non-selectable for new assignment |
| `tri_su` | no | no | legacy inactive | 0 | preserve | non-selectable |
| `bien_tap_vien` | no | no | legacy inactive | 0 | preserve | non-selectable |
| `phu_trach_phong_tri_su` | no | no | legacy inactive | 0 | preserve | non-selectable |
| `phu_trach_phong_bien_tap` | no | no | legacy inactive | 0 | preserve | non-selectable |
| `phu_trach_phong_phong_vien` | no | no | legacy inactive | 0 | preserve | non-selectable |

Exact active-state diff: **0 inserts, 0 updates, 0 deletes**.

## C. Users requiring changes

Expected and observed result: **ZERO**.

- No active user has an inactive role.
- No active user belongs to an inactive department.
- No user lacks a role or department.
- Leadership users remain in `leadership` and must not be moved.
- Admin department membership remains unchanged and is treated as display/organizational metadata except where a specific code path explicitly uses it.
- Five inactive reporter accounts remain attached to active `phong_vien` and `editorial` records; preserving these links is correct historical behavior.

No user update statement should be included in a future reconciliation migration unless a later owner decision names an exact user and target.

## D. Department selectability

### Selectable for new assignment/staff placement

- `general`
- `truyenthong`
- `editorial`
- `leadership` only in workflows where leadership is a valid target

### Non-selectable but historically readable

- `operations`
- `admin` (department code, not the role)
- `content`
- `reporter`

Current task assignment, department-manager, duty, and asset paths already query active departments. The staff create UI also filters inactive departments. Direct staff mutation validation remains incomplete; see section F.

## E. Role selectability

### Selectable

- `admin`
- `tong_bien_tap`
- `pho_tong_bien_tap`
- `truong_phong`
- `pho_truong_phong`
- `nhan_vien`
- `phong_vien`

### Non-selectable but historically readable

- `tbt_read_only`
- `tri_su`
- `bien_tap_vien`
- `phu_trach_phong_tri_su`
- `phu_trach_phong_bien_tap`
- `phu_trach_phong_phong_vien`

`ROLE_LIFECYCLE_ENABLED=true` is active in the running service. With that flag, `/api/users` returns active roles for assignment and rejects assigning an inactive role. Historical compatibility roles remain visible in the read-only Permission UI by design.

## F. Exact UI/config/code places requiring changes

No code was changed in R1. The following is the proposed narrow implementation inventory.

| Location | Current behavior | Required narrow change |
|---|---|---|
| `src/app/api/users/route.ts` GET | Roles are active-filtered when role lifecycle is enabled; departments are returned active and inactive | Keep full department data for historical display; expose or derive a separate active selectable list. Preserve an assigned inactive role/department in historical edit display if one exists. |
| `src/app/api/users/route.ts` POST/PATCH | Inactive role assignment is server-validated; job title is validated; `department_id` is accepted without verifying existence/active state | On create and when changing department, require an existing active department. Permit an unchanged inactive historical department only for viewing/preservation, not as a new target. |
| `src/app/users/page.tsx` create form | Filters departments by `active`; uses roles returned by API | Retain. Add explicit code-based labeling if duplicate names must be distinguishable. |
| `src/app/users/page.tsx` edit form | Filters inactive departments out entirely | Include the user's current inactive department as disabled/historical if encountered; otherwise show only active departments. Do the same preservation pattern for an assigned inactive role. |
| `src/lib/taskAssignmentRepository.ts` | Uses active departments and active staff; validates target department as active | Retain. Add characterization asserting inactive department IDs cannot be submitted directly. |
| `src/lib/departmentManagerRepository.ts` | Lists active departments and active staff | Retain; characterize `leadership` separately from three ordinary departments where relevant. |
| `src/lib/dutyTaskRepository.ts` | Uses active departments and excludes `general`; reporter/manager behavior is job-title/role dependent | Review only; no automatic change. Confirm whether `leadership` belongs in duty department options before modifying. |
| `src/app/api/assets/route.ts` | Uses active departments for assignment options | Retain. |
| `src/lib/departmentRepository.ts`, `src/app/departments/page.tsx` | Admin inventory intentionally includes active/inactive rows | Retain historical visibility. Do not filter the management inventory to active-only. |
| `src/app/api/permissions/route.ts`, `/permissions` | Shows active and inactive roles and their current grants | Retain read-only compatibility visibility. |
| `src/lib/auth.tsx`, `src/lib/authorization.ts`, leave/evaluation/work-schedule/duty policies | Contains active and compatibility role-code checks | Do not remove compatibility checks in the reconciliation label/selector checkpoint. Later removal needs separate characterization and approval. |
| `roles.name` for `tong_bien_tap` | Misleading live label: `Tổng biên tập (chỉ xem công việc và nhân sự)` | Later controlled data migration should update only the display name to `Tổng biên tập`; role code, grants, users, IDs, and workflow behavior remain unchanged. |

No Next.js configuration, RBAC enforcement logic, RPC, or grant change is required for the narrow reconciliation.

## G. Phase 1A grant baseline reconciliation

### Authoritative baseline history

- Checkpoint 1 migration `20260916100000_phase1a_rbac_core.sql` seeded 17 permissions and **68 initial grants**.
- Checkpoint 2 migration `20260916104500_phase1a_rbac_compatibility_completion.sql` completed self-service and compatibility rows.
- The approved Checkpoint 2 report explicitly records **17 permissions and 116 compatibility grants**.
- Expected unique union from both reviewed migration files: **116**.
- Current live rows: **116**.
- Exact tuple comparison `(role_code, permission_code, scope)`: missing **0**, extra **0**.

### Count reconciliation

| Measurement | Count |
|---|---:|
| Permission catalog | 17 |
| Initial Checkpoint 1 grants | 68 |
| Final expected unique grants after compatibility completion | 116 |
| Live grants | 116 |
| Grants on active roles | 66 |
| Grants on inactive compatibility roles | 50 |
| Missing versus approved final baseline | 0 |
| Extra versus approved final baseline | 0 |

The earlier R0 audit report's value **64** is incorrect. It is not caused by active-only filtering (which produces 66), inactive-only filtering (50), duplicate consolidation (116 unique after consolidation), or an actual grant change. It was a report-generation/counting mistake. No database correction is required.

Evidence fingerprints:

- Live sorted grant tuple SHA-256: `292d1d5863fe0e3bff05d4a37ce2bd7915eb0656a011a053e67912bfb57af0a6`
- Live permission catalog SHA-256: `4796158c17a1f11f1e72c8388eb985d35ee144d4d1611dae7a2e4d884a525512`
- Core migration SHA-256: `3c355d2fdbb4c23ca7d79817f9b3c0e7a3b9e367ccf13070841bba19ba203034`
- Compatibility migration SHA-256: `3ffe5a1ec6ca306443ceb69e2478e8aeb379ef45f05c0ca041c5a13c8542a17e`

### Exact per-role/per-permission/per-scope baseline

Each listed tuple is both expected and live. Therefore every role has `missing = 0` and `extra = 0`.

- `admin` (14): `attendance.view_all:all`, `attendance.view_self:self`, `evaluation.rubric.manage:all`, `leave.view_self:self`, `permission.manage:all`, `schedule.view_self:self`, `staff.manage:all`, `staff.view:all`, `task.assign:all`, `task.comment:all`, `task.create:all`, `task.edit_all:all`, `task.evaluate.step1:all`, `task.view:all`.
- `tong_bien_tap` (9): `attendance.view_self:self`, `leave.view_self:self`, `schedule.view_self:self`, `staff.view:all`, `task.assign:all`, `task.comment:all`, `task.create:all`, `task.evaluate.step2:all`, `task.view:all`.
- `pho_tong_bien_tap` (9): `attendance.view_self:self`, `leave.view_self:self`, `schedule.view_self:self`, `task.assign:all`, `task.comment:assigned`, `task.comment:department`, `task.create:all`, `task.view:assigned`, `task.view:department`.
- `truong_phong` (9): `attendance.view_self:self`, `leave.view_self:self`, `schedule.view_self:self`, `task.assign:department`, `task.comment:assigned`, `task.comment:department`, `task.create:all`, `task.view:assigned`, `task.view:department`.
- `pho_truong_phong` (9): same tuple set as `truong_phong`.
- `phong_vien` (8): `attendance.view_self:self`, `leave.view_self:self`, `schedule.view_self:self`, `task.comment:assigned`, `task.comment:self`, `task.create:all`, `task.view:assigned`, `task.view:self`.
- `nhan_vien` (8): same tuple set as `phong_vien`.
- `tbt_read_only` (5): `attendance.view_self:self`, `leave.view_self:self`, `schedule.view_self:self`, `staff.view:all`, `task.view:all`.
- `bien_tap_vien` (9): `attendance.view_self:self`, `leave.view_self:self`, `schedule.view_self:self`, `task.comment:assigned`, `task.comment:self`, `task.create:all`, `task.edit_all:all`, `task.view:assigned`, `task.view:self`.
- `tri_su` (9): same tuple set as `bien_tap_vien`.
- `phu_trach_phong_tri_su` (9): `attendance.view_self:self`, `leave.view_self:self`, `schedule.view_self:self`, `task.assign:department`, `task.comment:assigned`, `task.comment:department`, `task.evaluate.step1:department`, `task.view:assigned`, `task.view:department`.
- `phu_trach_phong_bien_tap` (9): same tuple set as `phu_trach_phong_tri_su`.
- `phu_trach_phong_phong_vien` (9): same tuple set as `phu_trach_phong_tri_su`.

`task.review` and `task.score` exist in the 17-permission catalog but intentionally have no static grants. Workflow/reviewer/RPC guards remain authoritative.

## H. `tong_bien_tap` display-label correction proposal

Current label: `Tổng biên tập (chỉ xem công việc và nhân sự)`  
Proposed canonical label: `Tổng biên tập`

Reason: the current effective baseline includes organization task view, task create, task assignment, comments, step-2 evaluation, staff view, and self-service permissions. The current label incorrectly implies read-only authority and can mislead administrators.

Proposed future change is one narrow `roles.name` update selected by immutable code `tong_bien_tap`. It must not change `roles.code`, grants, role level, user assignment, workflow guards, or session authorization.

Other active role display labels are materially consistent with their current role meaning. No broad relabeling is proposed.

## I. Inventory of eight null-department tasks

All eight rows were created on `2026-08-26T06:23:13.416799Z`; all are `task_type=assigned`, `task_category=regular`; creator, owner, and reviewer are `quangthien` (Lê Quang Thiện, leadership). A current assignee department is only a candidate hint and is not historical proof of intended task department.

| Task ID | Title | Type/category | Creator / owner | Assignee | Status | Creation time | Candidate by current assignee | Safe inference? |
|---|---|---|---|---|---|---|---|---|
| `3d5ac5e5-81de-49b9-ae6b-0ff9d5754dcf` | Rà soát quy trình duyệt tin điện tử | assigned / regular | `quangthien` / `quangthien` | `thanhhai` | done | 2026-08-26 06:23:13Z | Phòng Tổng hợp | no |
| `9e8485f3-74a2-48f4-9373-c11f3a8c42fd` | Kiểm tra chất lượng dữ liệu bảng công việc | assigned / regular | `quangthien` / `quangthien` | `quynhtrang` | done | 2026-08-26 06:23:13Z | Phòng Tổng hợp | no |
| `0de46c4a-f123-4945-972e-bea19d9248bb` | Phát triển chuyên mục Người trẻ và khởi nghiệp | assigned / regular | `quangthien` / `quangthien` | `minhduc` | in_progress | 2026-08-26 06:23:13Z | Phòng Nội dung | no |
| `30ae3a62-9dfb-4293-bd69-d78f6c14dafe` | Tổ chức sản xuất eMagazine chuyên đề | assigned / regular | `quangthien` / `quangthien` | `xuanhoa` | pending_review | 2026-08-26 06:23:13Z | Phòng Nội dung | no |
| `65256845-7494-439d-9c87-e31c2f3af8ef` | Chuẩn bị nội dung cuộc họp Ban biên tập | assigned / regular | `quangthien` / `quangthien` | `ducanh` | pending_review | 2026-08-26 06:23:13Z | Phòng Nội dung | no |
| `47e151bd-008d-4083-9a1d-b8fc7bf25005` | Xây dựng kế hoạch nội dung quý IV/2026 | assigned / regular | `quangthien` / `quangthien` | `admin` | pending_review | 2026-08-26 06:23:13Z | Phòng Tổng hợp (admin metadata) | no |
| `668a732a-71f3-438b-b4a3-9f9d801983c3` | Thực hiện tuyến bài chuyển đổi số trong báo chí | assigned / regular | `quangthien` / `quangthien` | `ngocanh` | pending_review | 2026-08-26 06:23:13Z | Phòng Nội dung | no |
| `791428e9-99ae-4521-b91f-e41240137bd6` | Đề xuất kế hoạch đào tạo kỹ năng số cho phóng viên | assigned / regular | `quangthien` / `quangthien` | `vanmanh` | pending_review | 2026-08-26 06:23:13Z | Phòng Nội dung | no |

Reasons inference is unsafe:

- The creator/owner/reviewer is organization-level leadership while assignees span departments.
- Current user department is mutable and does not prove the intended department at task creation time.
- One assignee is an admin whose department is approved as display metadata.
- Task relationship authorization already handles these records without requiring department scope.

R1 action: preserve all eight rows unchanged. Future normalization, if required, must be an owner-reviewed per-task decision.

## J. Historical-data impact

The R0 target requires no rewrite of historical tasks, users, departments, roles, attendance, leave, schedules, evaluations, or audit events. Inactive departments and roles remain readable by ID/code. Null-department tasks retain their current relationship-based authorization behavior; assigning a guessed department could incorrectly introduce department-wide visibility and is therefore a security-sensitive change.

## K. Proposed narrow migration/code changes

No implementation is authorized by R1. If owner approves the next checkpoint, use two narrowly separated changes:

1. **Selector and server validation code:** prevent direct API assignment of inactive/nonexistent departments; preserve historical display of an unchanged inactive department/role; add duplicate-name code labels where needed.
2. **Display-label migration:** update only `roles.name` where `code='tong_bien_tap'` from the misleading label to `Tổng biên tập`, with a guarded precondition and reversible old value.

Not proposed:

- department/role inserts or deletes;
- user remapping;
- null-task backfill;
- grant changes;
- authorization/RPC changes;
- compatibility-role removal;
- Journalism schema or UI.

## L. Rollback plan

- Code checkpoint: release from a clean worktree and retain the current production release as atomic rollback target. Revert only selector/server validation files if smoke fails.
- Label checkpoint: record the exact pre-change role row and update only by immutable role code. Rollback restores the exact previous display name; no role/grant/user row is otherwise touched.
- Before any write: database backup, source/release metadata, exact row counts, grant tuple hash, current service/release/flag state, and tested rollback commands.
- After any write: recheck 17 permissions, 116 exact grants, user/department/role counts, no new inactive assignment, service health, and authenticated role smoke.
- Never use `supabase db push` or `supabase db reset`; do not replay unresolved migrations.

## M. Tests required before R2/R3

- Server rejects creating a user with inactive/nonexistent department.
- Server rejects changing a user to inactive/nonexistent department.
- Unchanged historical inactive department/role remains readable and is not silently remapped.
- Create/edit selectors show only active targets, except current historical value shown as inactive/disabled.
- Duplicate display names are distinguishable by canonical code where needed.
- Leadership unit remains separate from the three ordinary departments.
- `nhan_vien` and `phong_vien` remain distinct and keep their existing authorization/duty/online-work behavior.
- Exact RBAC tuple test: 17 permissions, 116 grants, missing 0, extra 0.
- `tong_bien_tap` label change does not alter code, grants, sessions, or authorization.
- Null-department task characterization: all eight remain visible/mutable only through existing relationship/workflow rules; department scope does not match null.
- Regression: Phase 1A RBAC/task critical suite; leave; attendance; work schedule; online work; duty roster; evaluation; admin user/department screens.
- TypeScript, changed-file ESLint, `git diff --check`, production-safe Webpack build, and authenticated role smoke.

## R1 disposition

**R1 DRY RUN: GO FOR OWNER REVIEW.**

There is no unexpected RBAC grant difference. The exact live final baseline is 17 permissions and 116 grants. No reconciliation implementation, production change, or Journalism J2 work has started.

