import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/lib/rbac/approval.ts", "utf8");

test("approval capability helper uses the database capability RPC", () => {
  assert.match(source, /api_get_approval_capabilities/);
  assert.match(source, /p_actor:\s*actorId/);
  assert.match(source, /scopes\.length\s*>\s*0/);
  assert.match(source, /leaveLongTbt/);
});
