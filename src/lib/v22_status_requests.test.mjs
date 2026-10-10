import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../supabase/migrations/20261012100000_asset_management_v22_status_requests.sql", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/assets/status-requests/route.ts", import.meta.url), "utf8");
const myAssets = readFileSync(new URL("../app/api/my-assets/route.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("./assetRepository.ts", import.meta.url), "utf8");

test("status request schema is bounded and has one pending request per asset", () => {
  assert.match(migration, /requested_status text not null check \(requested_status in \('maintenance', 'broken'\)\)/);
  assert.match(migration, /create unique index if not exists asset_status_requests_one_pending_idx/);
  assert.match(migration, /expected_assignment_id/);
  assert.match(migration, /asset_status_or_assignment_conflict/);
  assert.match(migration, /insert into public.audit_logs/);
});

test("status request API derives actor from server session and separates review authorization", () => {
  assert.match(route, /getSessionUser/);
  assert.match(route, /api_asset_status_request_create/);
  assert.match(route, /api_asset_status_request_review/);
  assert.match(route, /canManageAssets\(actor\)/);
  assert.doesNotMatch(route, /actor_id.*body|body.*actor_id/);
  assert.match(myAssets, /listAssetsForActor\(actor, "mine"\)/);
  assert.match(repository, /scope: "visible" \| "mine"/);
});
