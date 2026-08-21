import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260821190000_department_manager_assignment.sql", "utf8");
const authorization = readFileSync("src/lib/authorization.ts", "utf8");
const repository = readFileSync("src/lib/taskAssignmentRepository.ts", "utf8");

test("department managers receive assignment and department view permissions", () => {
  assert.match(migration, /truong_phong/);
  assert.match(migration, /can_assign_task\s*=\s*true/);
  assert.match(migration, /can_view_department_tasks\s*=\s*true/);
});

test("manager assignment remains limited to the actor department", () => {
  assert.match(authorization, /departmentId === actor\.departmentId/);
  assert.match(repository, /departmentsQuery = departmentsQuery\.eq\("id", actor\.departmentId\)/);
  assert.match(repository, /row\.department_id === actor\.departmentId/);
});
