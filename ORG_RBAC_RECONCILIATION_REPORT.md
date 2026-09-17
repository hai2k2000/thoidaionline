# ORG/RBAC Reconciliation Report

**Checkpoint:** audit and mapping only  
**Evidence time:** 2026-09-17 (Asia/Bangkok)  
**Production target inspected:** `103.216.118.49`  
**Application checkout inspected:** `/opt/thoidai-work`  
**Database access:** read-only service-side queries through the existing server configuration

No database, user, role, department, grant, source, service, or production state was modified. Journalism Tasks J2 remains paused.

## A. Current department inventory

Live counts: 8 department records, 4 active, 4 inactive; 26 active staff and 5 inactive staff; 253 tasks; 4 leave requests; 72 online-work schedule rows. Counts below are joined from `departments`, `staff_users`, `tasks`, `leave_requests`, and `online_work_schedules`.

| Code | Name | Active | Active staff | Inactive staff | Tasks | Role assignments | Leave refs | Online-work refs | Manager |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| `general` | Phòng Tổng hợp | yes | 8 | 0 | 0 | 8 | 0 | 0 | `duydong` |
| `truyenthong` | Phòng Truyền thông | yes | 2 | 0 | 1 | 2 | 0 | 0 | `thihung` |
| `editorial` | Phòng Nội dung | yes | 14 | 5 | 244 | 19 | 4 | 72 | `leson` |
| `leadership` | Ban Biên tập | yes | 2 | 0 | 0 | 2 | 0 | 0 | `quangthien` |
| `operations` | Phòng Trị sự | no | 0 | 0 | 0 | 0 | 0 | 0 | none |
| `admin` | Phòng Trị sự | no | 0 | 0 | 0 | 0 | 0 | 0 | none |
| `content` | Phòng Phóng viên | no | 0 | 0 | 0 | 0 | 0 | 0 | none |
| `reporter` | Phòng Phóng viên | no | 0 | 0 | 0 | 0 | 0 | 0 | none |

Observations:

- The owner-confirmed active departments are present: `general`, `truyenthong`, and `editorial`.
- `leadership` (`Ban Biên tập`) is also active and currently owns two active users; it is an organization-level leadership department, not one of the three ordinary departments.
- There are two distinct inactive records named `Phòng Trị sự` (`operations` and `admin`) and two distinct inactive records named `Phòng Phóng viên` (`content` and `reporter`). Names alone are therefore unsafe reconciliation keys.
- No active or inactive staff, task, leave, or online-work rows currently reference either inactive `Phòng Trị sự` record.
- Eight tasks have `department_id = NULL`; they require explicit policy review before any future normalization.

## B. Current role inventory

Live counts: 13 role records, 8 active, 5 inactive; 26 active users and 5 inactive users. Grants are shown as the current Phase 1A RBAC grant catalog; legacy `role_permissions` remains a separate compatibility layer.

| Role | Display name | Active | Active users | Inactive users | Current Phase 1A grant summary | Selectable/assignable now |
|---|---|---:|---:|---:|---|---|
| `admin` | Quản trị viên | yes | 3 | 0 | task all; staff view/manage all; permission manage all; rubric manage all; attendance all/self; leave/schedule self | yes |
| `tong_bien_tap` | Tổng biên tập (chỉ xem công việc và nhân sự) | yes | 1 | 0 | task view/create/assign all; comment all; evaluate.step2 all; staff view all; leave/schedule self | yes |
| `pho_tong_bien_tap` | Phó tổng biên tập | yes | 1 | 0 | task view assigned+department; create all; assign all; comment assigned+department; leave/schedule self | yes |
| `truong_phong` | Trưởng phòng | yes | 3 | 0 | task view assigned+department; create all; assign/comment department+assigned; leave/schedule self | yes |
| `pho_truong_phong` | Phó trưởng phòng | yes | 1 | 0 | task view assigned+department; create all; assign/comment department; leave/schedule self | yes |
| `phong_vien` | Phóng viên | yes | 10 | 5 | task view self+assigned; create all; comment self+assigned; leave/schedule self | yes |
| `nhan_vien` | Nhân viên | yes | 7 | 0 | task view self+assigned; create all; comment self+assigned; leave/schedule self | yes |
| `tbt_read_only` | TBT - Chỉ xem Công việc và Nhân sự | no | 0 | 0 | task/staff view all; leave/schedule self; no mutation grants | no |
| `tri_su` | Nhân sự Trị sự | no | 0 | 0 | legacy-shaped task create/edit; task view self+assigned; self leave/schedule | no |
| `bien_tap_vien` | Biên tập viên | no | 0 | 0 | legacy-shaped task create/edit; task view self+assigned; self leave/schedule | no |
| `phu_trach_phong_tri_su` | Phụ trách phòng trị sự | no | 0 | 0 | task view/assign/comment/evaluate step1 department+assigned; self leave/schedule | no |
| `phu_trach_phong_bien_tap` | Phụ trách phòng biên tập | no | 0 | 0 | task view/assign/comment/evaluate step1 department+assigned; self leave/schedule | no |
| `phu_trach_phong_phong_vien` | Phụ trách phòng phóng viên | no | 0 | 0 | task view/assign/comment/evaluate step1 department+assigned; self leave/schedule | no |

The database currently has 17 permissions and 64 role-permission grant rows. The new Phase 1A permission catalog is additive; the legacy `role_permissions` table and legacy code paths remain present and must be reconciled together.

## C. Active user role/department mapping

No password, hash, session, cookie, token, or secret is included. `Task refs` is an audit aggregate across task creator/owner/assignee/reviewer and `task_assignees` rows, not a permission decision.

| User | Name | Role | Department | Active | Role active | Department active | Task refs |
|---|---|---|---|---:|---:|---:|---:|
| `ngocanh` | Đặng Ngọc Anh | `phong_vien` | Phòng Nội dung | yes | yes | yes | 2 |
| `thithuy` | Nguyễn Thị Mai Thùy | `phong_vien` | Phòng Nội dung | yes | yes | yes | 2 |
| `maianh` | Vũ Mai Anh | `admin` | Phòng Nội dung | yes | yes | yes | 53 |
| `dinhhai` | Phạm Đình Hải | `pho_tong_bien_tap` | Ban Biên tập | yes | yes | yes | 94 |
| `vanmanh` | Hoàng Văn Mạnh | `nhan_vien` | Phòng Nội dung | yes | yes | yes | 2 |
| `admin` | Admin | `admin` | Phòng Tổng hợp | yes | yes | yes | 245 |
| `xuanhoa` | Đinh Xuân Hòa | `phong_vien` | Phòng Nội dung | yes | yes | yes | 6 |
| `thuphuong` | Nguyễn Thu Phượng | `phong_vien` | Phòng Nội dung | yes | yes | yes | 0 |
| `quangthien` | Lê Quang Thiện | `tong_bien_tap` | Ban Biên tập | yes | yes | yes | 360 |
| `thily` | Phạm Thị Lý | `phong_vien` | Phòng Nội dung | yes | yes | yes | 54 |
| `thidoan` | Phan Thị Doan | `phong_vien` | Phòng Nội dung | yes | yes | yes | 51 |
| `leson` | Trần Lê Sơn | `truong_phong` | Phòng Nội dung | yes | yes | yes | 169 |
| `thihung` | Phạm Thị Hưng | `truong_phong` | Phòng Truyền thông | yes | yes | yes | 36 |
| `triduong` | Ngô Trí Đường | `phong_vien` | Phòng Nội dung | yes | yes | yes | 93 |
| `bachduong` | Nguyễn Bạch Dương | `phong_vien` | Phòng Nội dung | yes | yes | yes | 0 |
| `quynhtrang` | Hoàng Quỳnh Trang | `admin` | Phòng Tổng hợp | yes | yes | yes | 2 |
| `hongninh` | Tưởng Thị Hồng Ninh | `pho_truong_phong` | Phòng Nội dung | yes | yes | yes | 105 |
| `tungduong` | Ngô Tùng Dương | `nhan_vien` | Phòng Tổng hợp | yes | yes | yes | 0 |
| `thinhi` | Trần Thị Nhị | `phong_vien` | Phòng Nội dung | no | yes | yes | 0 |
| `thanhtung` | Trương Thanh Tùng | `phong_vien` | Phòng Nội dung | no | yes | yes | 0 |
| `quangminh` | Đặng Quang Minh | `phong_vien` | Phòng Nội dung | no | yes | yes | 0 |
| `vanlinh` | Nguyễn Văn Linh | `phong_vien` | Phòng Nội dung | no | yes | yes | 0 |
| `thanhhai` | Đoàn Thanh Hải | `nhan_vien` | Phòng Tổng hợp | yes | yes | yes | 2 |
| `hongkhanh` | Nguyễn Hồng Khánh | `nhan_vien` | Phòng Tổng hợp | yes | yes | yes | 0 |
| `thuhuong` | Phạm Thị Thu Hương | `nhan_vien` | Phòng Tổng hợp | yes | yes | yes | 0 |
| `duydong` | Nguyễn Duy Đông | `truong_phong` | Phòng Tổng hợp | yes | yes | yes | 4 |
| `bichthuan` | Lê Thị Bích Thuận | `nhan_vien` | Phòng Tổng hợp | yes | yes | yes | 0 |
| `huubac` | Nguyễn Hữu Bắc | `phong_vien` | Phòng Nội dung | no | yes | yes | 0 |
| `vananh` | Trần Thị Vân Anh | `nhan_vien` | Phòng Truyền thông | yes | yes | yes | 3 |
| `ducanh` | Dương Đức Anh | `phong_vien` | Phòng Nội dung | yes | yes | yes | 2 |
| `minhduc` | Hoàng Minh Đức | `phong_vien` | Phòng Nội dung | yes | yes | yes | 2 |

Flags:

- No current user is attached to inactive `Phòng Trị sự`, an inactive role, a missing department, or a missing role.
- Five inactive users retain active roles and active departments; this is an account-status issue, not a role/department mismatch.
- Three `admin` users are distributed across `Phòng Nội dung` and `Phòng Tổng hợp`; this needs owner confirmation if admin department membership is intended to be informational only.
- There is no multi-role assignment table in the inspected model; each `staff_users` row has one `role_id`. No conflicting multi-role assignment was observed.

## D. Phòng Trị sự analysis

- Two DB records exist: `operations` and `admin`; both are inactive.
- Neither has users, tasks, leave references, or online-work schedule references in the current live counts.
- The role `tri_su` exists but is inactive and has no users. It is not currently coupled by a foreign key to either department record.
- Code still contains explicit compatibility references to `tri_su` and `phu_trach_phong_tri_su`, notably in `src/lib/auth.tsx`, leave review policy, task assignment/reviewer policy, work-schedule/duty filtering, and historical migrations/tests.
- It is technically low-risk to keep both department rows inactive, but it is not safe to delete or merge them solely from this audit. The duplicate display name means future UI and reconciliation must use immutable IDs/codes.
- No active user/data remap is currently required for `Phòng Trị sự`; preserving both historical rows is the safest baseline.

## E. Legacy role analysis

| Classification | Roles | Evidence / treatment |
|---|---|---|
| A. Target active management role | `tong_bien_tap`, `pho_tong_bien_tap`, `truong_phong`, `pho_truong_phong` | All active and assigned to current users; referenced by task, evaluation, leave, schedule, and navigation logic. |
| B. Staff active role | `nhan_vien` (recommended canonical ordinary staff role); `phong_vien` remains active | Both are actively assigned. `phong_vien` is the current reporter role and is referenced by duty/online-work behavior, so it cannot be silently collapsed. |
| C. Compatibility / legacy inactive | `tbt_read_only`, `tri_su`, `bien_tap_vien`, `phu_trach_phong_tri_su`, `phu_trach_phong_bien_tap`, `phu_trach_phong_phong_vien` | All inactive and unassigned, but several remain embedded in compatibility code, old migrations, tests, or historical policy. Retain; do not delete or remove grants yet. |
| D. Admin/system | `admin` | Active, three users, organization-wide grants and admin route guards. Department membership must not be assumed to scope admin unless code explicitly does so. |
| E. Needs owner decision | `phong_vien` versus `nhan_vien` as the single staff canonical role; treatment of inactive compatibility roles; whether `Ban Biên tập` is a formal target organization unit | Existing behavior distinguishes reporters from general staff, especially duty roster and online-work paths. |

## F. Hard-coded dependency analysis

The following dependencies were found by source/migration search; this is an inventory, not a recommendation to change them:

- Task authorization and visibility: `src/lib/authorization.ts`, `src/lib/taskAssignAccess.ts`, `src/lib/taskAssignmentRepository.ts`, `src/lib/taskReviewerPolicy.mjs`, task handlers and repository code. These use `roleCode`, `departmentId`, creator/owner/assignee/reviewer, participant roles, and manager identity.
- Session and module policy: `src/lib/auth.tsx`, `src/lib/serverSession.ts`, `src/components/appNavState.ts`, `src/components/phase2Navigation.ts`. Compatibility sets explicitly include `tbt_read_only`, `tri_su`, `phu_trach_phong_*`, `tong_bien_tap`, and `pho_tong_bien_tap`.
- Evaluation: `src/lib/taskEvaluation.ts`, `src/lib/personnelEvaluationAccess.ts`, evaluation routes/pages, and migrations for step 1/step 2. Current step 2 is explicitly tied to `tong_bien_tap`; step 1 uses manager/reviewer and department equality.
- Leave: `src/app/api/leave-requests/route.ts` has explicit global review roles (`admin`, `tong_bien_tap`, `pho_tong_bien_tap`) and compatibility review roles including the three `phu_trach_phong_*` codes; department filtering is applied for non-global reviewers.
- Work schedules and duty roster: `src/lib/workScheduleRepository.ts`, `src/components/WorkScheduleAdminShell.tsx`, `src/components/WorkSchedulePageShell.tsx`, and `src/components/DutyTaskShell.tsx` use role codes and job-title codes (`truong_phong*`, `phong_vien*`) to select leaders/reporters.
- Assignments: `src/components/TaskAssignShell.tsx`, `src/lib/taskAssignmentGroup.ts`, and assignment migrations depend on department managers, leadership roles, reviewer roles, and department IDs.
- Historical migration/test dependencies: `supabase/migrations/20260822210000_reactivate_tri_su_role.sql`, role lifecycle/compatibility migrations, and tests such as `authorization.test.mjs`, `phase6AssignRecurrence.test.mjs`, `appNavState.test.mjs`, and leave/evaluation/work-schedule suites.
- Department names are used for display; immutable `departments.code` and IDs are used in the more sensitive paths. Any future change must prohibit name-based joins.

## G. Target organization model

Proposed target, pending owner approval:

1. Active ordinary departments: `general` / Phòng Tổng hợp, `truyenthong` / Phòng Truyền thông, `editorial` / Phòng Nội dung.
2. Active organization-level unit: `leadership` / Ban Biên tập, retained as a leadership container unless owner decides otherwise.
3. No active Phòng Trị sự. Keep both existing inactive records for history and referential safety.
4. Management roles: `tong_bien_tap`, `pho_tong_bien_tap`, `truong_phong`, `pho_truong_phong`.
5. Canonical ordinary staff recommendation: `nhan_vien` for generic employees. Retain `phong_vien` as a distinct active reporter role until duty roster/online-work/task behavior is explicitly reconciled; do not relabel reporters as generic staff automatically.

## H. Proposed role classification

The classification in section E is the proposed baseline. No role was renamed, deactivated, deleted, or reassigned. Compatibility roles should remain queryable for history and hidden from new assignment choices only in a separately approved implementation checkpoint.

## I. Proposed RBAC target matrix

This is a high-level proposal only. It is not a grant change and does not override workflow guards or RPC/database validation.

| Role | Task view | Create | Assign | Comment | Evaluation | Staff | Attendance | Leave | Schedule | Permission manage |
|---|---|---|---|---|---|---|---|---|---|---|
| `tong_bien_tap` | organization | all | organization | allowed by workflow | step 2 / leadership | view organization | self (organization view only if separately approved) | global/TBT rules | self | no |
| `pho_tong_bien_tap` | assigned + department (plus explicit leadership paths) | all | organization/approved scope | assigned + department | step 1 where reviewer/manager rules pass | view per existing policy | self | global approval per existing policy | self | no |
| `truong_phong` | assigned + own department | all | own department | assigned + own department | step 1, own department/reviewer | no global staff management | self | own department approval | self/department where existing policy allows | no |
| `pho_truong_phong` | assigned + own department | all | own department | assigned + own department | step 1 only where current reviewer rules pass | no global staff management | self | own department approval only if approved | self/department where existing policy allows | no |
| `nhan_vien` | self + assigned | all if legacy remains | no broad assignment | self + assigned | no evaluator authority | self | self | self | self | no |
| `admin` | organization | all | organization | all | administrative/evaluation paths | manage all | all | manage all | manage all | yes |

Every mutation/evaluation row remains subject to legacy workflow guards, actor/department relation checks, RPC/database validation, and audit requirements. `task.view` alone must not imply mutation permission.

## J. Required user remapping

Current live data requires no immediate remap: no active user is in inactive Phòng Trị sự or an inactive role, and no user lacks a role or department. Before a future change, owner decisions are still needed for:

- whether any current `phong_vien` users should become `nhan_vien` (recommendation: no automatic remap);
- whether the three admins' department values are authoritative or informational;
- whether the five inactive users should remain attached to their historical active role/department (recommended: yes);
- whether any future staff role should be selected by job title rather than role code.

## K. Department reconciliation plan

1. Freeze the four active target units and `leadership` as a distinct organization-level unit.
2. Keep inactive department rows; do not hard-delete or merge by display name.
3. Add an owner-approved alias/lineage map before any UI or data migration (`operations` and `admin` are not interchangeable despite the same display name).
4. Verify the eight tasks with null department IDs and decide whether they remain historical nulls or receive an explicit, individually reviewed department.
5. Only after review, update selectors/filters to exclude inactive departments while preserving historical reads.

## L. Role reconciliation plan

1. Keep the four target management role codes unchanged.
2. Use `nhan_vien` as the generic staff candidate; keep `phong_vien` separate for reporter-specific behavior.
3. Keep all inactive compatibility roles and grants until code/history dependency review is complete.
4. Add no grants in this audit. Any grant changes require a separate migration, characterization tests, rollback plan, and owner approval.
5. Update role assignment UI only after a canonical-role decision; never infer a role from display name.

## M. Data/history preservation

Future reconciliation must preserve all referenced IDs and history: tasks, task assignments, comments/attachments, audit events, attendance logs/punches/sync requests, leave requests, work schedules, online-work schedules, duty/evaluation records, and role/department foreign keys. No hard delete is justified by this audit.

## N. Risk analysis

- **High:** changing `phong_vien` to `nhan_vien` can alter duty roster, online-work eligibility, assignment filtering, and navigation.
- **High:** changing manager role or department IDs can alter task assignment, reviewer routing, leave approvals, and step 1 evaluation.
- **High:** treating the two inactive `Phòng Trị sự` records as one row can break historical identity and create ambiguous remaps.
- **Medium:** admin department reassignment can affect display/filtering even where admin authorization is organization-wide.
- **Medium:** removing compatibility roles/grants can break legacy routes, tests, or historical reads.
- **Medium:** the eight null-department tasks need explicit treatment before organization-scoped reporting is considered complete.

## O. Impact on Journalism Tasks

J2/J3 must remain blocked until this map is approved. Journalism read/assignment behavior will inherit canonical Task authorization:

- department filtering must use the approved department IDs/relations and must never widen parent Task visibility;
- assignment scope must continue to use `canAssignToDepartment`, manager/reviewer rules, participant validation, and RPC/database checks;
- reviewer hierarchy must distinguish organization leadership from department managers;
- `phong_vien` versus `nhan_vien` affects future Journalism assignment eligibility and should not be collapsed implicitly;
- future Journalism metadata/publication permissions must be separate from `task.view` and must not be added during reconciliation;
- inactive work/role/department records may remain readable for history but must not become selectable for new writes without an approved policy.

## P. Exact owner decisions still required

1. Confirm whether `Ban Biên tập` remains an active organization-level unit outside the three ordinary departments.
2. Confirm `nhan_vien` as canonical generic staff role while retaining `phong_vien` as a distinct reporter role.
3. Confirm that both inactive `Phòng Trị sự` rows remain preserved and are not merged/deleted.
4. Decide whether admins' department IDs are informational or must be normalized.
5. Decide the treatment of the eight tasks with null department IDs.
6. Decide whether inactive compatibility roles stay hidden-but-readable indefinitely or are subject to a later lifecycle checkpoint.
7. Approve the target RBAC matrix as a design baseline only; no grants have been changed.
8. Approve the remediation order and rollback requirements before any user/department/role update.

## Q. Recommended implementation checkpoints

- **R0 – owner review:** approve sections G–P and the immutable ID/lineage policy.
- **R1 – reconciliation dry run:** generate a per-row proposed mapping and impact diff; no writes.
- **R2 – characterization:** run task, leave, attendance, schedule, duty, evaluation, and RBAC suites against the proposed mapping in an isolated database.
- **R3 – controlled data migration:** only after explicit approval; backup DB/source/service metadata, apply narrow reversible updates, and verify counts/history.
- **R4 – post-change smoke:** verify each role/department scope and Journalism prerequisite behavior; keep RBAC flag and production deployment decisions separate.

## Audit disposition

**AUDIT COMPLETE — NO DATA CHANGE AUTHORIZED.**  
**J2 STATUS: PAUSED pending owner approval of this reconciliation map.**

