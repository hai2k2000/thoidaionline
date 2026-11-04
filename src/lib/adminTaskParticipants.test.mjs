import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { isCollaboratorAllowedApiPath } from "./collaboratorRole.mjs";

const sql = readFileSync("supabase/migrations/20261106100000_admin_edit_task_participants.sql", "utf8");
test("migration and revert preserve the original admin participant invariant", () => {
  const revert = readFileSync("scripts/production/admin-edit-participants-revert.sql", "utf8");
  for (const source of [sql, revert]) {
    assert.doesNotMatch(source, /reject_system_admin_task_participant|thoidai\.admin_participants/);
  }
});

test("participant candidates exclude admins while reviewers retain their allowed scope", async () => {
  const users = [
    { id: "admin", full_name: "Admin", roles: { code: "admin" }, active: true },
    { id: "other-admin", full_name: "Other admin", roles: [{ code: "ADMIN" }], active: true },
    { id: "lead", full_name: "Lead", roles: { code: "nhan_vien" }, active: true },
    { id: "deputy", department_id: "dept", job_titles: [{ code: "PHO_TRUONG_PHONG", active: true }], roles: { code: "nhan_vien" }, active: true },
    { id: "wrong-dept", department_id: "other", job_titles: { code: "truong_phong", active: true }, roles: { code: "tong_bien_tap" }, active: true },
    { id: "inactive-title", department_id: "dept", job_titles: { code: "truong_phong", active: false }, roles: { code: "nhan_vien" }, active: true },
    ...["phu_trach_phong_tri_su", "phu_trach_phong_phong_vien", "phu_trach_phong_bien_tap", "pho_tong_bien_tap", "tong_bien_tap"].map(code => ({ id: code, roles: { code }, active: true })),
    { id: "member", full_name: "Member", roles: { code: "nhan_vien" }, active: true },
    { id: "inactive", full_name: "Inactive", roles: { code: "nhan_vien" }, active: false },
  ];
  const members = [{ user_id: "other-admin", role: "lead" }, { user_id: "lead", role: "lead" }, { user_id: "member", role: "member" }];
  const client = { from(table) {
    return { select() { return { eq(field, value) {
      if (table === "project_members") return Promise.resolve({ data: members });
      if (table === "departments") return { eq() { return { maybeSingle() { return Promise.resolve({ data: value === "dept" ? { manager_id: "lead" } : null }); } }; } };
      return { order() { return Promise.resolve({ data: users.filter(user => user[field] === value) }); } };
    } }; } };
  } };
  const source = readFileSync("src/lib/adminTaskParticipantOptions.ts", "utf8").replace(/^import .*;\r?\n/gm, "").replace("export async function", "async function");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const options = new Function("serverSupabase", `${js}; return adminTaskParticipantOptions;`)(client);
  const normal = await options(null, "admin", "dept");
  assert.ok(normal.people.every(p => !["admin", "other-admin", "inactive"].includes(p.id)));
  const seniorRoles = ["phu_trach_phong_tri_su", "phu_trach_phong_phong_vien", "phu_trach_phong_bien_tap", "pho_tong_bien_tap", "tong_bien_tap"];
  assert.deepEqual(normal.reviewers.map(p => p.id), ["lead", "deputy", ...seniorRoles]);
  assert.deepEqual((await options(null, "admin", "inactive-dept")).reviewers.map(p => p.id), seniorRoles);
  const project = await options("project", "admin", "dept");
  assert.deepEqual(project.people.map(p => p.id), ["lead", "member"]);
  assert.deepEqual(project.reviewers.map(p => p.id), ["admin", "other-admin", "lead"]);
});
test("CTV proxy denies admin participant mutation", () => {
  assert.equal(isCollaboratorAllowedApiPath("/api/tasks/00000000-0000-4000-8000-000000000010/admin-participants", "PATCH"), false);
});
test("participant migration preserves the wrapper boundary and unrelated child data", () => {
  assert.match(sql, /api_assert_task_creator_mutation\(p_actor_id,p_task_id,'edit'\)/);
  assert.doesNotMatch(sql, /create or replace function public\.api_admin_edit_task\(/);
  assert.match(sql, /revoke all on function public\.api_admin_edit_task_unchecked\([^;]+from public,anon,authenticated,service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.api_admin_edit_task_unchecked/);
  assert.doesNotMatch(sql, /create or replace function public\.enforce_assignee_manager_watcher/);
  assert.doesNotMatch(sql, /(?:delete from|update) public\.task_(?:comments|progress_reports|progress_logs)/);
  assert.match(sql, /p_reviewer_id is null or not \(exists/);
});
test("disposable runner includes backup, ACL, behavior, idempotency and revert gates", () => {
  const source = readFileSync("scripts/production/admin-edit-participants-dryrun.sh", "utf8");
  for (const token of ["THOIDAI_ADMIN_EDIT_PARTICIPANTS_DRYRUN_APPROVED", "disk_guard_require", "sha256sum", "leftover dry-run container", "restore_acl", "admin_edit_participants_behaviour.sql", "step=idempotency", "step=revert", "step=reapply", "trap cleanup EXIT"]) assert.ok(source.includes(token), token);
});
