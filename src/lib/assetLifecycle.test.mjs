import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("warehouse and lifecycle migration preserves manage-only, atomic asset actions", () => {
  const migration = read("../../supabase/migrations/20261016120001_asset_locations_reclaim_liquidation.sql");
  assert.match(migration, /\('kho',\s*'Kho'\)/);
  assert.match(migration, /\('kho_cho_xu_ly',\s*'Kho chờ xử lý'\)/);
  assert.match(migration, /api_asset_reclaim_unrepairable/);
  assert.match(migration, /api_asset_liquidate/);
  assert.match(migration, /asset_actor_can_manage\(p_actor_id\)/g);
  assert.match(migration, /condition_status is distinct from 'broken'/);
  assert.match(migration, /status = 'returned'/);
  assert.match(migration, /code = 'kho_cho_xu_ly'/);
  assert.match(migration, /active_assignment_requires_reclaim/);
  assert.match(migration, /revoke all on function public\.api_asset_(reclaim_unrepairable|liquidate)/);
});

test("ordinary asset return moves the asset to the Kho location", () => {
  const migration = read("../../supabase/migrations/20261019100000_asset_return_to_warehouse.sql");
  assert.match(migration, /create or replace function public\.api_asset_return/);
  assert.match(migration, /where code = 'kho' and active = true/);
  assert.match(migration, /status = 'available',[\s\S]*assigned_department_id = null,[\s\S]*location_id = v_location_id/);
  assert.match(migration, /warehouse_location_not_configured/);
  assert.match(migration, /grant execute on function public\.api_asset_return\(uuid, uuid, text\) to service_role/);
});

test("asset detail exposes explicit reclaim and liquidation controls", () => {
  const page = read("../app/assets/[id]/page.tsx");
  assert.match(page, /tự động chuyển về Kho/);
  assert.match(page, /Thu hồi về kho chờ xử lý/);
  assert.match(page, /Thanh lý tài sản/);
  assert.match(page, /condition_status === "broken"/);
  assert.match(page, /runLifecycle\("liquidate"\)/);
});
