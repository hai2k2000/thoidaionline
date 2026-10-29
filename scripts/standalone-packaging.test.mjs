import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync("next.config.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("Next standalone output is enabled", () => assert.match(config, /output:\s*["']standalone["']/));
test("standalone tracing excludes development-only source payloads", () => assert.match(config, /outputFileTracingExcludes/));
test("packaging commands exist", () => {
  for (const script of ["package:standalone", "verify:standalone", "artifact:manifest", "artifact:verify", "artifact:secret-scan", "deploy:external:verify", "deploy:vps-first", "retention:dry-run"]) assert.equal(typeof packageJson.scripts[script], "string");
});
test("packaging keeps guards and env symlinks", () => {
  const packager = readFileSync("scripts/package-standalone.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-standalone-artifact.mjs", "utf8");
  assert.match(packager, /RELEASE_BASELINE_COMMIT/);
  assert.match(packager, /required-route-manifest\.json/);
  assert.match(packager, /\.env\.local/);
  assert.match(packager, /verify-artifact-manifest\.mjs/);
  assert.match(packager, /removePackagedEnvironmentFiles\(output\)/);
  assert.match(verifier, /app-paths-manifest\.json/);
});
test("artifact migration reference includes RBAC V2 dependency", () => {
  const packager = readFileSync("scripts/package-standalone.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-standalone-artifact.mjs", "utf8");
  assert.match(packager, /20261015100000_rbac_v2_role_user_overrides\.sql/);
  assert.match(packager, /20261015110000_rbac_v2_scope_ambiguity_fix\.sql/);
  assert.match(packager, /20261015120000_quick_report_rpc_payload_compatibility\.sql/);
  assert.match(verifier, /20261015100000_rbac_v2_role_user_overrides\.sql/);
  assert.match(verifier, /20261015110000_rbac_v2_scope_ambiguity_fix\.sql/);
  assert.match(verifier, /20261015120000_quick_report_rpc_payload_compatibility\.sql/);
});
test("runtime uploads stay outside the traced artifact", () => {
  const uploadRoute = readFileSync("src/app/api/hr/upload/route.ts", "utf8");
  assert.match(uploadRoute, /turbopackIgnore/);
});
test("release workflow invokes the standalone packager", () => {
  const workflow = readFileSync("scripts/production/build-standalone-release.sh", "utf8");
  assert.match(workflow, /npm run package:standalone/);
  assert.match(workflow, /npm run build/);
});
test("managed metadata and success marker are part of future releases", () => {
  const packager = readFileSync("scripts/package-standalone.mjs", "utf8");
  const marker = readFileSync("scripts/production/mark-release-success.sh", "utf8");
  for (const field of ["commit=", "created_at=", "artifact_type=", "canonical_baseline=", "protection=", "rollback_eligible="]) assert.match(packager, new RegExp(field));
  assert.match(packager, /rbac_v2=supported/);
  assert.match(marker, /health_status=pass/);
  assert.match(marker, /deploy_status=success/);
});

test("authenticated smoke dependencies are packaged and verified", () => {
  const packager = readFileSync("scripts/package-standalone.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-standalone-artifact.mjs", "utf8");
  const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");
  for (const path of [
    "scripts/contract-smoke.mjs",
    "scripts/required-api-contracts.mjs",
    "scripts/production/browser-path-smoke.mjs",
    "src/lib/journalismScope.mjs",
  ]) {
    assert.match(packager, new RegExp(path.split("/").map((part) => `(?:${part})`).join("[\\\\/]")), path);
    assert.match(verifier, new RegExp(path.split("/").map((part) => `(?:${part})`).join("[\\\\/]")), path);
  }
  assert.match(workflow, /import\(.*required-api-contracts\.mjs/);
});

test("controlled deployment exception validator is packaged for the activation gate", () => {
  const packager = readFileSync("scripts/package-standalone.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-standalone-artifact.mjs", "utf8");
  assert.match(packager, /controlled-deploy-exception\.mjs/);
  assert.match(packager, /produce-rbac-readiness\.mjs/);
  assert.match(packager, /verify-rbac-disposable-restore\.sh/);
  assert.match(verifier, /controlled-deploy-exception\.mjs/);
  assert.match(verifier, /produce-rbac-readiness\.mjs/);
  assert.match(verifier, /verify-rbac-disposable-restore\.sh/);
});

test("release metadata uses the complete ordered migration reference", () => {
  const packager = readFileSync("scripts/package-standalone.mjs", "utf8");
  const migrationBlock = packager.match(/const migrationReference = \[([\s\S]*?)\];/);
  assert.ok(migrationBlock, "migration reference list is defined");
  const migrations = [...migrationBlock[1].matchAll(/"(supabase\/migrations\/[^"\n]+\.sql)"/g)].map((match) => match[1]);
  assert.ok(migrations.includes("supabase/migrations/20261016110000_asset_locations_expansion.sql"));
  assert.ok(migrations.includes("supabase/migrations/20261016130000_quick_report_completion_date_compatibility.sql"));
  assert.ok(migrations.includes("supabase/migrations/20261027090000_anon_access_lockdown.sql"));
  assert.ok(migrations.includes("supabase/migrations/20261027120000_h03_corrective_partial_objects.sql"));
  assert.ok(migrations.includes("supabase/migrations/20261027120100_h03_batch_idempotency_lockdown.sql"));
  assert.ok(migrations.includes("supabase/migrations/20261027140000_database_management_v1_list_filters.sql"));
  assert.ok(migrations.includes("supabase/migrations/20261027160000_database_management_v1_drop_source_person.sql"));
  assert.ok(migrations.includes("supabase/migrations/20261028090000_database_management_v1_doan_the_types.sql"));
  assert.ok(migrations.includes("supabase/migrations/20261028120000_database_management_v1_record_type_sort_order.sql"));
  assert.ok(migrations.includes("supabase/migrations/20261029090000_business_rule_errcode_55000.sql"));
  assert.equal(migrations.at(-1), "supabase/migrations/20261027090100_storage_anon_lockdown.sql");
  assert.ok(migrations.includes("supabase/migrations/20261028100000_rbac_approval_permissions_v1.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261028150000_attendance_rbac_v1.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261028160000_attendance_late_exception_review.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261028170000_attendance_workday_adjustments.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261028180000_attendance_logs_drop_reviewer_fk.sql"));
  assert.match(packager, /"migration_reference=" \+ migrationReference\.join\(\",\"\)/);
  assert.doesNotMatch(packager, /20261016110000_asset_locations_expansion\.sql",\s*\n\s*"migration_reference=/);
});

test("artifact migration reference includes database list filters", () => {
  for (const path of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) assert.match(readFileSync(path, "utf8"), /20261027140000_database_management_v1_list_filters\.sql/);
});
