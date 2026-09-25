import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_MIGRATIONS, validateMigrationState } from "./migration-state.mjs";

test("migration state passes only when every code-required migration is applied", () => {
  assert.equal(validateMigrationState(REQUIRED_MIGRATIONS).ok, true);
  const result = validateMigrationState(REQUIRED_MIGRATIONS.slice(1));
  assert.equal(result.ok, false);
  assert.equal(result.missing[0], REQUIRED_MIGRATIONS[0]);
});
