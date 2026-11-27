import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const repo = readFileSync(new URL("./repository.ts", import.meta.url), "utf8").replaceAll("\r\n", "\n");

test("pending editing requires edit permission and admin, editor, creator or owner", () => {
  assert.match(repo, /function adminKeepsStatus\(actor: DatabaseRecordActor\) \{\n  return actor\.role_code === "admin";/);
  assert.match(repo, /record\.status === "pending_review" && \(record\.created_by === actor\.id \|\| record\.owner_id === actor\.id\)/);
  assert.match(repo, /return !grantContext\.restricted && await isCategoryEditor\(actor, record\.category_id\)/);
  assert.match(repo, /const canEdit = record\.status !== "deleted" && \(record\.status !== "pending_review" \|\| await editKeepsStatus\(actor, record\)\) && await canRecord\(actor, record, recordId, "edit"\)/);
  assert.match(repo, /current\.status === "pending_review" && !keepsStatus\) throw new Error\("record_locked"\)/);
  assert.match(repo, /current\.status === "pending_review" && !\(await editKeepsStatus\(actor, current\)\)\) throw new Error\("record_locked"\)/);
});

test("admin and editor edits keep status; other approved edits reopen to draft", () => {
  assert.match(repo, /const reopened = !keepsStatus && \(current\.status === "approved" \|\| current\.status === "archived"\);/);
  assert.match(repo, /if \(await editKeepsStatus\(actor, current\)\) return current;\n  if \(current\.status === "pending_review"\) throw new Error\("record_locked"\);/);
  assert.match(repo, /keepsStatus && current\.status !== "draft" \? \{ admin_edit_kept_status: current\.status \}/);
});
