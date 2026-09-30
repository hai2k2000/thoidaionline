import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("duty Excel import is admin-only and supports preview before the transactional save", () => {
  const route = readFileSync("src/app/api/tasks/duty/import/route.ts", "utf8");
  assert.match(route, /requireMutationActor/);
  assert.match(route, /role_code !== "admin"/);
  assert.match(route, /mode.*confirm/);
  assert.match(route, /dutyTaskRepository\.save/);
  assert.match(route, /summarizeDutyImport/);
  assert.match(route, /MAX_FILE_BYTES/);
});
