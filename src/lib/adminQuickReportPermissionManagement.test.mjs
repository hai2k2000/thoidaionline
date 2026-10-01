import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/permissions/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/permissions/page.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20261001100000_admin_quick_report_permission_management.sql", import.meta.url), "utf8");

test("permission management exposes the exact Quick Report catalog metadata", () => {
  assert.match(page, /task\.quick_report\.create/);
  assert.match(page, /Tạo\/Báo cáo công việc phát sinh/);
  assert.match(page, /Cho phép tạo công việc phát sinh không cần phê duyệt/);
  assert.match(page, /Công việc/);
});

test("permission mutations use the existing permission.manage capability and server mutation guard", () => {
  assert.match(route, /requireMutationActor/);
  assert.match(route, /loadRbacActor/);
  assert.match(route, /permission\.manage/);
  assert.match(route, /api_set_quick_report_permission/);
  assert.match(route, /readJsonObject/);
  assert.match(route, /asUuid/);
  assert.doesNotMatch(route, /role_code\s*===\s*["']admin["']/);
});

test("role mutation RPC is admin-authorized, idempotent, auditable, and server-only", () => {
  assert.match(migration, /create or replace function public\.api_set_quick_report_permission\([\s\S]*p_actor_id uuid,[\s\S]*p_role_id uuid,[\s\S]*p_granted boolean/i);
  assert.match(migration, /permission\.manage/);
  assert.match(migration, /on conflict \(role_id, permission_id, scope\) do nothing/i);
  assert.match(migration, /delete from public\.role_permission_grants/i);
  assert.match(migration, /grant_permission/);
  assert.match(migration, /revoke_permission/);
  assert.match(migration, /public\.audit_logs/);
  assert.match(migration, /if v_changed > 0 then/);
  assert.match(migration, /revoke all on function public\.api_set_quick_report_permission\(uuid,\s*uuid,\s*boolean\) from public,\s*anon,\s*authenticated/i);
  assert.match(migration, /grant execute on function public\.api_set_quick_report_permission\(uuid,\s*uuid,\s*boolean\) to service_role/i);
});

test("unsupported direct user and department grant models are not introduced", () => {
  assert.doesNotMatch(migration, /user_permission|department_permission|permission_inherit/i);
  assert.doesNotMatch(migration, /role_permissions/);
});

test("the permissions page provides grant/revoke controls without changing Quick Report workflow", () => {
  assert.match(page, /grant|cấp|bật/i);
  assert.match(page, /revoke|thu hồi|tắt/i);
  assert.match(page, /Thu hồi quyền Tạo\/Báo cáo công việc phát sinh/);
  assert.doesNotMatch(page, /workflow_type|REPORT_ONLY|api_create_quick_report_v1/);
});
