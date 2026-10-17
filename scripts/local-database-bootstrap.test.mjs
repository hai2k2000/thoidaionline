import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("./local-database-bootstrap.mjs", import.meta.url), "utf8");
const historical = readFileSync(new URL("../supabase/migrations/20260826200000_harden_direct_assignment.sql", import.meta.url), "utf8");

describe("local database bootstrap", () => {
  it("uses a disposable copy and injects compatibility before hardening", () => {
    assert.match(source, /mkdtempSync/);
    assert.match(source, /cpSync\(sourceSupabase/);
    assert.match(source, /20260826195000_local_bootstrap_task_actor_compatibility\.sql/);
    assert.match(source, /created_by is null/);
  });

  it("does not alter the historical migration or disable integrity controls", () => {
    assert.match(historical, /actor_id\) values\(v\.id,'new','in_progress',v\.created_by\)/);
    assert.doesNotMatch(source, /drop constraint|drop trigger|disable trigger|set session_replication_role/);
  });
});
