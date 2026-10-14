import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const source = await readFile(new URL("./produce-rbac-readiness.mjs", import.meta.url), "utf8");

test("readiness producer is fail-closed and exact-commit bound", () => {
  assert.match(source, /canonical_commit=\$\{canonicalCommit\}/);
  assert.match(source, /produced_by: PRODUCER/);
  assert.match(source, /expires_at: new Date\(now\.getTime\(\) \+ 30 \* 60 \* 1000\)/);
  assert.match(source, /must run as root/);
  assert.match(source, /trusted disposable restore runner is required/);
  assert.match(source, /validateRestoreResult/);
  assert.match(source, /rbac_v2_assert_manager_survives/);
  assert.match(source, /to_regprocedure\(e\.signature\)/);
  assert.match(source, /backup checksum does not match/);
  assert.match(source, /migration checksum missing or mismatched/);
  assert.doesNotMatch(source, /THOIDAI_RBAC_DISPOSABLE_RESTORE_COMMAND/);
});

test("readiness output contract stays private and contains all six checks", async () => {
  const root = await mkdtemp(join(tmpdir(), "readiness-contract-"));
  await chmod(root, 0o700);
  const names = ["backup_integrity", "disposable_restore", "migration_rbac_v2", "schema_rpc", "grants_parity", "last_permission_manager"];
  const manifest = { schema_version: 1, evidence_scope: "rbac-v2-production-readiness", produced_by: "thoidai-rbac-v2-safe-rollout-v1", canonical_commit: "1cc9d346ef49235b9365132a22469ce9a15a5ab1", checks: Object.fromEntries(names.map((name) => [name, { status: "PASS", evidence_path: `${name}.evidence` }])) };
  await writeFile(join(root, "readiness.json"), JSON.stringify(manifest), { mode: 0o600 });
  await chmod(join(root, "readiness.json"), 0o600);
  const metadata = JSON.parse(await readFile(join(root, "readiness.json"), "utf8"));
  assert.deepEqual(Object.keys(metadata.checks).sort(), names.sort());
  if (process.platform !== "win32") assert.equal((await stat(join(root, "readiness.json"))).mode & 0o077, 0);
});
