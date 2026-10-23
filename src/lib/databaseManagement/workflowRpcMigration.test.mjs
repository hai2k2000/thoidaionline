import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const migration = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261023130000_database_management_v1_workflow_ambiguity_fix.sql", import.meta.url)), "utf8");

test("workflow transition qualifies record id references in the RPC", () => {
  assert.match(migration, /from public\.db_records as records\s+where records\.id = p_record_id\s+for update/i);
  assert.match(migration, /update public\.db_records as updated_record[\s\S]*where updated_record\.id = r\.id/i);
  assert.match(migration, /api_transition_database_record/);
  assert.doesNotMatch(migration, /from public\.db_records\s+where id = p_record_id/i);
});
