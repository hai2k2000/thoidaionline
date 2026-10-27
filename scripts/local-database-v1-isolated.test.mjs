import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./local-database-v1-isolated.mjs", import.meta.url), "utf8");

test("isolated Database V1 runner is reproducible from official migrations", () => {
  assert.match(source, /20260901095000_backend_security_hardening\.sql/);
  assert.match(source, /20261017100000_database_management_v1_foundation\.sql/);
  assert.match(source, /20261017101000_database_management_v1_catalog\.sql/);
  assert.match(source, /20261017110000_database_management_v1_cp2b_optional_fields\.sql/);
  assert.match(source, /20261017130000_database_management_v1_cp3_search_rpc\.sql/);
  assert.match(source, /20261017140000_database_management_v1_cp3_search_security_fix\.sql/);
  assert.match(source, /20261018100000_database_management_v1_cp3_search_rpc_identifier_fix\.sql/);
  assert.match(source, /20261018120000_database_management_v1_cp3_search_scope_fix\.sql/);
  assert.match(source, /20261018130000_database_management_v1_cp6_audit_outbox\.sql/);
  assert.match(source, /20261023130000_database_management_v1_workflow_ambiguity_fix\.sql/);
  assert.match(source, /20261024110000_database_management_v1_self_approval\.sql/);
  assert.match(source, /20261027160000_database_management_v1_drop_source_person\.sql/);
  assert.match(source, /mkdtempSync/);
  assert.match(source, /cpSync\(sourceSupabase/);
  assert.match(source, /has_table_privilege/);
  assert.match(source, /api_list_effective_permissions/);
  assert.match(source, /20261015100000_rbac_v2_role_user_overrides\.sql/);
  assert.match(source, /20260910090000_leave_requests\.sql/);
  assert.match(source, /20260911150000_lock_task_completion_scores\.sql/);
  assert.match(source, /sql_paths = \[\]/);
  assert.match(source, /db_record_types where active/);
  assert.match(source, /active\)=44/);
  assert.doesNotMatch(source, /drop constraint|drop trigger|disable trigger|set session_replication_role/);
});
