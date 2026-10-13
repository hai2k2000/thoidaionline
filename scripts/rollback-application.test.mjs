import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/production/rollback-application.sh", "utf8");

test("rollback can restore the complete lifecycle pointer snapshot", () => {
  for (const name of ["THOIDAI_ROLLBACK_CURRENT_TARGET", "THOIDAI_ROLLBACK_PREVIOUS_TARGET", "THOIDAI_ROLLBACK_1_TARGET", "THOIDAI_ROLLBACK_2_TARGET"]) {
    assert.match(source, new RegExp(name));
  }
  assert.match(source, /set_link "\$current_target" current/);
  assert.match(source, /set_link "\$previous_target" previous/);
  assert.match(source, /set_link "\$rollback_1_target" rollback-1/);
  assert.match(source, /set_link "\$rollback_2_target" rollback-2/);
  assert.match(source, /flock -n 9/);
});
