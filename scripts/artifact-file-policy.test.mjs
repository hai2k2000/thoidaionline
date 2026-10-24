import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { removePackagedEnvironmentFiles } from "./artifact-file-policy.mjs";

test("artifact packaging removes environment files without removing runtime files", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "thoidai-artifact-policy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "nested"));
  await writeFile(join(root, ".env.example"), "NEXT_PUBLIC_EXAMPLE=placeholder\n");
  await writeFile(join(root, "nested", ".env.production"), "SECRET=blocked\n");
  await symlink("/tmp/nonexistent-env", join(root, "nested", ".env.local"));
  await writeFile(join(root, "nested", "server.js"), "export {};\n");

  await removePackagedEnvironmentFiles(root);

  await assert.rejects(() => readFile(join(root, ".env.example")), { code: "ENOENT" });
  await assert.rejects(() => readFile(join(root, "nested", ".env.production")), { code: "ENOENT" });
  await assert.rejects(() => readFile(join(root, "nested", ".env.local")), { code: "ENOENT" });
  assert.equal(await readFile(join(root, "nested", "server.js"), "utf8"), "export {};\n");
});
