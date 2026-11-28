import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

function load(path, dependencies = {}) {
  const source = stripTypeScriptTypes(readFileSync(path, "utf8"));
  const names = [...source.matchAll(/export (?:async )?function (\w+)/g)].map((match) => match[1]);
  const code = source.replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  return new Function(...Object.keys(dependencies), `${code}\nreturn {${names.join(",")}};`)(...Object.values(dependencies));
}

const base = "src/lib/databaseManagement/";
const acl = load(`${base}acl.ts`);
const policy = load(`${base}policy.ts`);
const validation = load(`${base}validation.ts`);
const departmentOnly = load(`${base}departmentOnlyTypes.mjs`);

function database({ status = "draft", aclRows = [] } = {}) {
  const record = { id: "r1", category_id: "c1", record_type_id: "t1", record_code: "R1", title: "Old", summary: null, status, department_id: "d1", owner_id: "owner", created_by: "owner", metadata: {}, visibility: "public", record_type_code: "ordinary", created_at: "now", updated_at: "now" };
  const tables = { db_records: [record], db_categories: [{ id: "c1", restricted: false }], db_record_acl: aclRows.map((row) => ({ record_id: "r1", ...row })), staff_users: [{ id: "admin", role_id: "admin-role" }], db_category_editors: [], db_record_history: [], departments: [], db_record_keywords: [], db_record_external_links: [] };
  const client = { from(table) {
    let operation = "select", payload, single = false;
    const filters = [];
    const query = { select() { return query; }, eq(key, value) { filters.push((row) => row[key] === value); return query; }, maybeSingle() { single = true; return query; }, single() { single = true; return query; }, insert(value) { operation = "insert"; payload = value; return query; }, update(value) { operation = "update"; payload = value; return query; }, then(resolve) { let rows = (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row))); if (operation === "update") rows.forEach((row) => Object.assign(row, payload)); if (operation === "insert") { rows = [{ id: `h${tables.db_record_history.length + 1}`, ...payload }]; tables[table].push(...rows); } return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve); } };
    return query;
  } };
  const repository = load(`${base}repository.ts`, { serverSupabase: client, ...acl, ...policy, ...validation, ...departmentOnly, languageCodeForCategory: () => null });
  return { repository, tables };
}

const admin = { id: "admin", department_id: "d1", role_code: "admin", rbacPermissions: ["record.discover", "record.edit", "record.delete", "record.restore"] };
const nonAdmin = { ...admin, id: "staff", role_code: "staff", rbacPermissionScopes: { "record.edit": ["all"], "record.delete": ["all"] } };

for (const status of ["draft", "approved"]) {
  test(`admin can edit and delete ${status} records, and restore keeps approved status`, async () => {
    const db = database({ status });
    await db.repository.updateDatabaseRecord(admin, "r1", { title: "Admin edit" });
    assert.equal(db.tables.db_records[0].title, "Admin edit");
    await db.repository.setDatabaseRecordStatus(admin, "r1", "deleted");
    await db.repository.setDatabaseRecordStatus(admin, "r1", "draft");
    assert.equal(db.tables.db_records[0].status, "draft");
    if (status === "approved") {
      const approved = database({ status: "approved" });
      await approved.repository.updateDatabaseRecord(admin, "r1", { title: "Approved edit" });
      assert.equal(approved.tables.db_records[0].status, "approved");
    }
  });
}

test("admin ACL deny blocks the denied capability", async () => {
  for (const capability of ["edit", "delete", "restore"]) {
    const db = database({ status: capability === "restore" ? "deleted" : "draft", aclRows: [{ capability, effect: "deny", principal_type: "user", principal_id: "admin" }] });
    const action = capability === "edit" ? db.repository.updateDatabaseRecord(admin, "r1", { title: "blocked" }) : db.repository.setDatabaseRecordStatus(admin, "r1", capability === "delete" ? "deleted" : "draft");
    await assert.rejects(action, /permission_denied/);
  }
});

test("scope all does not grant a non-admin ownership bypass", async () => {
  const db = database();
  await assert.rejects(db.repository.updateDatabaseRecord(nonAdmin, "r1", { title: "blocked" }), /permission_denied/);
  await assert.rejects(db.repository.setDatabaseRecordStatus(nonAdmin, "r1", "deleted"), /permission_denied/);
});
