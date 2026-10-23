import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../../app/api/database/records/[id]/workflow/route.ts", import.meta.url), "utf8");

test("workflow route does not duplicate server audit on idempotent replay", () => {
  assert.match(route, /result\.replayed\s*\?\s*["']replayed["']/);
  assert.match(route, /logServerAudit/);
});
