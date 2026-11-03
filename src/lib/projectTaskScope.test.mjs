import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { buildTaskListScope } from "./taskAuthorization.ts";

const source = readFileSync("src/lib/taskRepository.ts", "utf8");
const scopeSource = source.slice(source.indexOf("export const getTaskScopeTerms"), source.indexOf("export const taskRepository"));
const js = ts.transpileModule(scopeSource.replace("export const", "const"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const enabled of [false, true]) {
  test(`actual task scope includes only member projects (v2=${enabled})`, async () => {
    let membershipError = null;
    const db = { from(table) { const q = { select: () => q, eq: () => q, then(resolve) { resolve(table === "project_members" ? { data: [{ project_id: "p1" }], error: membershipError } : { data: [{ task_id: "direct" }], error: null }); } }; return q; } };
    const scope = new Function("serverSupabase", "isTaskRbacV2Enabled", "loadRbacActor", "buildTaskListScope", "hasOrganizationTaskView", "ok", "fail", `${js}; return getTaskScopeTerms;`)(db, () => enabled, async () => ({ id: "ctv", departmentId: "other", grants: [{ permissionCode: "task.view", scope: "assigned" }] }), buildTaskListScope, () => false, (data) => ({ ok: true, data }), (error) => ({ ok: false, error }));
    const actor = { id: "ctv", departmentId: "other", permissions: { can_view_department_tasks: false } };
    const value = await scope(actor);
    assert.equal(value.ok, true);
    assert.ok(value.data.includes("project_id.in.(p1)"));
    assert.ok(value.data.includes("id.in.(direct)"));
    assert.ok(!value.data.some((term) => term.startsWith("department_id")));
    membershipError = { code: "DB_DOWN" };
    assert.deepEqual(await scope(actor), { ok: false, error: { code: "DB_DOWN" } });
  });
}
