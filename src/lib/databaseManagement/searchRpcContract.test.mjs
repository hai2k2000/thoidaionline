import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../../supabase/migrations/20261017130000_database_management_v1_cp3_search_rpc.sql", import.meta.url), "utf8");
const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

test("CP3 search uses a server-side authorization predicate before pagination", () => {
  assert.match(migration, /security definer/i);
  assert.match(migration, /count\(\*\) over/i);
  assert.match(migration, /limit v_limit offset v_offset/i);
  assert.match(migration, /explicitly_denied/i);
  assert.match(migration, /record\.sensitive\.access/i);
  assert.match(repository, /rpc\("api_search_database_records"/);
  assert.doesNotMatch(repository, /for \(let offset = 0; rows\.length/);
});

test("search RPC bounds query complexity and does not expose its function to client roles", () => {
  assert.match(migration, /regexp_count/);
  assert.match(migration, /revoke all on function public\.api_search_database_records/);
  assert.match(migration, /grant execute on function public\.api_search_database_records[\s\S]*service_role/);
});
