import assert from "node:assert/strict";
import test from "node:test";
import { createAssetRepository } from "./assetRepository.ts";

function makeDb() {
  const calls = [];
  const rows = {
    assets: [{ id: "asset-1", asset_name: "Laptop", status: "in_use", assigned_department_id: "legacy-dept" }],
    asset_assignments: [{ id: "assignment-1", asset_id: "asset-1", department_id: "dept-a", assignee_id: "user-a", status: "active", returned_at: null }],
  };
  const query = (table) => {
    const state = { table, filters: [], selected: null };
    const builder = {
      select(value) { state.selected = value; return builder; },
      eq(field, value) { state.filters.push([field, value]); return builder; },
      is(field, value) { state.filters.push([field, value]); return builder; },
      order() { return builder; },
      limit() { return builder; },
      maybeSingle: async () => ({ data: rows[table]?.[0] ?? null, error: null }),
      single: async () => ({ data: rows[table]?.[0] ?? null, error: null }),
      then(resolve) { resolve({ data: rows[table] ?? [], error: null }); },
    };
    calls.push({ type: "query", table, state });
    return builder;
  };
  return {
    calls,
    db: {
      from: query,
      rpc: async (name, args) => { calls.push({ type: "rpc", name, args }); return { data: { assignment: rows.asset_assignments[0] }, error: null }; },
    },
  };
}

const actor = { id: "server-actor", department_id: "dept-a", is_department_manager: false, rbacPermissions: ["asset.manage"] };

test("list repository hydrates current assignment instead of trusting legacy projection", async () => {
  const fixture = makeDb();
  const repository = createAssetRepository(fixture.db);
  const result = await repository.listAssetsForActor(actor);
  assert.equal(result.ok, true);
  assert.equal(result.data.assets[0].currentAssignment.department_id, "dept-a");
  assert.equal(result.data.assets[0].assigned_department_id, "legacy-dept");
});

test("lifecycle repository passes server actor and allows department plus assignee", async () => {
  const fixture = makeDb();
  const repository = createAssetRepository(fixture.db);
  const result = await repository.assignAssetForActor(actor, { asset_id: "asset-1", department_id: "dept-a", assignee_id: "user-a" });
  assert.equal(result.ok, true);
  assert.equal(fixture.calls.find((call) => call.type === "rpc").args.p_actor_id, "server-actor");
  assert.equal(fixture.calls.find((call) => call.type === "rpc").args.p_assignee_id, "user-a");
});

test("client actor id is never accepted as a lifecycle authority", async () => {
  const fixture = makeDb();
  const repository = createAssetRepository(fixture.db);
  await repository.returnAssetForActor(actor, { asset_id: "asset-1", actorId: "spoofed" });
  assert.equal(fixture.calls.find((call) => call.type === "rpc").args.p_actor_id, "server-actor");
});
