import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import * as fileTypes from "./fileType.mjs";

function load(path, dependencies = {}) {
  const source = stripTypeScriptTypes(readFileSync(path, "utf8"));
  const names = [...source.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1]);
  const code = source.replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  return new Function(...Object.keys(dependencies), `${code}\nreturn {${names.join(",")}};`)(...Object.values(dependencies));
}
const base = "src/lib/databaseManagement/";
const policy = load(base + "policy.ts");
const acl = load(base + "acl.ts");
const validation = load(base + "validation.ts");
const actor = { id: "u1", department_id: "d1", role_code: "staff", rbacPermissions: ["record.discover", "record.acl.manage", "record.edit"], rbacPermissionScopes: {} };
const record = { id: "r1", category_id: "c1", record_type_id: "t1", owner_id: "owner", created_by: "creator", department_id: "d1", status: "approved", visibility: "public" };

function database(options = {}) {
  const tables = { db_records: [{ ...record, ...options.record }], db_categories: [{ id: "c1", restricted: false, ...options.category }], db_record_types: [{ id: "t1", code: "ordinary" }], staff_users: [{ id: "u1", role_id: "role1" }], departments: [{ id: "d1", manager_id: options.manager }], db_record_acl: (options.acl ?? []).map((row) => ({ record_id: "r1", ...row })), db_category_access_grants: options.grant ? [{ user_id: "u1", category_id: "c1", level: options.grant }] : [], db_record_files: [{ id: "f1", record_id: "r1", storage_key: "key", original_name: "a.pdf" }], db_record_history: [] };
  const events = [];
  let sequence = 0;
  const client = { from(table) {
    let operation = "select", payload, single = false;
    const filters = [];
    const query = {
      select() { return query; }, eq(key, value) { filters.push((row) => row[key] === value); return query; },
      limit() { return query; }, order() { return query; },
      maybeSingle() { single = true; return query; }, single() { single = true; return query; },
      insert(value) { operation = "insert"; payload = value; return query; },
      upsert(value) { operation = "insert"; payload = value; return query; },
      update(value) { operation = "update"; payload = value; return query; },
      delete() { operation = "delete"; return query; },
      then(resolve, reject) {
        try {
          events.push({ table, operation, payload });
          const error = options.fail?.({ table, operation, payload, events });
          if (error) return Promise.resolve({ data: null, error }).then(resolve, reject);
          let rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
          if (operation === "insert") { rows = [{ id: `new-${++sequence}`, ...payload }]; tables[table].push(...rows); }
          if (operation === "update") rows.forEach((row) => Object.assign(row, payload));
          if (operation === "delete") tables[table] = tables[table].filter((row) => !rows.includes(row));
          return Promise.resolve({ data: single ? (rows[0] ? { ...rows[0] } : null) : rows.map((row) => ({ ...row })), error: null }).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return query;
  } };
  const repository = load(base + "repository.ts", { serverSupabase: client, ...acl, ...policy, ...validation, languageCodeForCategory: () => null });
  return { tables, events, client, repository };
}

test("ACL management rejects a visible colleague but allows owner, admin and approvers", async () => {
  const cases = [
    [{}, actor, false],
    [{ record: { owner_id: "u1" } }, actor, true],
    [{}, { ...actor, rbacPermissionScopes: { "record.discover": ["all"] } }, true],
    [{ manager: "u1" }, actor, true],
    [{}, { ...actor, rbacPermissionScopes: { "record.approve": ["all"] } }, true],
    [{}, { ...actor, rbacPermissionScopes: { "record.approve": ["department"] } }, true],
    [{ record: { department_id: "d2" } }, { ...actor, rbacPermissionScopes: { "record.approve": ["department"] } }, false],
    [{ category: { restricted: true }, grant: "approve" }, actor, true],
    [{ category: { restricted: true }, grant: "view", manager: "u1" }, actor, false],
    [{ category: { restricted: true }, record: { owner_id: "u1" } }, actor, false],
    [{ record: { owner_id: "u1" } }, { ...actor, rbacPermissions: ["record.discover"] }, false],
    [{ record: { owner_id: "u1" }, acl: [{ capability: "acl.manage", effect: "deny", principal_type: "user", principal_id: "u1" }] }, actor, false],
    [{ manager: "u1", acl: [{ capability: "approve", effect: "deny", principal_type: "user", principal_id: "u1" }] }, actor, false],
  ];
  for (const [options, who, expected] of cases) {
    const { repository } = database(options);
    assert.equal(await repository.canAccessDatabaseRecordForActor(who, "r1", "acl.manage"), expected, JSON.stringify(options));
  }
});

test("deleted records reject ACL writes before mutation", async () => {
  const { repository, events } = database({ record: { status: "deleted", owner_id: "u1" } });
  await assert.rejects(repository.upsertDatabaseRecordAcl(actor, "r1", {}), /record_not_found/);
  assert.equal(events.some((e) => e.operation !== "select"), false);
});

test("approve ACL accepts deny only while other ACL capabilities retain allow", () => {
  const input = { principalType: "user", principalId: "11111111-1111-4111-8111-111111111111", capability: "approve", effect: "allow" };
  assert.deepEqual(validation.validateDatabaseAclInput(input), { ok: false, errors: [{ field: "effect", code: "invalid_effect" }] });
  assert.equal(validation.validateDatabaseAclInput({ ...input, effect: "deny" }).ok, true);
  assert.equal(validation.validateDatabaseAclInput({ ...input, capability: "edit" }).ok, true);
});

for (const status of ["approved", "archived"]) {
  test(`file checks do not reopen ${status} records`, async () => {
    const { repository, tables } = database({ record: { status, owner_id: "u1" } });
    await repository.assertCanModifyRecordFiles(actor, "r1");
    assert.equal(tables.db_records[0].status, status);
    assert.equal(tables.db_record_history.length, 0);
  });
  for (const failure of ["delete", "file_delete", "reopen_for_edit", "reopen_update"]) {
    test(`failed ${failure} preserves ${status} record and file`, async () => {
      const { repository, tables } = database({ record: { status, owner_id: "u1" }, fail: ({ table, operation, payload }) =>
        (failure === "delete" && table === "db_record_files" && operation === "delete") || payload?.action === failure || (failure === "reopen_update" && table === "db_records" && operation === "update" && payload.status === "draft") ? new Error("injected_failure") : null });
      await assert.rejects(repository.deleteDatabaseRecordFile(actor, "r1", "f1"));
      assert.equal(tables.db_records[0].status, status);
      assert.equal(tables.db_record_files.length, 1);
      assert.equal(tables.db_record_history.length, 0);
    });
  }
}

test("delete reopens only after removing the file row and recording deletion", async () => {
  const { repository, tables, events } = database({ record: { owner_id: "u1" } });
  await repository.deleteDatabaseRecordFile(actor, "r1", "f1");
  assert.equal(tables.db_record_files.length, 0);
  assert.equal(tables.db_records[0].status, "draft");
  const deletion = events.findIndex((e) => e.table === "db_record_files" && e.operation === "delete");
  const reopen = events.findIndex((e) => e.table === "db_records" && e.operation === "update");
  assert.ok(deletion < reopen);
});

test("storage uses provided bytes and extension MIME, and reports ownership of writes", async () => {
  let writes = 0;
  const bytes = Buffer.from("%PDF-1.7");
  const storage = load(base + "storage.ts", {
    ...fileTypes, Buffer, process,
    path: (await import("node:path")).default,
    createHash: (await import("node:crypto")).createHash,
    databaseRecordStorageKey: () => "11111111-1111-4111-8111-111111111111/request.pdf",
    mkdir: async () => {}, realpath: async (p) => p,
    writeFile: async () => { if (writes++) throw Object.assign(new Error("exists"), { code: "EEXIST" }); },
    readFile: async () => bytes,
  });
  const input = { name: "report.pdf", bytes, mimeType: "application/pdf" };
  const first = await storage.writeDatabaseRecordFile("11111111-1111-4111-8111-111111111111", input, "request");
  assert.equal(first.sizeBytes, bytes.length);
  assert.equal(first.created, true);
  assert.equal((await storage.writeDatabaseRecordFile("11111111-1111-4111-8111-111111111111", input, "request")).created, false);
  await assert.rejects(storage.writeDatabaseRecordFile("11111111-1111-4111-8111-111111111111", { ...input, name: "bad.exe" }), /invalid_file/);
});

test("approve panel does not offer allow or claim it is required", () => {
  const panel = readFileSync("src/components/DatabaseRecordAclPanel.tsx", "utf8");
  assert.doesNotMatch(panel, /<option value="allow"|missing_approval_acl_allow/);
});

async function upload(options = {}) {
  const db = database({ record: { owner_id: "u1", status: options.status ?? "approved" }, fail: options.fail });
  db.tables.db_record_files = options.references ?? [];
  let removed = 0;
  const route = load("src/app/api/database/records/[id]/files/route.ts", {
    ...fileTypes, ...db.repository, serverSupabase: db.client,
    NextResponse: { json: (body, init) => Response.json(body, init) },
    getSessionUser: async () => actor, isSameOriginRequest: async () => true,
    writeDatabaseRecordFile: async (_id, input) => {
      if (options.storageError) throw new Error("storage_failed");
      assert.equal(input.mimeType, "application/pdf");
      assert.deepEqual([...input.bytes], [...Buffer.from("%PDF-1.7")]);
      return { storageKey: "key", sizeBytes: 8, sha256: "hash", created: options.created ?? true };
    },
    removeDatabaseRecordFile: async () => { removed++; },
    logServerAudit: async () => "delivered",
  });
  const form = new FormData();
  form.set("file", new File(["%PDF-1.7"], "report.pdf", { type: "application/octet-stream" }));
  const response = await route.POST(new Request("http://localhost/api/files", { method: "POST", body: form, headers: { "Idempotency-Key": "request123" } }), { params: Promise.resolve({ id: "r1" }) });
  return { ...db, response, removed };
}

for (const status of ["approved", "archived"]) {
  for (const failure of ["storage", "insert", "file_upload", "reopen_for_edit", "reopen_update"]) {
    test(`upload ${failure} failure leaves ${status} unchanged`, async () => {
      const result = await upload({ status, storageError: failure === "storage", fail: ({ table, operation, payload }) =>
        (failure === "insert" && table === "db_record_files" && operation === "insert") || payload?.action === failure || (failure === "reopen_update" && table === "db_records" && operation === "update" && payload.status === "draft") ? new Error("injected_failure") : null });
      assert.ok(result.response.status >= 400);
      assert.equal(result.tables.db_records[0].status, status);
      assert.equal(result.tables.db_record_files.length, 0);
      assert.equal(result.tables.db_record_history.length, 0);
    });
  }
}

test("successful upload persists before reopening and accepts generic browser MIME", async () => {
  const result = await upload();
  assert.equal(result.response.status, 201);
  assert.equal(result.tables.db_records[0].status, "draft");
  assert.equal(result.tables.db_record_files.length, 1);
  assert.equal(result.removed, 0);
});

for (const lookupFailure of [false, true]) {
  test(`23505 retains storage when retry lookup ${lookupFailure ? "fails" : "finds nothing"}`, async () => {
    let inserts = 0;
    const result = await upload({ fail: ({ table, operation }) => {
      if (table === "db_record_files" && operation === "insert") { inserts++; return { code: "23505" }; }
      if (lookupFailure && inserts && table === "db_record_files" && operation === "select") return new Error("lookup_failed");
      return null;
    } });
    assert.equal(result.response.status, 500);
    assert.equal(result.removed, 0);
    assert.equal(result.tables.db_records[0].status, "approved");
  });
}

test("cleanup removes only newly created unreferenced storage", async () => {
  for (const [created, references, expected] of [[true, [], 1], [false, [], 0], [true, [{ id: "other", storage_key: "key" }], 0]]) {
    const result = await upload({ created, references, fail: ({ table, operation }) => table === "db_record_files" && operation === "insert" ? new Error("insert_failed") : null });
    assert.equal(result.removed, expected);
  }
});

test("locked records reject upload and delete before any writes", async () => {
  const result = await upload({ status: "pending_review" });
  assert.equal(result.response.status, 409);
  assert.equal(result.events.some((e) => e.operation !== "select"), false);
  await assert.rejects(result.repository.deleteDatabaseRecordFile(actor, "r1", "f1"), /record_locked/);
});

test("cleanup retains storage when its reference lookup fails", async () => {
  let failedInsert = false;
  const result = await upload({ fail: ({ table, operation }) => {
    if (table === "db_record_files" && operation === "insert") { failedInsert = true; return new Error("insert_failed"); }
    if (failedInsert && table === "db_record_files" && operation === "select") return new Error("lookup_failed");
    return null;
  } });
  assert.equal(result.removed, 0);
  assert.equal(result.tables.db_records[0].status, "approved");
});

test("failed reopen compensates only this operation's history", async () => {
  const { repository, tables } = database({ record: { owner_id: "u1" }, fail: ({ payload }) => payload?.action === "reopen_for_edit" ? new Error("history_failed") : null });
  const oldHistory = { id: "old-history", record_id: "r1", action: "file_delete" };
  tables.db_record_history.push(oldHistory);
  await assert.rejects(repository.deleteDatabaseRecordFile(actor, "r1", "f1"));
  assert.deepEqual(tables.db_record_history, [oldHistory]);
});
