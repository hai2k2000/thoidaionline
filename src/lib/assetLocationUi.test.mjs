import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("asset management exposes persisted locations without changing HR departments", () => {
  const migration = read("../../supabase/migrations/20261016100000_asset_locations.sql");
  const page = read("../app/assets/page.tsx");
  const create = read("../app/assets/new/page.tsx");
  const route = read("../app/api/assets/route.ts");

  for (const label of ["Phòng Tổng biên tập", "Phòng Phó Tổng biên tập", "Phòng họp"]) {
    assert.match(migration, new RegExp(label));
  }
  assert.match(migration, /create table if not exists public\.asset_locations/);
  assert.match(migration, /alter table public\.assets add column if not exists location_id/);
  assert.match(route, /from\("asset_locations"\)/);
  assert.match(route, /location_id/);
  assert.match(page, /\+ Thêm tài sản/);
  assert.match(page, /hasPermission\("asset\.manage"\)/);
  assert.match(create, /aria-label="Vị trí tài sản"/);
});

test("asset creation remains server-authorized by effective asset.manage", () => {
  const route = read("../app/api/assets/route.ts");
  assert.match(route, /const actor = toAssetRepositoryActor\(sessionActor\)/);
  assert.match(route, /createAssetForActor\(actor/);
  assert.match(read("../lib/assetRepository.ts"), /if \(!canManageAssets\(actor\)\) return fail\("forbidden"\)/);
});
