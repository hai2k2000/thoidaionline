import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canAccessDatabaseRecord, defaultDatabaseRecordAccess } from "./acl.ts";
import { validateDatabaseAclInput, validateDatabaseMetadata, validateDatabaseRecordInput, validateDatabaseRecordUpdateInput } from "./validation.ts";

const ids = { categoryId: "11111111-1111-4111-8111-111111111111", recordTypeId: "22222222-2222-4222-8222-222222222222" };

test("record input requires controlled identifiers and metadata object", () => {
  const result = validateDatabaseRecordInput({ ...ids, recordCode: "VB/01", title: "Văn bản", metadata: { issuedAt: "2026-10-17" }, externalLinks: [{ provider: "google_drive", url: "https://drive.google.com/file/d/abc" }] });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.recordCode, undefined);
});

test("record input accepts the Russian language code", () => {
  const result = validateDatabaseRecordInput({
    categoryId: "11111111-1111-4111-8111-111111111111",
    recordTypeId: "22222222-2222-4222-8222-222222222222",
    title: "Hồ sơ tiếng Nga",
    metadata: {},
    languageCode: "ru",
  });
  assert.equal(result.ok, true);
});

test("record creation does not require a client-supplied code", () => {
  const result = validateDatabaseRecordInput({ ...ids, title: "Ho so tu cap ma", metadata: {} });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.recordCode, undefined);
});

test("metadata validation precedes server code allocation", () => {
  const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
  assert.ok(repository.indexOf("await validateFormMetadata(form?.id") < repository.indexOf("api_next_database_record_code"));
});

test("record updates do not accept record code changes", () => {
  const result = validateDatabaseRecordUpdateInput({ recordCode: "HS-2026-000002", title: "Doi ten" });
  assert.equal(result.ok, true);
  assert.equal(result.ok && "recordCode" in result.value, false);
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

test("record ACL deny also overrides owner fallback", () => {
  const actor = { id: "u1", roleId: null, departmentId: null, permissionCodes: ["record.download"] };
  assert.equal(canAccessDatabaseRecord(actor, [{ principal_type: "user", principal_id: "u1", capability: "download", effect: "deny" }], "download"), false);
});

test("dynamic metadata enforces required fields, options, limits and rejects unknown keys", () => {
  const fields = [
    { field_key: "status", data_type: "select", required: true, options: [{ value: "draft" }], validation: {} },
    { field_key: "keywords", data_type: "multi_select", required: false, options: [], validation: { maxItems: 2 } },
  ];
  const errors = validateDatabaseMetadata({ status: "approved", keywords: ["a", "b", "c"], extra: true }, fields);
  assert.deepEqual(errors.map((error) => error.code).sort(), ["invalid_option", "max_items", "unknown_field"]);
});

test("server metadata validation skips required for hidden fields but still type-checks them", () => {
  const fields = [{ field_key: "legacy_field", data_type: "text", required: true, hidden: true }];
  assert.deepEqual(validateDatabaseMetadata({}, fields), []);
  assert.deepEqual(validateDatabaseMetadata({ legacy_field: "kept" }, fields), []);
  assert.notDeepEqual(validateDatabaseMetadata({ legacy_field: { preserved: true } }, fields), []);
});

test("ACL expiry is validated as a datetime", () => {
  const base = { principalType: "user", principalId: "11111111-1111-4111-8111-111111111111", capability: "download", effect: "allow" };
  assert.equal(validateDatabaseAclInput({ ...base, expiresAt: "not-a-date" }).ok, false);
  assert.equal(validateDatabaseAclInput({ ...base, expiresAt: "2030-01-01T00:00:00Z" }).ok, true);
});

test("record list contract exposes the child category name separately", () => {
  const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../../app/database/records/page.tsx", import.meta.url), "utf8");
  assert.ok(repository.includes('subcategory_name?: string | null;'));
  assert.ok(repository.includes('subcategory_name: categoryById.get(row.category_id)?.parent_id ? categoryById.get(row.category_id)?.name ?? null : null'));
  assert.ok(page.includes('subcategory_name?: string | null;'));
  assert.ok(page.includes('}{row.subcategory_name ? \u0060 \u203a \u0024{row.subcategory_name}\u0060 : ""} \u00b7 {presentRecordType'));
});
