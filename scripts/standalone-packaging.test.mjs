import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync("next.config.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("leader personal event migration ships once after all-staff event migration", () => {
  for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) {
    const source = readFileSync(file, "utf8");
    const migration = "supabase/migrations/20261106200000_leader_edit_personal_events.sql";
    assert.equal(source.split(migration).length - 1, 1);
    assert.ok(source.indexOf(migration) > source.indexOf("supabase/migrations/20261106180000_event_assignment_all_staff.sql"));
  }
});

test('manager deputy project watcher migration follows deadline sort in each migration reference', () => {
  for (const path of ['scripts/package-standalone.mjs', 'scripts/verify-standalone-artifact.mjs']) {
    const source = readFileSync(path, 'utf8');
    const migration = 'supabase/migrations/20261106150000_manager_deputy_watch_projects.sql';
    assert.equal(source.split(migration).length - 1, 1);
    assert.ok(source.indexOf(migration) > source.indexOf('supabase/migrations/20261106120000_task_list_deadline_sort.sql'));
  }
});

test("CTV and Projects migrations are shipped once in version order in both reference lists", () => {
  for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) {
    const source = readFileSync(file, "utf8");
    const ctv = '"supabase/migrations/20261103150000_role_cong_tac_vien.sql"';
    const projects = '"supabase/migrations/20261103160000_projects_v1.sql"';
    const optional = '"supabase/migrations/20261105140000_task_assignment_optional_deadline.sql"';
    assert.equal(source.split(ctv).length - 1, 1, file);
    assert.equal(source.split(projects).length - 1, 1, file);
    assert.ok(source.indexOf(ctv) < source.indexOf(projects), file);
    assert.equal(source.split(optional).length - 1, 1, file);
    const onBehalf = '"supabase/migrations/20261105150000_task_assignment_on_behalf.sql"';
    assert.equal(source.split(onBehalf).length - 1, 1, file);
    assert.ok(source.indexOf(optional) < source.indexOf(onBehalf), file);
  }
});
test("admin participant migration is packaged", () => {
  for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) assert.match(readFileSync(file, "utf8"), /20261106100000_admin_edit_task_participants\.sql/);
});
test("admin attachment delete migration is packaged", () => {
  for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) assert.match(readFileSync(file, "utf8"), /20261106130000_admin_task_attachment_delete\.sql/);
});

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
test("disk guard config is packaged for artifact-local deploy gate", () => {
  const packager = readFileSync("scripts/package-standalone.mjs", "utf8");
  const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");
  const deploy = readFileSync("scripts/production/deploy-external-artifact.sh", "utf8");
  assert.match(packager, /disk-guard\.conf/);
  assert.match(workflow, /deploy\/disk-guard\.conf/);
  assert.match(deploy, /disk-guard\.conf/);
  assert.match(deploy, /artifact disk guard config missing/);
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
  const verifier = readFileSync("scripts/verify-standalone-artifact.mjs", "utf8");
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
  assert.equal(migrations.at(-1), "supabase/migrations/20261027090100_storage_anon_lockdown.sql");
  assert.ok(migrations.includes("supabase/migrations/20261028100000_rbac_approval_permissions_v1.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261028150000_attendance_rbac_v1.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261028160000_attendance_late_exception_review.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261028170000_attendance_workday_adjustments.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261028180000_attendance_logs_drop_reviewer_fk.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261029120000_database_management_v1_department_visibility.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261030100000_record_approve_department_scope.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261031100000_database_management_v1_p2_search_hardening.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261102140000_database_management_v1_p2_restricted_groups.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261102160000_database_management_v1_p2_form_fields_fix.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261102170000_database_management_v1_to_tieng_viet_forms.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261102190000_database_management_v1_gopy_dot1_forms.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261103100000_database_management_v1_p3_tong_hop_subgroups.sql"));
    assert.ok(migrations.includes("supabase/migrations/20261103120000_database_management_v1_doan_the_parent.sql"));
  assert.ok(migrations.includes("supabase/migrations/20261103140000_database_management_v1_keywords_fix_remaining.sql"));
    assert.match(packager, /20261103120000_database_management_v1_doan_the_parent\.sql/);
    assert.match(packager, /20261103140000_database_management_v1_keywords_fix_remaining\.sql/);
    assert.match(verifier, /20261103140000_database_management_v1_keywords_fix_remaining\.sql/);
    assert.match(verifier, /20261103120000_database_management_v1_doan_the_parent\.sql/);
    assert.match(packager, /20261103100000_database_management_v1_p3_tong_hop_subgroups\.sql/);
  assert.match(verifier, /20261103100000_database_management_v1_p3_tong_hop_subgroups\.sql/);
    assert.ok(migrations.includes("supabase/migrations/20261031140000_duty_roster_status_fix.sql"));
  assert.match(packager, /"migration_reference=" \+ migrationReference\.join\(\",\"\)/);
  assert.doesNotMatch(packager, /20261016110000_asset_locations_expansion\.sql",\s*\n\s*"migration_reference=/);
});

test("artifact migration reference includes database list filters", () => {
  for (const path of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) assert.match(readFileSync(path, "utf8"), /20261027140000_database_management_v1_list_filters\.sql/);
});

test("packaging references collaborator role migration", () => {
  const packager = readFileSync("scripts/package-standalone.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-standalone-artifact.mjs", "utf8");
  assert.match(packager, /20261103150000_role_cong_tac_vien\.sql/);
  assert.match(verifier, /20261103150000_role_cong_tac_vien\.sql/);
});

test("Projects V1.1 migration is packaged", () => { for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) assert.ok(readFileSync(file,"utf8").includes("20261103180000_projects_v1_1_deputy_library.sql")); });

test("Projects V1.2 migration is packaged", () => { for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) assert.ok(readFileSync(file,"utf8").includes("20261103200000_projects_v1_2_permissions.sql")); });

test("Asset bulk import migration is packaged", () => { for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) assert.ok(readFileSync(file,"utf8").includes("20261104100000_asset_bulk_import.sql")); });

test("Projects reopen migration is packaged once", () => { for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) assert.equal(readFileSync(file,"utf8").split("supabase/migrations/20261105100000_projects_reopen.sql").length - 1, 1); });
test("Cancelled project task delete migration is packaged once", () => { for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) assert.equal(readFileSync(file,"utf8").split("supabase/migrations/20261105200000_project_cancelled_task_delete.sql").length - 1, 1); });

test("Collaborator manager watch migration is packaged once", () => { for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) assert.equal(readFileSync(file,"utf8").split("supabase/migrations/20261105230000_collaborator_manager_watch.sql").length - 1, 1); });

test("Task deadline sort migration is packaged once", () => { for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) assert.equal(readFileSync(file,"utf8").split("supabase/migrations/20261106120000_task_list_deadline_sort.sql").length - 1, 1); });

test('all-staff event migration ships after manager deputy migration in both lists', () => {
  for (const file of ['scripts/package-standalone.mjs', 'scripts/verify-standalone-artifact.mjs']) {
    const source = readFileSync(file, 'utf8');
    const migration = 'supabase/migrations/20261106180000_event_assignment_all_staff.sql';
    assert.equal(source.split(migration).length - 1, 1);
    assert.ok(source.indexOf(migration) > source.indexOf('supabase/migrations/20261106150000_manager_deputy_watch_projects.sql'));
  }
});

test("completed assignment migration ships once after leader personal event migration", () => {
  for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) {
    const source = readFileSync(file, "utf8");
    const migration = "supabase/migrations/20261106210000_edit_completed_event_assignment.sql";
    assert.equal(source.split(migration).length - 1, 1);
    assert.ok(source.indexOf(migration) > source.indexOf("supabase/migrations/20261106200000_leader_edit_personal_events.sql"));
  }
});

test("push notification migration is packaged once after leader event editing", () => {
  for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) {
    const source = readFileSync(file, "utf8");
    const migration = "supabase/migrations/20261107100000_push_notifications.sql";
    assert.equal(source.split(migration).length - 1, 1);
    assert.ok(source.indexOf(migration) > source.indexOf("20261106210000_edit_completed_event_assignment.sql"));
  }
});

 test("push v2 migration follows v1 exactly once in both artifact references", () => {
   for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) {
     const source = readFileSync(file, "utf8");
     const migration = "supabase/migrations/20261107120000_push_notifications_v2.sql";
     assert.equal(source.split(migration).length - 1, 1);
     assert.ok(source.indexOf(migration) > source.indexOf("20261107100000_push_notifications.sql"));
   }
 });

test("admin project task edit migration follows push v2 exactly once", () => {
  for (const file of ["scripts/package-standalone.mjs", "scripts/verify-standalone-artifact.mjs"]) {
    const source = readFileSync(file, "utf8");
    const migration = "supabase/migrations/20261107140000_admin_edit_project_task_status.sql";
    assert.equal(source.split(migration).length - 1, 1);
    assert.ok(source.indexOf(migration) > source.indexOf("20261107120000_push_notifications_v2.sql"));
  }
});
