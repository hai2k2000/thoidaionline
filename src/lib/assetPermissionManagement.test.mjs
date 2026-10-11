import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/permissions/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/permissions/page.tsx", import.meta.url), "utf8");
const repository = readFileSync(new URL("./rbac/repository.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20261014100000_asset_manage_permission_management.sql", import.meta.url), "utf8");

 test("asset permissions remain separated into read-only view and mutable management", () => {
  assert.match(page, /Xem tài sản/);
  assert.match(page, /asset\.view/);
  assert.match(page, /Chỉ đọc/);
  assert.match(page, /Quản lý tài sản/);
  assert.match(page, /asset\.manage/);
  assert.match(route, /permissionCode/);
});

test("asset.manage mutations are generic and server-authorized", () => {
  assert.match(route, /api_set_asset_manage_permission/);
  assert.match(route, /setAssetManageUserPermission/);
  assert.match(repository, /api_set_asset_manage_user_permission/);
  assert.match(route, /hasPermission\(actor, "permission\.manage"\)/);
  assert.doesNotMatch(route, /Tùng Dương|Thu Hương|Quỳnh Trang/);
  assert.doesNotMatch(page, /Tùng Dương|Thu Hương|Quỳnh Trang/);
});

test("asset.manage role and user RPCs are idempotent, auditable, and service-role-only", () => {
  assert.match(migration, /api_set_asset_manage_permission/);
  assert.match(migration, /api_set_asset_manage_user_permission/);
  assert.match(migration, /on conflict \(role_id, permission_id, scope\) do nothing/i);
  assert.match(migration, /on conflict \(user_id, permission_id\) do nothing/i);
  assert.match(migration, /delete from public\.role_permission_grants/i);
  assert.match(migration, /delete from public\.user_permission_grants/i);
  assert.match(migration, /public\.audit_logs/);
  assert.match(migration, /if v_changed > 0 then/);
  assert.match(migration, /revoke all on function public\.api_set_asset_manage_permission\(uuid, uuid, boolean\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.api_set_asset_manage_permission\(uuid, uuid, boolean\) to service_role/i);
  assert.match(migration, /revoke all on function public\.api_set_asset_manage_user_permission\(uuid, uuid, boolean\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.api_set_asset_manage_user_permission\(uuid, uuid, boolean\) to service_role/i);
});

test("asset list UI keeps the requested polished table and mobile contracts", () => {
  const assets = readFileSync(new URL("../app/assets/page.tsx", import.meta.url), "utf8");
  assert.match(assets, /min-w-\[900px\]/);
  assert.match(assets, /whitespace-nowrap[^\n]*Ghi chú|Ghi chú[^\n]*whitespace-nowrap/);
  assert.match(assets, />Xem <span/);
  assert.match(assets, /Tài sản dùng chung của phòng/);
  assert.match(assets, /role="combobox"/);
});
