import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const optional = readFileSync(new URL("../supabase/migrations/20261017110000_database_management_v1_cp2b_optional_fields.sql", import.meta.url), "utf8");
const source = readFileSync(new URL("../supabase/migrations/20261001090000_quick_report_task_v1.sql", import.meta.url), "utf8");
const proposal = readFileSync(new URL("../docs/CP2B_RLS_HARDENING_PROPOSAL.md", import.meta.url), "utf8");

test("CP2-B optional fields are non-required and bounded by group", () => {
  assert.match(optional, /required, searchable/);
  assert.match(optional, /required=false/);
  assert.match(optional, /else\n\s+-- Sensitive\/regulated groups/);
  assert.match(optional, /reference_number/);
  assert.match(optional, /source_language/);
});

test("RLS finding is source-backed and remediation remains a proposal", () => {
  assert.match(source, /create table if not exists public\.task_quick_report_idempotency/);
  assert.doesNotMatch(source, /revoke all on table public\.task_quick_report_idempotency/);
  assert.match(proposal, /OWNER_REQUIRED/);
  assert.match(proposal, /revoke all on table public\.task_quick_report_idempotency/);
  assert.match(proposal, /not applied in CP2-B/);
});
