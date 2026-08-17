import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PERMISSION_KEYS,
  normalizePermissions,
} from "./permissions.ts";

test("permission normalization returns the complete stable contract", () => {
  const permissions = normalizePermissions({
    can_assign_task: true,
    can_evaluate_step2: 1,
  });

  assert.deepEqual(Object.keys(permissions), [...PERMISSION_KEYS]);
  assert.equal(permissions.can_assign_task, true);
  assert.equal(permissions.can_evaluate_step2, false);
  assert.equal(permissions.can_manage_rubrics, false);
  assert.equal(permissions.can_manage_users, false);
});

test("server session selects role level, department and every new permission", () => {
  const source = readFileSync(
    new URL("./serverSession.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /department_id/);
  assert.match(source, /department_id:\s*string\s*\|\s*null/);
  assert.doesNotMatch(source, /!row\.department_id/);
  assert.match(source, /role_level/);
  for (const key of [
    "can_assign_task",
    "can_view_department_tasks",
    "can_evaluate_step1",
    "can_evaluate_step2",
    "can_manage_rubrics",
  ]) {
    assert.match(source, new RegExp(key));
  }
  assert.match(source, /session\.sessionVersion\s*!==\s*row\.session_version/);
  assert.match(source, /normalizePermissions/);
});
