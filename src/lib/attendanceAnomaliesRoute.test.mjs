import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/api/attendance/anomalies/route.ts", import.meta.url), "utf8");

test("anomaly route enforces manager access and input limits", () => {
  assert.match(source, /resolveAttendanceAccess\(guard\.actor\)/);
  assert.match(source, /!access\.canManage/);
  assert.match(source, /93/);
  assert.match(source, /threshold.*120/s);
});

test("anomaly route is read-only, department scoped, and FK hinted", () => {
  assert.doesNotMatch(source, /\.(?:insert|update|delete|rpc)\s*\(/);
  assert.match(source, /access\.orgScope === "department"/);
  assert.doesNotMatch(source, /(?<![:!])staff_users\s*\(/);
  assert.match(source, /departments!staff_users_department_id_fkey/);
});

test("anomaly route supports xlsx responses", () => {
  assert.match(source, /format.*xlsx/s);
  assert.match(source, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
});
