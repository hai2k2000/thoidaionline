import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

async function loadRepository(db) {
  assert.ok(existsSync("src/lib/projectRepository.ts"), "project repository exists");
  const source = readFileSync("src/lib/projectRepository.ts", "utf8")
    .replace(/import "server-only";/, "")
    .replace(/import \{ serverSupabase \} from "@\/lib\/serverSupabase";/, "const serverSupabase = globalThis.__projectTestDb;");
  globalThis.__projectTestDb = db;
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return (await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}#${Math.random()}`)).projectRepository;
}

test("project wrappers preserve actor, participants, nullable reviewer and RPC failures", async () => {
  const calls = [];
  const repo = await loadRepository({ rpc: async (name, args) => { calls.push({ name, args }); return name === "api_close_project" ? { error: { code: "42501" } } : { data: { id: "result" }, error: null }; } });
  assert.deepEqual(await repo.create("actor", { code: "VIDEO", name: "Video", description: null, hostDepartmentId: "host", leadIds: ["lead"] }), { ok: true, data: { id: "result" } });
  assert.deepEqual(calls[0], { name: "api_create_project", args: { p_actor_id: "actor", p_code: "VIDEO", p_name: "Video", p_description: null, p_host_department_id: "host", p_lead_ids: ["lead"] } });
  await repo.assignTask("lead", "project", { title: "Script", description: "Requirements", assigneeId: "ctv", dueDate: "2026-11-10", dueTime: "17:00", collaboratorIds: ["other"], watcherIds: ["watcher"] });
  assert.equal(calls[1].name, "api_assign_project_task");
  assert.equal(calls[1].args.p_project_id, "project");
  assert.equal(calls[1].args.p_reviewer_id, null);
  assert.deepEqual(calls[1].args.p_collaborator_ids, ["other"]);
  assert.deepEqual(calls[1].args.p_watcher_ids, ["watcher"]);
  assert.equal(calls[1].args.p_priority, "normal");
  await repo.setMember("lead", "project", "ctv", null);
  assert.equal(calls[2].args.p_remove, true);
  assert.deepEqual(await repo.close("lead", "project"), { ok: false, error: { code: "42501" } });
  await repo.update("lead", "project", { code: "VIDEO", name: "Updated", hostDepartmentId: "host" });
  assert.deepEqual(calls[4], { name: "api_update_project", args: { p_actor_id: "lead", p_project_id: "project", p_code: "VIDEO", p_name: "Updated", p_description: null, p_host_department_id: "host" } });
});

test("member lists are scoped to memberships and task filters never replace project scope", async () => {
  const calls = [];
  const db = { from(table) {
    const q = { select(value) { calls.push([table, "select", value]); return q; }, eq(key, value) { calls.push([table, key, value]); return q; }, in(key, value) { calls.push([table, key, value]); return q; }, order() { return q; }, maybeSingle: async () => ({ data: { user_id: "member" }, error: null }), then(resolve) { resolve({ data: table === "project_members" ? [{ project_id: "only-project" }] : [], error: null }); } };
    return q;
  } };
  const repo = await loadRepository(db);
  await repo.list({ id: "member", roleCode: "nhan_vien" });
  assert.ok(calls.some(([table, key, value]) => table === "projects" && key === "id" && value[0] === "only-project"));
  await repo.listTasks({ id: "member", roleCode: "nhan_vien" }, "only-project", { status: "done", assigneeId: "worker" });
  assert.ok(calls.some(([table, key, value]) => table === "tasks" && key === "project_id" && value === "only-project"));
  assert.ok(calls.some(([table, key, value]) => table === "tasks" && key === "status" && value === "done"));
  assert.ok(calls.some(([table, key, value]) => table === "tasks" && key === "assignee_id" && value === "worker"));
});

test("project reads fail closed before fetching tasks of a nonmember's project", async () => {
  const calls = [];
  const db = { from: (table) => { calls.push(table); const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null, error: null }) }; return q; } };
  const repo = await loadRepository(db);
  assert.deepEqual(await repo.listTasks({ id: "outsider", roleCode: "nhan_vien" }, "project"), { ok: false, error: { code: "42501" } });
  assert.deepEqual(calls, ["project_members"]);
});
