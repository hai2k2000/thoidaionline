import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const navSource = fs.readFileSync(
  new URL("./AppNav.tsx", import.meta.url),
  "utf8",
);
const authSource = fs.readFileSync(
  new URL("../lib/auth.tsx", import.meta.url),
  "utf8",
);

test("sidebar consumes the canonical Phase-2 navigation policy", () => {
  assert.match(navSource, /getPhase2Navigation/);
  assert.match(navSource, /can_assign_task/);
  assert.match(navSource, /can_evaluate_step1/);
  assert.match(navSource, /can_evaluate_step2/);
  assert.match(navSource, /can_manage_rubrics/);
  assert.doesNotMatch(navSource, /groups\.map|tasks\/active|planning\/reports|href="\/performance"/);
});

test("sidebar implements the required off-canvas accessibility contract", () => {
  assert.match(navSource, /role="dialog"/);
  assert.match(navSource, /aria-modal="true"/);
  assert.match(navSource, /Escape/);
  assert.match(navSource, /restoreMenuFocus/);
  assert.match(navSource, /lg:w-\[232px\]/);
});

test("client permission DTO includes every Phase-1 navigation permission", () => {
  assert.match(authSource, /PermissionSet/);
  assert.match(authSource, /can_assign_task/);
  assert.match(authSource, /can_evaluate_step1/);
  assert.match(authSource, /can_evaluate_step2/);
  assert.match(authSource, /can_manage_rubrics/);
});
