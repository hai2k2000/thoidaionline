import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBackup, restoreBackup, verifyBackup } from "./database-v1-backup.mjs";

test("synthetic database and private files round-trip with SHA-256 manifest", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "db-v1-backup-"));
  try {
    const storage = path.join(root, "storage");
    const output = path.join(root, "backup");
    const restored = path.join(root, "restored");
    await mkdir(path.join(storage, "record-1"), { recursive: true });
    await writeFile(path.join(root, "database.dump"), "synthetic-db");
    await writeFile(path.join(storage, "record-1", "file.pdf"), "synthetic-file");
    const manifest = await createBackup({ databaseDump: path.join(root, "database.dump"), storageRoot: storage, outputRoot: output });
    assert.equal(manifest.source, "synthetic");
    assert.equal(manifest.members.length, 2);
    await verifyBackup(output);
    await restoreBackup({ backupRoot: output, restoreRoot: restored });
    assert.equal(await readFile(path.join(restored, "database.dump"), "utf8"), "synthetic-db");
    assert.equal(await readFile(path.join(restored, "files", "record-1", "file.pdf"), "utf8"), "synthetic-file");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
