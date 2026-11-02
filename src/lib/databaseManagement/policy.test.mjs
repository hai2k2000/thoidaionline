import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessRecordType,
  canApproveRestricted,
  canContributeRestricted,
  canSeeRestricted,
  SENSITIVE_RECORD_PERMISSION,
} from "./policy.ts";

test("restricted category grant matrix", () => {
  const admin = { rbacPermissions: ["record.create", SENSITIVE_RECORD_PERMISSION] };
  const userA = { rbacPermissions: ["record.create"] };
  const userB = { rbacPermissions: ["record.create"] };
  const userC = { rbacPermissions: ["record.create"] };

  assert.equal(canSeeRestricted(admin, null), true);
  assert.equal(canContributeRestricted(admin, null), true);
  assert.equal(canApproveRestricted(admin, null), true);
  assert.equal(canSeeRestricted(userA, "view"), true);
  assert.equal(canContributeRestricted(userA, "view"), false);
  assert.equal(canApproveRestricted(userA, "view"), false);
  assert.equal(canSeeRestricted(userB, "approve"), true);
  assert.equal(canContributeRestricted(userB, "approve"), true);
  assert.equal(canApproveRestricted(userB, "approve"), true);
  assert.equal(canSeeRestricted(userB, null), false);
  assert.equal(canSeeRestricted(userC, null), false);
  assert.equal(canAccessRecordType(userC, "phap_ly_to_chuc_hoat_dong"), true);
});
