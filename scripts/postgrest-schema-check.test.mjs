import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("PostgREST check is read-only and checks required fields/RPC visibility", () => {
  const source = readFileSync("scripts/check-postgrest-schema.mjs", "utf8");
  assert.match(source, /rest\/v1/);
  assert.match(source, /approval_required/);
  assert.match(source, /api_review_personal_work_schedule/);
  assert.doesNotMatch(source, /db push|reset|migrate repair/i);
});
