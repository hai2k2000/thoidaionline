import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const route = read("../../app/api/database/records/route.ts");
const repository = read("./repository.ts");
const detailRoute = read("../../app/api/database/records/[id]/acl/route.ts");
const detailPage = read("../../app/database/records/[id]/page.tsx");
const aclPanel = read("../../components/DatabaseRecordAclPanel.tsx");

test("database record API is server-session guarded and no-store", () => {
  assert.match(route, /getSessionUser/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /private, no-store/);
  assert.match(route, /validateDatabaseRecordInput/);
});

test("record list applies ACL before returning rows and create requires record.create", () => {
  assert.match(repository, /canAccessDatabaseRecord/);
  assert.match(repository, /defaultDatabaseRecordAccess/);
  assert.match(repository, /record\.create/);
  assert.match(route, /logServerAudit/);
  assert.match(repository, /record_scope_forbidden/);
  assert.match(repository, /cleanupNewRecord/);
});

test("record API accepts language filtering and persists the selected language", () => {
  assert.match(route, /languageCode: params\.get\("languageCode"\)/);
  assert.match(repository, /language_code: languageCodeForCategory\(category\.code\) \?\? languageCode/);
  assert.match(repository, /row\.language_code \?\? languageByCategory\.get\(row\.category_id\) \?\? null/);
});

test("approval visibility exposes manager-only diagnostics and ACL management", () => {
  assert.match(repository, /approvalBlockReason/);
  assert.match(repository, /missing_approval_acl_allow/);
  assert.match(repository, /missing_self_approve_permission/);
  assert.match(repository, /getDatabaseRecordAclManagement/);
  assert.match(detailRoute, /export async function GET/);
  assert.match(detailRoute, /getDatabaseRecordAclManagement/);
  assert.match(detailPage, /detail\.canManageAcl/);
  assert.match(detailPage, /DatabaseRecordAclPanel/);
  assert.match(aclPanel, /capability: "approve"/);
  assert.match(repository, /recordId, "acl\.manage"/);
  assert.match(repository, /capability === "acl\.manage"/);
});
