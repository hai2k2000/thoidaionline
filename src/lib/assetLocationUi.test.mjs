import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("asset management exposes persisted locations without changing HR departments", () => {
  const migration = read("../../supabase/migrations/20261016100000_asset_locations.sql") + read("../../supabase/migrations/20261016110000_asset_locations_expansion.sql");
  const page = read("../app/assets/page.tsx");
  const create = read("../app/assets/new/page.tsx");
  const route = read("../app/api/assets/route.ts");

  for (const label of ["Phòng Tổng biên tập", "Phòng Phó Tổng biên tập", "Phòng họp", "Phòng Truyền thông", "Phòng Nội dung", "Phòng Tổng hợp 1", "Phòng Tổng hợp 2", "Phòng Bảo vệ", "Phòng Kỹ thuật"]) {
    assert.match(migration, new RegExp(label));
  }
  assert.match(migration, /insert into public.asset_locations/);
  assert.ok(migration.includes("on conflict (code) do update"));
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

test("asset filters use six columns on wide desktop and collapse responsively", () => {
  const page = read("../app/assets/page.tsx");
  assert.match(page, /grid-cols-1[^\n]*sm:grid-cols-2[^\n]*lg:grid-cols-3[^\n]*xl:grid-cols-6/);
  assert.match(page, /className="grid min-w-0 gap-1\.5 text-sm font-semibold text-slate-700"/);
});
