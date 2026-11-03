import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import * as validation from "./validation.ts";
import * as language from "./languageGroup.mjs";
import * as department from "./departmentOnlyTypes.mjs";

function load(name, dependencies = {}) {
  const source = stripTypeScriptTypes(readFileSync(new URL(name, import.meta.url), "utf8"));
  const names = [...source.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1]);
  const code = source.replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  return new Function(...Object.keys(dependencies), `${code}\nreturn {${names.join(",")}};`)(...Object.values(dependencies));
}
const actor = { id: "u1", department_id: "d1", rbacPermissions: ["record.create", "record.discover", "record.edit"], rbacPermissionScopes: {} };
const input = { categoryId: "11111111-1111-4111-8111-111111111111", recordTypeId: "22222222-2222-4222-8222-222222222222", title: "Record", metadata: {} };
const link = { provider: "google_drive", url: "https://drive.google.com/file/d/new", mediaKind: "video" };

for (const [name, validate] of [["create", (patch) => validation.validateDatabaseRecordInput({ ...input, ...patch })], ["update", validation.validateDatabaseRecordUpdateInput]]) {
  test(`${name} accepts editable keywords and links`, () => {
    const result = validate({ keywords: [" Alpha ", "alpha", "Beta"], externalLinks: [link] });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.keywords, [" Alpha ", "alpha", "Beta"]);
    assert.deepEqual(result.value.externalLinks, [link]);
    for (const keywords of [null, "word", [42], [""], [" "] , ["x".repeat(121)]]) assert.equal(validate({ keywords }).ok, false);
  });
  test(`${name} restricts external links to HTTPS Google Drive/Docs hosts`, () => {
    for (const url of ["https://drive.google.com/file/d/a", "https://docs.google.com/document/d/a", "https://docs.google.com:443/a"]) {
      assert.equal(validate({ externalLinks: [{ ...link, url }] }).ok, true, url);
    }
    for (const url of ["https://evil.test", "https://drive.google.com.evil.test/a", "https://evil.test/drive.google.com", "http://drive.google.com/a", "https://user@drive.google.com/a", "https://user:pass@docs.google.com/a", "https://drive.google.com:444/a", "https://", "not a URL"]) {
      assert.equal(validate({ externalLinks: [{ ...link, url }] }).ok, false, url);
    }
    for (const externalLinks of [null, {}, [null], [{ ...link, provider: "other" }]]) assert.equal(validate({ externalLinks }).ok, false);
  });
}

function database(fail = () => false) {
  const tables = {
    db_records: [{ id: "r1", category_id: input.categoryId, record_type_id: input.recordTypeId, title: "Old", summary: null, status: "approved", owner_id: "u1", created_by: "u1", department_id: "d1", metadata: { keywords: ["Old"] }, visibility: "department" }],
    db_categories: [{ id: input.categoryId, code: "ordinary", active: true, restricted: false }],
    db_record_types: [{ id: input.recordTypeId, category_id: input.categoryId, code: "ordinary", active: true }],
    staff_users: [{ id: "u1", role_id: "role1" }], departments: [{ id: "d1" }], db_record_acl: [], db_form_definitions: [],
    db_record_keywords: [{ record_id: "r1", keyword: "Old" }],
    db_record_external_links: [{ id: "l1", record_id: "r1", provider: "google_drive", url: "https://docs.google.com/old", created_by: "u1", link_status: "active" }],
    db_record_history: [{ id: "old-history", record_id: "r1", action: "create" }],
  };
  let sequence = 0;
  const client = { rpc: async () => ({ data: "HS-1", error: null }), from(table) {
    let operation = "select", payload, single = false;
    const filters = [];
    const query = {
      select() { return query; }, eq(key, value) { filters.push((row) => row[key] === value); return query; },
      order() { return query; }, limit() { return query; },
      maybeSingle() { single = true; return query; }, single() { single = true; return query; },
      insert(value) { operation = "insert"; payload = value; return query; },
      update(value) { operation = "update"; payload = value; return query; },
      delete() { operation = "delete"; return query; },
      then(resolve, reject) {
        try {
          if (fail({ table, operation, payload })) return Promise.resolve({ data: null, error: new Error("injected_failure") }).then(resolve, reject);
          let rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
          if (operation === "insert") {
            rows = (Array.isArray(payload) ? payload : [payload]).map((row) => ({ ...(table === "db_record_keywords" ? {} : { id: `new-${++sequence}` }), ...row }));
            tables[table].push(...rows);
          }
          if (operation === "update") rows.forEach((row) => Object.assign(row, payload));
          if (operation === "delete") tables[table] = tables[table].filter((row) => !rows.includes(row));
          return Promise.resolve({ data: single ? structuredClone(rows[0] ?? null) : structuredClone(rows), count: rows.length, error: null }).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return query;
  } };
  const repository = load("repository.ts", { serverSupabase: client, ...load("acl.ts"), ...load("policy.ts"), ...validation, ...language, ...department });
  return { tables, repository };
}

for (const metadataKeywords of [[" Alpha ", "alpha", "", " Beta "], " Alpha, alpha; ;Beta\n"]) {
  for (const operation of ["create", "update"]) test(`${operation} indexes normalized metadata keywords: ${JSON.stringify(metadataKeywords)}`, async () => {
    const { tables, repository } = database();
    const patch = { metadata: { keywords: metadataKeywords } };
    const result = operation === "create"
      ? await repository.createDatabaseRecord(actor, validation.validateDatabaseRecordInput({ ...input, ...patch }).value)
      : await repository.updateDatabaseRecord(actor, "r1", validation.validateDatabaseRecordUpdateInput(patch).value);
    assert.deepEqual(tables.db_record_keywords.filter((row) => row.record_id === result.id).map((row) => row.keyword), ["Alpha", "Beta"]);
  });
}

test("update replaces explicit keywords and links and audits their values", async () => {
  const { tables, repository } = database();
  await repository.updateDatabaseRecord(actor, "r1", { keywords: [" Explicit ", "explicit", ""], metadata: { keywords: ["Ignored"] }, externalLinks: [link] });
  assert.deepEqual(tables.db_record_keywords, [{ record_id: "r1", keyword: "Explicit" }]);
  assert.equal(tables.db_record_external_links.length, 1);
  assert.equal(tables.db_record_external_links[0].url, link.url);
  const history = tables.db_record_history.find((row) => row.action === "update");
  assert.deepEqual(history.old_data.keywords, ["Old"]);
  assert.deepEqual(history.new_data.keywords, ["Explicit"]);
  assert.equal(history.old_data.externalLinks[0].id, "l1");
  assert.equal(history.new_data.externalLinks[0].url, link.url);
});

test("omitted relations stay unchanged and empty values clear relations", async () => {
  const { tables, repository } = database();
  const previous = structuredClone(tables);
  await repository.updateDatabaseRecord(actor, "r1", { title: "Renamed" });
  assert.deepEqual(tables.db_record_keywords, previous.db_record_keywords);
  assert.deepEqual(tables.db_record_external_links, previous.db_record_external_links);
  await repository.updateDatabaseRecord(actor, "r1", { metadata: { keywords: "" }, externalLinks: [] });
  assert.deepEqual(tables.db_record_keywords, []);
  assert.deepEqual(tables.db_record_external_links, []);
});

for (const failure of ["keyword_read", "link_read", "keyword_delete", "keyword_insert", "link_delete", "link_insert", "reopen_for_edit", "update"]) {
  test(`${failure} failure restores record, keywords, complete link rows and history`, async () => {
    let failed = false;
    const { tables, repository } = database(({ table, operation, payload }) => {
      const step = table === "db_record_keywords" ? `keyword_${operation === "select" ? "read" : operation}` : table === "db_record_external_links" ? `link_${operation === "select" ? "read" : operation}` : payload?.action;
      if (!failed && step === failure) { failed = true; return true; }
      return false;
    });
    const previous = structuredClone(tables);
    await assert.rejects(repository.updateDatabaseRecord(actor, "r1", { title: "Changed", metadata: { keywords: ["New"] }, externalLinks: [link] }), /injected_failure/);
    for (const table of ["db_records", "db_record_keywords", "db_record_external_links", "db_record_history"]) assert.deepEqual(tables[table], previous[table], table);
  });
}

test("create cleans up the new record and relations if history fails", async () => {
  const { tables, repository } = database(({ table, operation }) => table === "db_record_history" && operation === "insert");
  const previous = structuredClone(tables);
  await assert.rejects(repository.createDatabaseRecord(actor, { ...input, metadata: { keywords: ["New"] }, externalLinks: [link] }), /injected_failure/);
  for (const table of ["db_records", "db_record_keywords", "db_record_external_links"]) assert.deepEqual(tables[table], previous[table]);
});

test("create normalizes explicit keywords and an explicit empty list overrides metadata", async () => {
  for (const [keywords, expected] of [[[" Alpha ", "alpha", ""], ["Alpha"]], [[], []]]) {
    const { tables, repository } = database();
    const record = await repository.createDatabaseRecord(actor, { ...input, keywords, metadata: { keywords: ["Ignored"] } });
    assert.deepEqual(tables.db_record_keywords.filter((row) => row.record_id === record.id).map((row) => row.keyword), expected);
  }
});

test("a failed compensation reports reconciliation and still restores other targets", async () => {
  let historyFailed = false;
  const { tables, repository } = database(({ table, operation, payload }) => {
    if (payload?.action === "update") { historyFailed = true; return true; }
    return historyFailed && table === "db_record_keywords" && operation === "insert";
  });
  const previous = structuredClone(tables);
  await assert.rejects(repository.updateDatabaseRecord(actor, "r1", { keywords: ["New"], externalLinks: [link] }), /record_update_reconciliation_required/);
  for (const table of ["db_records", "db_record_external_links", "db_record_history"]) assert.deepEqual(tables[table], previous[table]);
});
