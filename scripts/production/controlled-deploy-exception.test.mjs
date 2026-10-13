import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { consumeApproval, validateApproval } from "./controlled-deploy-exception.mjs";

const commit = "4fcd766d3b96a261297d9bd1d121c41a8a211f62";
const baseApproval = (overrides = {}) => ({
  schema_version: 1,
  exception_id: "rbac-v2-smoke-waiver-20261013",
  approval_scope: "rbac-v2-authenticated-smoke-waiver",
  owner_approved: true,
  approved_commit: commit,
  approved_by: "owner",
  approval_reference: "owner-controlled-rollout-exception",
  approved_at: "2026-10-13T13:00:00Z",
  expires_at: "2026-10-13T14:00:00Z",
  evidence_reference: "owner-approval-20261013",
  ...overrides,
});

test("accepts a current owner approval for the exact artifact commit", () => {
  assert.equal(validateApproval(baseApproval(), { expectedCommit: commit, now: new Date("2026-10-13T13:30:00Z") }).ok, true);
});

for (const [name, overrides] of [
  ["wrong SHA", { approved_commit: "0".repeat(40) }],
  ["expired approval", { expires_at: "2026-10-13T12:59:59Z" }],
  ["missing owner", { approved_by: "" }],
  ["missing evidence", { evidence_reference: "" }],
  ["wrong scope", { approval_scope: "deploy-all" }],
]) {
  test(`rejects ${name}`, () => {
    assert.equal(validateApproval(baseApproval(overrides), { expectedCommit: commit, now: new Date("2026-10-13T13:30:00Z") }).ok, false);
  });
}

test("consumes approval once and records waiver evidence without secrets", async () => {
  const root = await mkdtemp(join(tmpdir(), "rbac-exception-"));
  const approvalPath = join(root, "approval.json");
  const evidencePath = join(root, "waiver.evidence");
  await writeFile(approvalPath, `${JSON.stringify(baseApproval(), null, 2)}\n`, { mode: 0o600 });
  const first = await consumeApproval(approvalPath, { expectedCommit: commit, evidencePath, now: new Date("2026-10-13T13:30:00Z") });
  assert.equal(first.ok, true);
  assert.match(await readFile(evidencePath, "utf8"), /AUTHENTICATED_SMOKE=WAIVED/);
  await assert.rejects(() => consumeApproval(approvalPath, { expectedCommit: commit, evidencePath, now: new Date("2026-10-13T13:31:00Z") }), /already consumed/);
});

test("rejects a copied approval after the exception id is consumed", async () => {
  const root = await mkdtemp(join(tmpdir(), "rbac-exception-copy-"));
  const approvalPath = join(root, "approval.json");
  const copiedPath = join(root, "copied-approval.json");
  await writeFile(approvalPath, `${JSON.stringify(baseApproval({ exception_id: "rbac-v2-copy-test" }))}\n`, { mode: 0o600 });
  await consumeApproval(approvalPath, { expectedCommit: commit, evidencePath: join(root, "first.evidence"), now: new Date("2026-10-13T13:30:00Z") });
  await writeFile(copiedPath, `${JSON.stringify(baseApproval({ exception_id: "rbac-v2-copy-test" }))}\n`, { mode: 0o600 });
  await assert.rejects(() => consumeApproval(copiedPath, { expectedCommit: commit, evidencePath: join(root, "second.evidence"), now: new Date("2026-10-13T13:31:00Z") }), /already consumed/);
});
