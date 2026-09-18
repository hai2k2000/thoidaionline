import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/tasks/[id]/journalism/route.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260918120000_journalism_tasks_j3_mutations.sql",
);

test("metadata API exposes only the approved J3 v1 fields", () => {
  assert.match(route, /new Set\(\["workKindId", "plannedPublicationAt", "location", "editorialNotes"\]\)/);
  assert.doesNotMatch(route, /body\.expectedUpdatedAt/);
  assert.match(route, /p_expected_updated_at:\s*null/);
});

test("metadata contract fix leaves the approved migration byte-identical", () => {
  assert.equal(
    createHash("sha256").update(migration).digest("hex"),
    "38a60fc0056a4c0479a5062c412fb5c3a065e15dac6aef30f957690a6efd4ad3",
  );
});
