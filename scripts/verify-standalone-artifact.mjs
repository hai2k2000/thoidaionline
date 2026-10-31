import assert from "node:assert/strict";
import { existsSync, lstatSync, readFileSync, readlinkSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyManifest } from "./verify-artifact-manifest.mjs";

const root = resolve(process.argv[2] || process.cwd());
// The runtime cache is created on first start; it is intentionally not an uploaded build requirement.
for (const path of [
  "server.js", ".next/BUILD_ID", ".next/server/app-paths-manifest.json", ".next/static", "public", "start-standalone.mjs", "scripts/production/controlled-deploy-exception.mjs", "scripts/production/produce-rbac-readiness.mjs", "scripts/production/verify-rbac-disposable-restore.sh",
  "scripts/contract-smoke.mjs", "scripts/required-api-contracts.mjs", "scripts/production/browser-path-smoke.mjs", "src/lib/journalismScope.mjs",
  "required-route-manifest.json", "deploy/disk-guard.conf", "RELEASE_BASELINE_COMMIT", "MIGRATION_REFERENCE", ".release-meta", ".artifact-manifest.json", ".artifact-manifest.sha256",
]) assert.ok(existsSync(join(root, path)), `missing artifact path: ${path}`);
const smokeContracts = await import(pathToFileURL(join(root, "scripts", "required-api-contracts.mjs")));
assert.equal(smokeContracts.canUseJournalismForSmoke({ role_code: "admin", department_code: null, rbacPermissions: ["journalism.metadata.update"] }), true, "artifact Journalism allow policy mismatch");
assert.equal(smokeContracts.canUseJournalismForSmoke({ role_code: "admin", department_code: null, rbacPermissions: [] }), false, "artifact Journalism deny policy mismatch");
assert.equal(readFileSync(join(root, "RELEASE_BASELINE_COMMIT"), "utf8").trim(), "e501652e969900b97938acccd8f998df4e5d1873", "artifact baseline mismatch");
assert.deepEqual(readFileSync(join(root, "MIGRATION_REFERENCE"), "utf8").trim().split("\n"), [
  "supabase/migrations/20260924120000_task_approval_gates.sql",
  "supabase/migrations/20260924130000_task_assignment_semantics.sql",
  "supabase/migrations/20260926140000_department_plans_v2.sql",
  "supabase/migrations/20260926150000_department_plan_to_task_v1.sql",
  "supabase/migrations/20260926160000_department_plan_assignment_v2.sql",
  "supabase/migrations/20260925100000_journalism_self_registration.sql",
  "supabase/migrations/20260928140000_tbt_any_assignee.sql",
  "supabase/migrations/20260928140100_tbt_recurrence_without_manager.sql",
  "supabase/migrations/20260929110000_creator_only_task_edit_cancel.sql",
  "supabase/migrations/20261001120000_department_plan_quick_assign_v1.sql",
  "supabase/migrations/20261002130000_department_plan_real_multi_assignment_v2.sql",
  "supabase/migrations/20261003100000_department_period_plan_v2.sql",
  "supabase/migrations/20261003120000_department_plan_duplicate_guard.sql",
  "supabase/migrations/20261004100000_department_plan_saturday_friday.sql",
  "supabase/migrations/20261004110000_department_plan_friday_friday.sql",
  "supabase/migrations/20261015100000_rbac_v2_role_user_overrides.sql",
  "supabase/migrations/20261015110000_rbac_v2_scope_ambiguity_fix.sql",
  "supabase/migrations/20261015120000_quick_report_rpc_payload_compatibility.sql",
  "supabase/migrations/20261016100000_asset_locations.sql",
  "supabase/migrations/20261016110000_asset_locations_expansion.sql",
  "supabase/migrations/20261016120000_quick_report_rpc_payload_compatibility_fix.sql",
  "supabase/migrations/20261016120001_asset_locations_reclaim_liquidation.sql",
  "supabase/migrations/20261016130000_quick_report_completion_date_compatibility.sql",
  "supabase/migrations/20261017100000_database_management_v1_foundation.sql",
  "supabase/migrations/20261017101000_database_management_v1_catalog.sql",
  "supabase/migrations/20261017110000_database_management_v1_cp2b_optional_fields.sql",
  "supabase/migrations/20261017130000_database_management_v1_cp3_search_rpc.sql",
  "supabase/migrations/20261017140000_database_management_v1_cp3_search_security_fix.sql",
  "supabase/migrations/20261018100000_database_management_v1_cp3_search_rpc_identifier_fix.sql",
  "supabase/migrations/20261018120000_database_management_v1_cp3_search_scope_fix.sql",
  "supabase/migrations/20261018130000_database_management_v1_cp6_audit_outbox.sql",
  "supabase/migrations/20261019100000_asset_return_to_warehouse.sql",
  "supabase/migrations/20261020100000_database_management_v1_autocode.sql",
  "supabase/migrations/20261020110000_database_management_v1_idempotency.sql",
  "supabase/migrations/20261020130000_database_management_v1_language_groups.sql",
  "supabase/migrations/20261021100000_database_management_v1_filter_approval.sql",
  "supabase/migrations/20261027140000_database_management_v1_list_filters.sql",
  "supabase/migrations/20261027160000_database_management_v1_drop_source_person.sql",
  "supabase/migrations/20261028090000_database_management_v1_doan_the_types.sql",
  "supabase/migrations/20261028120000_database_management_v1_record_type_sort_order.sql",
  "supabase/migrations/20261023130000_database_management_v1_workflow_ambiguity_fix.sql",
  "supabase/migrations/20261024110000_database_management_v1_self_approval.sql",
  "supabase/migrations/20261027090000_anon_access_lockdown.sql",
  "supabase/migrations/20261027120000_h03_corrective_partial_objects.sql",
  "supabase/migrations/20261027120100_h03_batch_idempotency_lockdown.sql",
  "supabase/migrations/20261028100000_rbac_approval_permissions_v1.sql",
  "supabase/migrations/20261028150000_attendance_rbac_v1.sql",
  "supabase/migrations/20261028160000_attendance_late_exception_review.sql",
  "supabase/migrations/20261028170000_attendance_workday_adjustments.sql",
  "supabase/migrations/20261028180000_attendance_logs_drop_reviewer_fk.sql",
  "supabase/migrations/20261029120000_database_management_v1_department_visibility.sql",
  "supabase/migrations/20261030100000_record_approve_department_scope.sql",
  "supabase/migrations/20261031100000_database_management_v1_p2_search_hardening.sql",
  "supabase/migrations/20261031140000_duty_roster_status_fix.sql",
  "supabase/migrations/20261027090100_storage_anon_lockdown.sql",
], "artifact migration mismatch");
const releaseMeta = readFileSync(join(root, ".release-meta"), "utf8");
assert.match(releaseMeta, /protection=managed/);
assert.match(releaseMeta, /build_verification=production-like-env-build-pass/);
assert.match(releaseMeta, /^env_model=(?:symlink:.+|runtime-injected)$/m);
assert.match(releaseMeta, /^build_config=(?:ci-placeholder|canonical-public)$/m);
assert.match(releaseMeta, /^rbac_v2=(?:supported|legacy)$/m);
assert.match(releaseMeta, /(?:^|,)supabase\/migrations\/20261015110000_rbac_v2_scope_ambiguity_fix\.sql(?:,|$)/m);
assert.match(releaseMeta, /(?:^|,)supabase\/migrations\/20261015120000_quick_report_rpc_payload_compatibility\.sql(?:,|$)/m);
assert.match(releaseMeta, /(?:^|,)supabase\/migrations\/20261016100000_asset_locations\.sql(?:,|$)/m);
assert.match(releaseMeta, /(?:^|,)supabase\/migrations\/20261016120000_quick_report_rpc_payload_compatibility_fix\.sql(?:,|$)/m);
assert.match(releaseMeta, /(?:^|,)supabase\/migrations\/20261016130000_quick_report_completion_date_compatibility\.sql(?:,|$)/m);
assert.match(releaseMeta, /(?:^|,)supabase\/migrations\/20261020130000_database_management_v1_language_groups\.sql(?:,|$)/m);
assert.match(releaseMeta, /(?:^|,)supabase\/migrations\/20261024110000_database_management_v1_self_approval\.sql(?:,|$)/m);
for (const field of ["build_id=", "commit=", "branch=", "created_at=", "source_worktree=", "local_head=", "remote_head=", "artifact_source_commit=", "metadata_commit=", "current_production_parent=", "integration_branch=", "integration_baseline=", "contract_suite=", "risk_class=", "risk_test_evidence=", "risk_reason="]) assert.match(releaseMeta, new RegExp(`^${field}[^\\n]+`, "m"));
const routes = JSON.parse(readFileSync(join(root, "required-route-manifest.json"), "utf8"));
const appPaths = JSON.parse(readFileSync(join(root, ".next/server/app-paths-manifest.json"), "utf8"));
for (const { routePath, sourcePath } of routes) assert.ok(Object.hasOwn(appPaths, `${routePath}/${sourcePath?.endsWith("/route.ts") ? "route" : "page"}`), `missing artifact route: ${routePath}`);
const envModel = releaseMeta.match(/^env_model=(.+)$/m)?.[1];
const buildConfig = releaseMeta.match(/^build_config=(.+)$/m)?.[1];
assert.ok(envModel, "artifact environment model is missing");
assert.ok(buildConfig, "artifact build config is missing");
if (buildConfig === "canonical-public") {
  const suspicious = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) {
        const text = readFileSync(path, "utf8");
        if (text.includes("https://ci.invalid/") || text.includes("ci-anon-key-placeholder")) suspicious.push(path);
      }
    }
  };
  for (const path of ["server.js", ".next", "public"]) {
    const candidate = join(root, path);
    if (existsSync(candidate) && lstatSync(candidate).isDirectory()) visit(candidate);
    else if (existsSync(candidate)) {
      const text = readFileSync(candidate, "utf8");
      if (text.includes("https://ci.invalid/") || text.includes("ci-anon-key-placeholder")) suspicious.push(candidate);
    }
  }
  assert.deepEqual(suspicious, [], "canonical-public artifact contains CI Supabase placeholders");
}
const metadata = Object.fromEntries(releaseMeta.split(/\r?\n/).filter(Boolean).map((line) => {
  const index = line.indexOf("=");
  return [line.slice(0, index), line.slice(index + 1)];
}));
const deploymentProfile = metadata.deployment_profile || "default-local-to-target";
assert.ok(["default-local-to-target", "thoidai-work-vps-first"].includes(deploymentProfile), "invalid deployment profile");
assert.ok(["low", "high"].includes(metadata.risk_class), "invalid artifact risk class");
assert.ok(["automated-tests-pass", "missing-or-invalid"].includes(metadata.risk_test_evidence), "invalid artifact risk evidence");
if (metadata.risk_class === "low") assert.equal(metadata.risk_test_evidence, "automated-tests-pass", "low-risk artifact lacks automated test evidence");
for (const field of ["commit", "local_head", "remote_head", "artifact_source_commit", "metadata_commit", "integration_baseline"]) {
  assert.match(metadata[field] || "", /^[0-9a-f]{40}$/i, `invalid provenance SHA: ${field}`);
}
for (const field of ["local_head", "remote_head", "artifact_source_commit", "metadata_commit"]) assert.equal(metadata[field], metadata.commit, `provenance mismatch: ${field}`);
if (deploymentProfile !== "thoidai-work-vps-first") {
  assert.equal(metadata.integration_branch, "integration/production", "artifact integration branch mismatch");
}
for (const name of [".env.local", ".env.production"]) {
  const path = join(root, name);
  if (envModel.startsWith("symlink:")) {
    assert.ok(lstatSync(path).isSymbolicLink(), `${name} must remain a symlink`);
    assert.ok(readlinkSync(path), `${name} symlink target is empty`);
  } else {
    assert.equal(envModel, "runtime-injected", "unsupported artifact environment model");
    assert.equal(existsSync(path), false, `${name} must not be packaged in an external artifact`);
  }
}
await verifyManifest(root);
console.log("standalone-artifact: PASS");
