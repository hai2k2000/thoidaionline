import assert from "node:assert/strict";
import test from "node:test";
import { canAccessDatabaseRecord, defaultDatabaseRecordAccess } from "./acl.ts";
import { validateDatabaseRecordInput } from "./validation.ts";

const ids = { categoryId: "11111111-1111-4111-8111-111111111111", recordTypeId: "22222222-2222-4222-8222-222222222222" };

test("record input requires controlled identifiers and metadata object", () => {
  const result = validateDatabaseRecordInput({ ...ids, recordCode: "VB/01", title: "Văn bản", metadata: { issuedAt: "2026-10-17" }, externalLinks: [{ provider: "google_drive", url: "https://drive.google.com/file/d/abc" }] });
  assert.equal(result.ok, true);
});

test("record ACL gives explicit deny precedence over allow", () => {
  const actor = { id: "u1", roleId: "r1", departmentId: "d1", permissionCodes: ["record.download"] };
  assert.equal(canAccessDatabaseRecord(actor, [
    { principal_type: "role", principal_id: "r1", capability: "download", effect: "allow" },
    { principal_type: "user", principal_id: "u1", capability: "download", effect: "deny" },
  ], "download"), false);
});

test("record owner fallback never bypasses missing catalog permission", () => {
  assert.equal(defaultDatabaseRecordAccess({ id: "u1", permissionCodes: [] }, "download", "u1", null), false);
  assert.equal(defaultDatabaseRecordAccess({ id: "u1", permissionCodes: ["record.download"] }, "download", "u1", null), true);
});
