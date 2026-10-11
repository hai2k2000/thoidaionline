import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../../supabase/migrations/20261013100000_asset_management_v23_condition_service.sql");
const list = read("../app/assets/page.tsx");
const service = read("../components/AssetServiceHistory.tsx");
const requests = read("../app/api/assets/status-requests/route.ts");

test("V2.3 migration keeps service audit old/new and transition-safe condition application", () => {
  assert.match(sql, /service_record_update[\s\S]*action, old_data, new_data/);
  assert.match(sql, /v_old_status := v_record\.service_status/);
  assert.match(sql, /v_old_status <> 'completed' and p_service_status = 'completed'/);
  assert.doesNotMatch(sql, /if p_service_status = 'completed' and p_condition_after is not null then update public\.assets/);
  assert.match(sql, /where id = p_record_id and asset_id = p_asset_id/);
});

test("V2.3 service creation is historical-safe by default", () => {
  assert.match(service, /service_status: "planned"/);
  assert.match(service, /condition_after: ""/);
  assert.match(sql, /service_record_create/);
});

test("V2.3 filter and condition request contracts are explicit", () => {
  assert.match(list, /Phòng ban/);
  assert.match(list, /Nhân viên/);
  assert.match(list, /Trạng thái sử dụng/);
  assert.match(list, /aria-controls="employee-filter-options"/);
  assert.match(list, /ArrowDown|event\.key === "ArrowDown"/);
  assert.match(requests, /condition_noop/);
});
