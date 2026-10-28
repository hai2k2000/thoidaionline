import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync("scripts/production/rbac-approval-dryrun.sh", "utf8");
const migration = readFileSync("supabase/migrations/20261028100000_rbac_approval_permissions_v1.sql", "utf8");
const behaviour = readFileSync("supabase/tests/rbac_approval_v1_behaviour.sql", "utf8").trim().toLowerCase();
const shadow = readFileSync("scripts/production/rbac-approval-shadow-diff.sql", "utf8").trim().toLowerCase();
const revert = readFileSync("scripts/production/rbac-approval-v1-revert.sql", "utf8").toLowerCase();

test("dry-run has the approval, disk, cleanup and stdin guards", () => {
  assert.match(script, /THOIDAI_RBAC_DRYRUN_APPROVED/);
  assert.match(script, /disk-guard\.sh/);
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /main "\$@" <\/dev\/null/);
});

test("dry-run isolates disposable postgres", () => {
  assert.match(script, /127\.0\.0\.1::5432/);
  assert.match(script, /--memory 512m/);
  assert.doesNotMatch(script, /supabase_db_thoidai-work/);
  assert.doesNotMatch(script, /docker (?:top|inspect)\b/);
  assert.doesNotMatch(script, /systemctl/);
});

test("dry-run uses strict psql and scoped cleanup", () => {
  assert.match(script, /psql -q[^\n]*ON_ERROR_STOP=1/);
  for (const match of script.matchAll(/rm -rf[^\n]*/g)) assert.match(match[0], /"\$(?:work|tmp)"/);
});

test("dry-run cleanup state survives main and guards leftovers", () => {
  assert.doesNotMatch(migration, /foreach\s+\w+\s+in\s+array\s*\[/i);
  assert.match(migration, /foreach\s+\w+\s+in\s+array\s+array\[/i);
  assert.match(script, /^(?:tmp|work|step|output|shadow)=/m);
  assert.doesNotMatch(script, /local\s+(?:tmp|work|step|output|shadow)\b/);
  assert.match(script, /cleanup\(\)\s*\{[\s\S]*?set \+u[\s\S]*?set \+e/);
  assert.match(script, /docker\s+ps\s+-a[\s\S]*?rbac-approval-dryrun/);
});

test("migration dollar-quoted blocks are balanced", () => {
  for (const tag of ["do $$", "$function$"]) {
    const occurrences = migration.match(new RegExp(tag.replace("$", "\\$").replace("$", "\\$"), "gi")) ?? [];
    assert.equal(occurrences.length % 2, 0, `${tag} delimiter count must be even`);
  }
});

test("SQL files are transaction scoped and rollback is narrow", () => {
  assert.equal(behaviour.endsWith("rollback;"), true);
  assert.equal(shadow.endsWith("rollback;"), true);
  assert.doesNotMatch(revert, /drop\s+table/);
  assert.doesNotMatch(revert, /delete\s+from\s+public\.user_permission_grants/);
});

test("revert preserves replaced RPCs and removes only migration-owned functions", () => {
  for (const name of ["api_review_leave_request", "api_review_personal_work_schedule", "rbac_v2_scope_supported"]) {
    assert.doesNotMatch(revert, new RegExp(`drop\\s+function[^;]*${name}`));
  }
  assert.match(revert, /delete\s+from\s+supabase_migrations\.schema_migrations\s+where\s+version\s*=\s*'20261028100000'/);
  assert.doesNotMatch(revert, /revoke\s+.*(?:api_review_leave_request|api_review_personal_work_schedule|rbac_v2_scope_supported)/);
  assert.doesNotMatch(revert, /grant\s+.*(?:api_review_leave_request|api_review_personal_work_schedule|rbac_v2_scope_supported)/);
});

test("dry-run exercises real apply, direct idempotency, revert, re-apply, and notices", () => {
  assert.match(script, /echo APPLIED/);
  assert.match(script, /psql -q -v ON_ERROR_STOP=1 -f .*20261028100000_rbac_approval_permissions_v1\.sql/);
  assert.match(script, /psql -q -At \"\$RBAC_DB_URL\"/);
  assert.match(script, /NOTICE:  RBAC_TEST_PASS/);
  assert.match(script, /EXPECTED_RBAC_TEST_PASS/);
  assert.match(script, /SHADOW_TOTAL/);
  assert.match(script, /SHADOW_LIST_MISMATCH/);
  for (const name of ["EXPECTED_INACTIVE_ROLE", "EXPECTED_D6_PHO_TP_JOB", "SECURITY_CRITICAL", "UNEXPECTED_RESTRICTIVE"]) {
    assert.match(script, new RegExp(`SHADOW_CLASS_${name}`));
    assert.match(shadow, new RegExp(`shadow_class_${name.toLowerCase()}`));
  }
  assert.match(script, /shadow_security" == 0/);
  assert.match(script, /shadow_unexpected" == 0/);
  assert.match(script, /shadow_inactive.*\[\[.*\^\[1-9\]/);
  assert.match(shadow, /pho_tong_bien_tap/);
  assert.match(shadow, /inactive_role_a','phu_trach_phong_bien_tap/);
  assert.match(shadow, /shadow_list_mismatch/);
  assert.match(script, /RBAC_DRYRUN_RESULT=FAIL step=\$step/);
});

test("behaviour suite has one pass notice for each expected case", () => {
  const cases = [...behaviour.matchAll(/rbac_test_pass\s+([0-9]+|d-[34])/g)].map((match) => match[1]);
  assert.deepEqual(cases, ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "14", "15", "18", "19", "22", "23", "24", "d-3", "d-4"]);
  assert.match(behaviour, /workflow_revision\)\s*values|workflow_revision\s*\)\s*select/);
});
