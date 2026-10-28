import assert from "node:assert/strict";
import test from "node:test";
import { canAccessRecordType, canAccessSensitiveRecordType, isSensitiveRecordType, isSensitiveRecordTypeCode, SENSITIVE_RECORD_PERMISSION } from "./policy.ts";

test("sensitive record types are denied by default, including technical admin", () => {
  assert.equal(isSensitiveRecordTypeCode("ho_so_dang"), true);
  assert.equal(canAccessRecordType({ rbacPermissions: ["record.discover"] }, "ho_so_dang"), false);
  assert.equal(canAccessRecordType({ rbacPermissions: ["record.discover"] }, "van_ban_den"), true);
});

test("sensitive access requires an explicit owner-approved permission", () => {
  assert.equal(canAccessSensitiveRecordType({ rbacPermissions: ["record.discover"] }), false);
  assert.equal(canAccessSensitiveRecordType({ rbacPermissions: [SENSITIVE_RECORD_PERMISSION] }), true);
});

test("category-based sensitivity covers new types and stays fail-closed", () => {
  assert.equal(isSensitiveRecordType("dang_dai_hoi", "doan_the_quan_ly"), true);
  assert.equal(canAccessRecordType({ rbacPermissions: [] }, "dang_dai_hoi", "doan_the_quan_ly"), false);
  assert.equal(canAccessRecordType({ rbacPermissions: [SENSITIVE_RECORD_PERMISSION] }, "dang_dai_hoi", "doan_the_quan_ly"), true);
});
