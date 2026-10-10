import assert from "node:assert/strict";
import test from "node:test";
import { createAssetRepository } from "./assetRepository.ts";

function makeDb() {
  const calls = [];
  const rows = {
    assets: [{ id: "asset-1", asset_name: "Laptop", status: "in_use", assigned_department_id: "legacy-dept" }],
    asset_assignments: [{ id: "assignment-1", asset_id: "asset-1", department_id: "dept-a", assignee_id: "user-a", status: "active", returned_at: null }],
    departments: [{ id: "dept-a", name: "Phòng A" }],
    staff_users: [{ id: "user-a", full_name: "Người A" }],
  };
  const query = (table) => {
    const state = { table, filters: [], selected: null };
    const builder = {
      select(value) { state.selected = value; return builder; },
      eq(field, value) { state.filters.push([field, value]); return builder; },
      in(field, values) { state.filters.push([field, values]); return builder; },
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

test("asset history receives bounded department and user labels", async () => {
  const fixture = makeDb();
  fixture.db.from = (table) => {
    const rows = table === "assets"
      ? [{ id: "asset-1", asset_name: "Laptop", status: "in_use" }]
      : table === "asset_assignments"
        ? [{ id: "assignment-1", asset_id: "asset-1", department_id: "dept-a", assignee_id: "user-a", status: "active", returned_at: null, assigned_at: "2026-10-10T09:30:00Z" }]
        : table === "departments" ? [{ id: "dept-a", name: "Phòng A" }] : [{ id: "user-a", full_name: "Người A" }];
    const builder = { select() { return builder; }, in(_field, ids) { builder.ids = ids; return builder; }, then(resolve) { resolve({ data: rows.filter((row) => !builder.ids || builder.ids.includes(row.id)), error: null }); } };
    return builder;
  };
  const result = await createAssetRepository(fixture.db).listAssetsForActor(actor);
  assert.equal(result.ok, true);
  assert.equal(result.data.assets[0].assignmentHistory[0].assigned_department_name, "Phòng A");
  assert.equal(result.data.assets[0].assignmentHistory[0].assignee_name, "Người A");
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

test("asset.view-only receives labels only for already-visible custody rows", async () => {
  const rows = {
    assets: [
      { id: "asset-visible", asset_name: "Laptop", category: "TSC", status: "in_use" },
      { id: "asset-hidden", asset_name: "Camera", category: "MMTB", status: "in_use" },
    ],
    asset_assignments: [
      { id: "assignment-visible", asset_id: "asset-visible", department_id: "dept-content", assignee_id: "user-manager", status: "active", returned_at: null },
      { id: "assignment-hidden", asset_id: "asset-hidden", department_id: "dept-other", assignee_id: "user-other", status: "active", returned_at: null },
    ],
    departments: [{ id: "dept-content", name: "Phòng Nội dung" }],
    staff_users: [{ id: "user-manager", full_name: "Hoàng Văn Mạnh" }],
  };
  const calls = [];
  const query = (table) => {
    const state = { table, ids: [] };
    const builder = {
      select() { return builder; },
      in(field, values) { state.field = field; state.ids = values; return builder; },
      then(resolve) {
        const data = (rows[table] ?? []).filter((row) => !state.ids.length || state.ids.includes(row.id));
        resolve({ data, error: null });
      },
    };
    calls.push(state);
    return builder;
  };
  const database = { from: query, rpc: async () => ({ data: null, error: null }) };
  const actor = { id: "manager", department_id: "dept-content", departmentId: "dept-content", isDepartmentManager: true, rbacPermissions: ["asset.view"] };
  const result = await createAssetRepository(database).listAssetsForActor(actor);
  assert.equal(result.ok, true);
  assert.equal(result.data.assets.length, 1);
  assert.partialDeepStrictEqual(result.data.assets[0], {
    assigned_department_name: "Phòng Nội dung",
    assignee_name: "Hoàng Văn Mạnh",
  });
  assert.deepEqual(calls.find((call) => call.table === "departments").ids, ["dept-content"]);
  assert.deepEqual(calls.find((call) => call.table === "staff_users").ids, ["user-manager"]);
});
