import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync("scripts/production/attendance-v1-dryrun.sh", "utf8");
const behaviour = readFileSync("supabase/tests/attendance_v1_behaviour.sql", "utf8");

test("attendance dry-run has approval, cleanup, scoped container, and no secret echo", () => {
  assert.match(script, /THOIDAI_ATTENDANCE_DRYRUN_APPROVED/);
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /attendance-dryrun-/);
  assert.match(script, /docker ps -a --format/);
  assert.match(script, /disk-guard\.sh/);
  assert.doesNotMatch(script, /echo\s+"\$(?:db_password|ATTENDANCE_DB_URL)"/i);
  assert.doesNotMatch(script, /set -x/);
});

test("attendance dry-run records revert order and md5 restoration", () => {
  const order = [
    "attendance-workday-adjustments-revert.sql",
    "attendance-late-exception-review-revert.sql",
    "attendance-rbac-v1-revert.sql",
  ];
  let previous = -1;
  for (const file of order) {
    const index = script.indexOf(file);
    assert.ok(index > previous, `${file} must be in reverse migration order`);
    previous = index;
  }
  assert.match(script, /post-rbac-md5\.txt/);
  assert.match(script, /diff\s+-u|cmp\s+-s/);
  assert.match(script, /attendance\.%/);
});

test("expected_pass equals SQL PASS emitters", () => {
  const expected = [...behaviour.matchAll(/raise notice\s+'ATT_TEST_PASS\b/gi)].length;
  const match = script.match(/expected_pass=(\d+)/);
  assert.ok(match, "expected_pass constant is required");
  assert.equal(Number(match[1]), expected);
  assert.ok(expected > 0);
});

test("behaviour suite is transactional and non-aborting", () => {
  assert.match(behaviour.trim().toLowerCase(), /^begin;/);
  assert.match(behaviour.trim().toLowerCase(), /rollback;$/);
  assert.doesNotMatch(behaviour, /raise exception 'ATT_TEST_FAIL/);
  assert.match(behaviour, /zz_att_test_/);
});
