import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);

test("secret scanner accepts source references but rejects populated runtime secrets", async () => {
  const root = await mkdtemp(join(tmpdir(), "thoidai-secret-scan-"));
  try {
    await writeFile(join(root, "safe.js"), "const key = process.env.SESSION_SECRET;\n");
    await run(process.execPath, ["scripts/scan-artifact-secrets.mjs", root]);
    await writeFile(join(root, "unsafe.js"), "SESSION_SECRET=super-secret-value\n");
    await assert.rejects(() => run(process.execPath, ["scripts/scan-artifact-secrets.mjs", root]), /runtime secret assignment/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("secret scanner keeps environment files and private keys fail closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "thoidai-secret-scan-policy-"));
  try {
    await writeFile(join(root, ".env.example"), "NEXT_PUBLIC_EXAMPLE=placeholder\n");
    await assert.rejects(() => run(process.execPath, ["scripts/scan-artifact-secrets.mjs", root]), /environment file/);
    await rm(join(root, ".env.example"));
    await writeFile(join(root, "private.pem"), "-----BEGIN PRIVATE KEY-----\nblocked\n-----END PRIVATE KEY-----\n");
    await assert.rejects(() => run(process.execPath, ["scripts/scan-artifact-secrets.mjs", root]), /private key material/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
