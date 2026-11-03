import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { buildTaskListScope } from "./taskAuthorization.ts";
import { isCollaboratorRole } from "./collaboratorRole.mjs";

const source = readFileSync("src/lib/taskRepository.ts", "utf8");
const scopeSource = source.slice(source.indexOf("export const getTaskScopeTerms"), source.indexOf("export const taskRepository"));
const js = ts.transpileModule(scopeSource.replace("export const", "const"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const enabled of [false, true]) for (const roleCode of ["nhan_vien", "cong_tac_vien"]) {
  test(`actual task scope includes only member projects (v2=${enabled}, role=${roleCode})`, async () => {
    let membershipError = null;
    const db = { from(table) { const q = { select: () => q, eq: () => q, then(resolve) { resolve(table === "project_members" ? { data: [{ project_id: "p1" }], error: membershipError } : { data: [{ task_id: "direct" }], error: null }); } }; return q; } };
    const scope = new Function("serverSupabase", "isTaskRbacV2Enabled", "loadRbacActor", "buildTaskListScope", "hasOrganizationTaskView", "ok", "fail", "isCollaboratorRole", `${js}; return getTaskScopeTerms;`)(db, () => enabled, async () => ({ id: "ctv", departmentId: "other", grants: [{ permissionCode: "task.view", scope: "assigned" }] }), buildTaskListScope, () => false, (data) => ({ ok: true, data }), (error) => ({ ok: false, error }), isCollaboratorRole);
    const actor = { id: "ctv", roleCode, departmentId: "other", permissions: { can_view_department_tasks: roleCode === "cong_tac_vien" } };
    const value = await scope(actor);
    assert.equal(value.ok, true);
    assert.ok(value.data.includes("project_id.in.(p1)"));
    assert.ok(value.data.includes("id.in.(direct)"));
    assert.ok(!value.data.some((term) => term.startsWith("department_id")));
    if (roleCode === "cong_tac_vien") {
      assert.ok(!value.data.some((term) => /^(created_by|owner_id)/.test(term)));
    }
    membershipError = { code: "DB_DOWN" };
    assert.deepEqual(await scope(actor), { ok: false, error: { code: "DB_DOWN" } });
  });
}
