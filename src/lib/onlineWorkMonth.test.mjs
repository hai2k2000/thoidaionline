import assert from "node:assert/strict";
import test from "node:test";

import { lastDayOfMonth } from "./onlineWorkMonth.ts";

test("lastDayOfMonth returns the deterministic calendar boundary", () => {
  assert.equal(lastDayOfMonth("2026-09"), "2026-09-30");
  assert.equal(lastDayOfMonth("2026-04"), "2026-04-30");
  assert.equal(lastDayOfMonth("2026-06"), "2026-06-30");
  assert.equal(lastDayOfMonth("2026-11"), "2026-11-30");
  assert.equal(lastDayOfMonth("2026-02"), "2026-02-28");
  assert.equal(lastDayOfMonth("2028-02"), "2028-02-29");
  assert.equal(lastDayOfMonth("2026-01"), "2026-01-31");
});

test("lastDayOfMonth rejects invalid month input", () => {
  assert.throws(() => lastDayOfMonth("2026-13"), /invalid month/);
  assert.throws(() => lastDayOfMonth("2026-2"), /invalid month/);
});
