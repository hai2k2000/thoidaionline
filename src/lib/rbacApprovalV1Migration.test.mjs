import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20261028100000_rbac_approval_permissions_v1.sql", import.meta.url);
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const livePath = pathToFileURL("C:/Users/hai2k/Desktop/hai2k/claude/cpay/thoidai-rbac-approval/p1-evidence/live-functions.sql");
const live = existsSync(livePath) ? readFileSync(livePath, "utf8") : "";

test("approval migration seeds catalog and bounded role grants", () => {
  for (const code of ["leave.approve", "schedule.business.approve", "schedule.event.approve"]) assert.match(migration, new RegExp(code.replaceAll(".", "\\.")));
  assert.match(migration, /on conflict\s*\(code\)\s*do nothing/i);
  assert.doesNotMatch(migration, /insert into public\.user_permission_grants/i);
  for (const role of ["admin", "tong_bien_tap", "pho_tong_bien_tap", "phu_trach_phong_tri_su", "phu_trach_phong_phong_vien", "phu_trach_phong_bien_tap"]) assert.match(migration, new RegExp(role));
  assert.match(migration, /department/); assert.match(migration, /all/);
});

test("scope function preserves live branches and adds only approval branch", () => {
  assert.match(migration, /when p_permission_code in \('leave\.approve', 'schedule\.business\.approve', 'schedule\.event\.approve'\) then p_scope in \('department', 'all'\)/i);
  if (live) {
    for (const branch of ["p_scope is null", "task.quick_report.create", "task.assign", "asset.view", "else p_scope in ('self', 'assigned', 'department', 'all')"]) assert.match(migration, new RegExp(branch.replace(/[()]/g, "\\$&"), "i"));
  } else console.log("SKIP live function comparison: live-functions.sql absent");
});

test("new and replaced RPCs are locked to service_role", () => {
  for (const fn of ["approval_effective_scopes", "approval_review_basis", "approval_assert_can_review", "api_review_leave_request", "api_review_personal_work_schedule", "api_list_reviewable_leave_requests", "api_list_reviewable_personal_plans", "api_get_approval_capabilities", "api_list_user_approval_permissions", "api_list_user_permission_history"]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${fn}`, "i"));
    const section = migration.slice(migration.toLowerCase().indexOf(`create or replace function public.${fn}`));
    assert.match(section, /security definer/i); assert.match(section, /set search_path = public, pg_temp/i);
    assert.match(section, /revoke all on function[\s\S]*?from public, anon, authenticated/i);
    assert.match(section, /grant execute on function[\s\S]*?to service_role/i);
  }
});

test("review contracts retain locking, self approval, revision and legacy rules", () => {
  assert.match(migration, /api_review_leave_request\(\s*p_actor uuid,\s*p_request_id uuid,\s*p_decision text,\s*p_note text\)/i);
  assert.match(migration, /api_review_personal_work_schedule\(\s*p_actor uuid,\s*p_id uuid,\s*p_action text,\s*p_note text,\s*p_expected_revision bigint\)/i);
  assert.match(migration, /for update/i); assert.match(migration, /created_by\s*=\s*p_actor|v_old\.created_by\s*=\s*p_actor|p_actor\s*=\s*v_old\.requester_id/i);
  assert.match(migration, /workflow_revision <> p_expected_revision/i); assert.match(migration, />= 3/); assert.match(migration, /tong_bien_tap/);
  assert.match(migration, /plan_type = 'work'|plan_type='work'/i); assert.match(migration, /legacy_work/); assert.match(migration, /approval_basis/);
  const workBranch = migration.slice(migration.indexOf("else\n    select lower(r.code) into v_role"));
  assert.match(workBranch, /select[\s\S]*from public\.staff_users u[\s\S]*where u\.id=p_actor and u\.active=true[\s\S]*if not found then[\s\S]*raise exception 'forbidden'/i);
  assert.match(workBranch, /coalesce\(v_role,''\)\s+not in/i);
  assert.match(workBranch, /join public\.departments d on d\.id=u\.department_id and d\.active and d\.manager_id=u\.id[\s\S]*where u\.id=p_actor and u\.active=true/i);
  assert.doesNotMatch(migration, /drop\s+(table|function|policy)|truncate\s+/i); assert.doesNotMatch(migration, /delete\s+from/i);
});

test("review business-rule conflicts use non-retryable SQLSTATE 55000", () => {
  for (const name of ["api_review_leave_request", "api_review_personal_work_schedule"]) {
    const start = migration.toLowerCase().indexOf(`create or replace function public.${name}`);
    const next = migration.indexOf("create or replace function public.", start + 1);
    const section = migration.slice(start, next < 0 ? migration.length : next);
    assert.doesNotMatch(section, /errcode\s*=\s*'40001'/i);
    assert.match(section, /errcode\s*=\s*'55000'/i);
  }
});

test("permission display structural scopes require active users", () => {
  const permissionList = migration.slice(migration.indexOf("create or replace function public.api_list_user_approval_permissions"));
  assert.match(permissionList, /p\.code='leave\.approve'\s+and\s+j\.code='truong_phong'\s+and\s+u\.active/i);
  assert.match(permissionList, /p\.code like 'schedule\.%'\s+and\s+d\.manager_id=u\.id\s+and\s+d\.active\s+and\s+u\.active/i);
});
