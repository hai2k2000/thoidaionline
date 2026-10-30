import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { RBAC_PERMISSION_CODES } from "./permissionCatalog.ts";

const migrationsDirectory = new URL("../../../supabase/migrations/", import.meta.url);

function migrationPermissionCodes() {
  const activeCodes = new Set();
  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const fileName of migrationFiles) {
    const sql = readFileSync(new URL(fileName, migrationsDirectory), "utf8");
    const insertStatements = sql.matchAll(
      /insert\s+into\s+public\.permissions\s*\([^;]*?\)\s*values\s*([\s\S]*?)(?:on\s+conflict|;)/gi,
    );

    for (const [, values] of insertStatements) {
      for (const match of values.matchAll(/\(\s*'([^']+)'\s*,/g)) {
        activeCodes.add(match[1]);
      }
    }

    const deleteStatements = sql.matchAll(/delete\s+from\s+public\.permissions\s+where\s+code\s*=\s*'([^']+)'/gi);
    for (const [, code] of deleteStatements) {
      activeCodes.delete(code);
    }
  }

  return [...activeCodes].sort();
}

test("permission catalog contains every active permission inserted by migrations", () => {
  const catalogCodes = new Set(RBAC_PERMISSION_CODES);
  const missingCodes = migrationPermissionCodes().filter((code) => !catalogCodes.has(code));

  assert.deepEqual(missingCodes, []);
});