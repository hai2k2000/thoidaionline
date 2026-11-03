import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const sql = readFileSync("supabase/migrations/20261103160000_projects_v1.sql", "utf8");
test("project tables use default-deny RLS without client-role policies", () => {
  for (const table of ["projects", "project_members"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`, "i"));
  }
  assert.doesNotMatch(sql, /\bcreate policy[^;]*\bon\s+public\.(projects|project_members)\b/i);
});
test("project tables and all helpers have explicit service-only ACLs", () => {
  assert.match(sql, /revoke all on table public.projects,public.project_members from public,anon,authenticated/);
  for (const name of ["api_project_actor_can_create", "api_project_is_lead"]) assert.match(sql, new RegExp("'" + name + "\\(uuid"));
});
test("project create honors effective user overrides and membership mutations serialize", () => {
  assert.match(sql, /api_list_effective_permissions\(p_actor\)/);
  assert.match(sql, /p_remove or p_role is distinct from 'lead'/);
  assert.match(sql, /status,host_department_id into[\s\S]*for update/);
});
test("project assignment preserves canonical bounds and default reviewer", () => {
  assert.match(sql, /length\(p_title\)>500/);
  assert.match(sql, /length\(p_description\)>10000/);
  assert.match(sql, /p_reviewer_id := coalesce\(p_reviewer_id,p_actor_id\)/);
});
test("SQL task workflow admits project comments and restricts project review to leads", () => {
  assert.match(sql, /create or replace function public.api_assert_task_action/);
  assert.match(sql, /v_task.project_id is not null/);
});

test("deferred manager watcher enforcement exempts project tasks", () => {
  assert.match(sql, /create or replace function public.enforce_assignee_manager_watcher/);
  assert.match(sql, /if v_project_id is not null or v_task_category='duty'/);
});

test("legacy completion review authorizes project leads before legacy role restrictions", () => {
  assert.match(sql, /create or replace function public.review_task_completion/);
  assert.match(sql, /if v_task.project_id is not null then\s+perform public.api_assert_task_action/);
});
