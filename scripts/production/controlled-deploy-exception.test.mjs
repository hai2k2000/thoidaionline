import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { consumeApproval, validateApproval, validateRegistryStat, verifyReadinessEvidence } from "./controlled-deploy-exception.mjs";

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

const requiredChecks = ["backup_integrity", "disposable_restore", "migration_rbac_v2", "schema_rpc", "grants_parity", "last_permission_manager"];

async function createReadiness(root, overrides = {}) {
  const checks = {};
  for (const name of requiredChecks) {
    const path = join(root, `${name}.evidence`);
    const content = `${name}=PASS\n`;
    await writeFile(path, content, { mode: 0o600 });
    checks[name] = { status: "PASS", evidence_path: `${name}.evidence`, sha256: createHash("sha256").update(content).digest("hex") };
  }
  const readiness = {
    schema_version: 1,
    evidence_scope: "rbac-v2-production-readiness",
    canonical_commit: commit,
    produced_by: "thoidai-rbac-v2-safe-rollout-v1",
    verified_at: "2026-10-13T13:20:00Z",
    expires_at: "2026-10-13T13:50:00Z",
    checks,
    ...overrides,
  };
  const path = join(root, "readiness.json");
  await writeFile(path, `${JSON.stringify(readiness, null, 2)}\n`, { mode: 0o600 });
  return path;
}

test("accepts a current owner approval for the exact artifact commit", () => {
  assert.equal(validateApproval(baseApproval(), { expectedCommit: commit, now: new Date("2026-10-13T13:30:00Z") }).ok, true);
});

for (const [name, overrides] of [
  ["wrong SHA", { approved_commit: "0".repeat(40) }],
  ["expired approval", { expires_at: "2026-10-13T12:59:59Z" }],
  ["missing owner", { approved_by: "" }],
  ["missing evidence", { evidence_reference: "" }],
  ["wrong scope", { approval_scope: "deploy-all" }],
  ["path traversal exception id", { exception_id: "../waiver" }],
  ["nested exception id", { exception_id: "nested/waiver" }],
  ["backslash exception id", { exception_id: "nested\\waiver" }],
  ["approval lifetime over one hour", { expires_at: "2026-10-13T14:00:01Z" }],
]) {
  test(`rejects ${name}`, () => {
    assert.equal(validateApproval(baseApproval(overrides), { expectedCommit: commit, now: new Date("2026-10-13T13:30:00Z") }).ok, false);
  });
}

test("rejects insecure registry ownership or mode metadata", () => {
  assert.equal(validateRegistryStat({ isDirectory: () => true, mode: 0o40755, uid: 0 }, { enforceOwner: true }).ok, false);
  assert.equal(validateRegistryStat({ isDirectory: () => true, mode: 0o40700, uid: 1000 }, { enforceOwner: true }).ok, false);
  assert.equal(validateRegistryStat({ isDirectory: () => false, mode: 0o100600, uid: 0 }, { enforceOwner: true }).ok, false);
});

test("accepts fresh exact-commit trusted readiness evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "rbac-readiness-"));
  const readinessPath = await createReadiness(root);
  const result = await verifyReadinessEvidence(readinessPath, { expectedCommit: commit, now: new Date("2026-10-13T13:30:00Z") });
  assert.equal(result.ok, true);
});

for (const [name, mutate] of [
  ["wrong commit", (value) => { value.canonical_commit = "0".repeat(40); }],
  ["expired evidence", (value) => { value.expires_at = "2026-10-13T13:29:59Z"; }],
  ["untrusted producer", (value) => { value.produced_by = "manual"; }],
  ["missing backup proof", (value) => { delete value.checks.backup_integrity; }],
  ["failed last-manager proof", (value) => { value.checks.last_permission_manager.status = "FAIL"; }],
]) {
  test(`rejects ${name} in readiness evidence`, async () => {
    const root = await mkdtemp(join(tmpdir(), "rbac-readiness-invalid-"));
    const readinessPath = await createReadiness(root);
    const value = JSON.parse(await readFile(readinessPath, "utf8"));
    mutate(value);
    await writeFile(readinessPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await assert.rejects(() => verifyReadinessEvidence(readinessPath, { expectedCommit: commit, now: new Date("2026-10-13T13:30:00Z") }));
  });
}

test("rejects readiness evidence when a proof checksum or mode is invalid", async () => {
  const root = await mkdtemp(join(tmpdir(), "rbac-readiness-proof-"));
  const readinessPath = await createReadiness(root);
  const readiness = JSON.parse(await readFile(readinessPath, "utf8"));
  const schemaProof = join(root, readiness.checks.schema_rpc.evidence_path);
  await writeFile(schemaProof, "tampered\n", { mode: 0o600 });
  await assert.rejects(() => verifyReadinessEvidence(readinessPath, { expectedCommit: commit, now: new Date("2026-10-13T13:30:00Z") }), /checksum/);
  await writeFile(schemaProof, "schema_rpc=PASS\n", { mode: 0o600 });
  readiness.checks.schema_rpc.sha256 = createHash("sha256").update("schema_rpc=PASS\n").digest("hex");
  await writeFile(readinessPath, `${JSON.stringify(readiness, null, 2)}\n`, { mode: 0o600 });
  await chmod(schemaProof, 0o644);
  await assert.rejects(() => verifyReadinessEvidence(readinessPath, { expectedCommit: commit, now: new Date("2026-10-13T13:30:00Z"), enforcePrivate: true }), /private/);
});

test("consumes approval once and records waiver evidence without secrets", async () => {
  const root = await mkdtemp(join(tmpdir(), "rbac-exception-"));
  const approvalPath = join(root, "approval.json");
  const evidencePath = join(root, "waiver.evidence");
  const registryDir = join(root, "registry");
  await mkdir(registryDir, { mode: 0o700 });
  await chmod(registryDir, 0o700);
  await writeFile(approvalPath, `${JSON.stringify(baseApproval(), null, 2)}\n`, { mode: 0o600 });
  const first = await consumeApproval(approvalPath, { expectedCommit: commit, evidencePath, registryDir, now: new Date("2026-10-13T13:30:00Z") });
  assert.equal(first.ok, true);
  assert.match(await readFile(evidencePath, "utf8"), /AUTHENTICATED_SMOKE=WAIVED/);
  await assert.rejects(() => consumeApproval(approvalPath, { expectedCommit: commit, evidencePath, registryDir, now: new Date("2026-10-13T13:31:00Z") }), /already consumed/);
});

test("rejects a copied approval after the exception id is consumed", async () => {
  const root = await mkdtemp(join(tmpdir(), "rbac-exception-copy-"));
  const approvalPath = join(root, "approval.json");
  const copiedPath = join(root, "copied-approval.json");
  const registryDir = join(root, "registry");
  await mkdir(registryDir, { mode: 0o700 });
  await chmod(registryDir, 0o700);
  await writeFile(approvalPath, `${JSON.stringify(baseApproval({ exception_id: "rbac-v2-copy-test" }))}\n`, { mode: 0o600 });
  await consumeApproval(approvalPath, { expectedCommit: commit, evidencePath: join(root, "first", "first.evidence"), registryDir, now: new Date("2026-10-13T13:30:00Z") });
  await writeFile(copiedPath, `${JSON.stringify(baseApproval({ exception_id: "rbac-v2-copy-test" }))}\n`, { mode: 0o600 });
  await assert.rejects(() => consumeApproval(copiedPath, { expectedCommit: commit, evidencePath: join(root, "second", "second.evidence"), registryDir, now: new Date("2026-10-13T13:31:00Z") }), /already consumed/);
});
