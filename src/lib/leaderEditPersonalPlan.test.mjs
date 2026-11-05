import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canLeaderEditPersonalPlan } from "./leaderEditPersonalPlan.mjs";
import { canEditCreatorMutation, personalScheduleLifecycleState } from "./creatorMutationPolicy.mjs";

const row = (overrides = {}) => ({
  created_by: "creator",
  creator_department_id: "dept-a",
  approval_status: "APPROVED",
  schedule_scope: "personal",
  ...overrides,
});
const actor = (overrides = {}) => ({
  id: "leader",
  role_code: "tong_bien_tap",
  job_title_code: null,
  department_id: "dept-z",
  is_department_manager: false,
  ...overrides,
});

test("global leaders can edit approved and pending personal plans in any department", () => {
  for (const role_code of ["admin", "tong_bien_tap", "pho_tong_bien_tap"]) {
    assert.equal(canLeaderEditPersonalPlan(row(), actor({ role_code })), true);
    assert.equal(canLeaderEditPersonalPlan(row({ approval_status: "PENDING_APPROVAL" }), actor({ role_code })), true);
  }
});

test("department managers can edit only plans created in their real department", () => {
  const manager = actor({ role_code: "nhan_vien", job_title_code: "truong_phong_kinh_doanh", department_id: "dept-a" });
  assert.equal(canLeaderEditPersonalPlan(row(), manager), true);
  assert.equal(canLeaderEditPersonalPlan(row({ creator_department_id: "dept-b" }), manager), false);
  assert.equal(canLeaderEditPersonalPlan(row(), actor({ role_code: "truong_phong", department_id: "dept-a" })), true);
  assert.equal(canLeaderEditPersonalPlan(row(), actor({ role_code: "nhan_vien", is_department_manager: true, department_id: "dept-a" })), true);
  assert.equal(canLeaderEditPersonalPlan(row(), actor({ role_code: "nhan_vien", is_department_manager: true, department_id: "dept-b" })), false);
});

test("non-leaders, cancelled plans, and non-personal rows are denied", () => {
  assert.equal(canLeaderEditPersonalPlan(row(), actor({ role_code: "pho_truong_phong", department_id: "dept-a" })), false);
  assert.equal(canLeaderEditPersonalPlan(row({ approval_status: "CANCELLED" }), actor()), false);
  assert.equal(canLeaderEditPersonalPlan(row({ schedule_scope: "organization" }), actor()), false);
});

test("creator pending is handled separately while approved creator is not granted by this helper", () => {
  assert.equal(canLeaderEditPersonalPlan(row({ approval_status: "PENDING_APPROVAL" }), actor({ id: "creator", role_code: "nhan_vien" })), false);
  assert.equal(canLeaderEditPersonalPlan(row({ approval_status: "APPROVED" }), actor({ id: "creator", role_code: "nhan_vien" })), false);
  for (const [approval_status, expected] of [["PENDING_APPROVAL", true], ["APPROVED", false], ["CANCELLED", false]]) {
    assert.equal(canEditCreatorMutation({ actorId: "creator", createdBy: "creator", isAdmin: false, state: personalScheduleLifecycleState(approval_status) }), expected);
  }
});

test("current creator department wins over the historical snapshot and missing identity fails closed", () => {
  const manager = actor({ role_code: "truong_phong", department_id: "dept-a" });
  assert.equal(canLeaderEditPersonalPlan(row({ creator: { department_id: "dept-b" } }), manager), false);
  assert.equal(canLeaderEditPersonalPlan(row({ creator_department_id: "dept-b", creator: { department_id: "dept-a" } }), manager), true);
  assert.equal(canLeaderEditPersonalPlan(row({ creator: { department_id: null } }), manager), false);
  assert.equal(canLeaderEditPersonalPlan(row(), actor({ id: undefined })), false);
  assert.equal(canLeaderEditPersonalPlan(row({ approval_status: null }), actor()), false);
});

test("static wiring keeps the server and client policy aligned", () => {
  const shell = readFileSync(new URL("../components/WorkSchedulePageShell.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/work-schedule/personal/route.ts", import.meta.url), "utf8");
  const repository = readFileSync(new URL("./workScheduleRepository.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../supabase/migrations/20261106200000_leader_edit_personal_events.sql", import.meta.url), "utf8");
  const dryrun = readFileSync(new URL("../../scripts/production/leader-edit-personal-events-dryrun.sh", import.meta.url), "utf8");
  for (const page of ["../app/work-schedule/page.tsx", "../app/work-schedule/staff/page.tsx", "../app/work-schedule/leadership/page.tsx"]) {
    assert.match(readFileSync(new URL(page, import.meta.url), "utf8"), /currentUserDepartmentId=\{user\.department_id\}/);
  }
  assert.match(shell, /canLeaderEditPersonalPlan/);
  assert.match(shell, /Sửa sự kiện \/ thành viên/);
  assert.match(shell, /participantIds: planParticipantIds/);
  assert.match(route, /if \(!input.id\) input.participantIds = \[guard.actor.id\]/);
  assert.match(repository, /p_participant_ids: input\.participantIds/);
  assert.match(migration, /api_create_personal_work_schedule/);
  assert.match(migration, /PENDING_APPROVAL.*APPROVED|APPROVED.*PENDING_APPROVAL/);
  assert.match(migration, /revoke all on function public\.api_create_personal_work_schedule/);
  assert.match(migration, /grant execute on function public\.api_create_personal_work_schedule[\s\S]*to service_role/);
  for (const marker of ["*-daily", "pg_restore", "safe-apply-migration.sh", "THOIDAI_LEADER_EDIT_PERSONAL_EVENTS_DRYRUN_APPROVED", "has_function_privilege('service_role'", "api_create_personal_work_schedule"]) assert.ok(dryrun.includes(marker), marker);
  assert.match(dryrun, /step=restore_acl[\s\S]*revoke all[\s\S]*step=apply/);
  assert.match(dryrun, /leader_edit_personal_events_behaviour\.sql/);
  assert.match(shell, /setPlanParticipantIds\(\[\.\.\.row.participant_ids\]\)/);
  assert.match(shell, /editingRow \? editingRow.schedule_scope !== "organization"/);
  assert.match(shell, /response.status === 403/);
  assert.match(shell, /response.status === 409/);
  assert.match(shell, /row\.schedule_scope === "personal" \? "\/api\/work-schedule\/personal"/);
  assert.match(shell, /deletePlan\(row\)/);
  const picker = readFileSync(new URL("../components/PersonalPlanParticipants.tsx", import.meta.url), "utf8");
  assert.match(picker, /outOfListEventMembers/);
  assert.match(picker, /ngoài danh sách/);
  assert.match(picker, /search.trim\(\)/);
  assert.match(picker, /person.departments\?\.name/);
});
