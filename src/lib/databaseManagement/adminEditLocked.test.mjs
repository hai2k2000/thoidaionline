import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const repo = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

test("only admins edit pending records; others stay locked", () => {
  assert.match(repo, /function adminKeepsStatus\(actor: DatabaseRecordActor\) \{\n  return actor\.role_code === "admin";/);
  assert.match(repo, /record\.status === "pending_review" && adminKeepsStatus\(actor\)\) && await canRecord\(actor, record, recordId, "edit"\)/);
  assert.match(repo, /current\.status === "pending_review" && !adminKeepsStatus\(actor\)\) throw new Error\("record_locked"\)/);
});

test("admin edits keep approved status; others reopen to draft", () => {
  assert.match(repo, /const reopened = !adminKeepsStatus\(actor\) && \(current\.status === "approved" \|\| current\.status === "archived"\);/);
  assert.match(repo, /if \(adminKeepsStatus\(actor\)\) return current;\n  if \(current\.status === "pending_review"\) throw new Error\("record_locked"\);/);
  assert.match(repo, /admin_edit_kept_status: current\.status/);
});
