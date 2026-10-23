import { cp, lstat, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { REQUIRED_PRODUCTION_ROUTES } from "../src/lib/requiredProductionRoutes.mjs";

const root = process.cwd();
const build = join(root, ".next");
const standalone = join(build, "standalone");
const buildId = (await readFile(join(build, "BUILD_ID"), "utf8")).trim();
const baselineText = await readFile(join(root, "scripts/check-release-baseline.mjs"), "utf8");
const canonicalBaseline = baselineText.match(/legacyBaseline = "([^"]+)"/)?.[1] || baselineText.match(/canonicalBaseline = "([^"]+)"/)?.[1];
const output = resolve(process.env.STANDALONE_ARTIFACT_DIR || join(root, ".artifacts", "standalone", `${buildId}-${Date.now()}`));
const directoryBytes = async (path) => {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) return stat.size;
  let total = 0;
  for (const entry of await readdir(path)) total += await directoryBytes(join(path, entry));
  return total;
};
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const dirtyFiles = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const gitValue = (args, envName, fallback = "") => {
  if (process.env[envName]) return process.env[envName];
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    if (fallback) return fallback;
    throw new Error(`missing ${envName} and git value ${args.join(" ")}`);
  }
};
const remoteHead = gitValue(["rev-parse", "@{u}"], "THOIDAI_REMOTE_HEAD", commit);
const integrationBranch = process.env.THOIDAI_INTEGRATION_BRANCH || "integration/production";
const integrationBaseline = gitValue(["rev-parse", integrationBranch], "THOIDAI_INTEGRATION_COMMIT", commit);
const currentProductionParent = process.env.THOIDAI_CURRENT_PRODUCTION_COMMIT || "e72e4969a0fd20f176bb906f4f2203d58f30a74e";
const branch = process.env.THOIDAI_RELEASE_BRANCH || gitValue(["branch", "--show-current"], "THOIDAI_RELEASE_BRANCH", "detached");
const sourceWorktree = process.env.THOIDAI_SOURCE_WORKTREE || root;
const runtimeEnvModel = process.env.THOIDAI_RUNTIME_ENV_MODEL || "symlink:/opt/thoidai-work/.env.local,/opt/thoidai-work/.env.production";
const deploymentProfile = process.env.THOIDAI_DEPLOYMENT_PROFILE || "default-local-to-target";
if (!["default-local-to-target", "thoidai-work-vps-first"].includes(deploymentProfile)) throw new Error(`unsupported deployment profile: ${deploymentProfile}`);
const buildConfig = process.env.THOIDAI_BUILD_CONFIG || (process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("https://ci.invalid/") ? "ci-placeholder" : "canonical-public");
if (!["ci-placeholder", "canonical-public"].includes(buildConfig)) throw new Error(`unsupported artifact build config: ${buildConfig}`);
const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
if (buildConfig === "ci-placeholder") {
  if (!publicSupabaseUrl.startsWith("https://ci.invalid/") || publicSupabaseAnonKey !== "ci-anon-key-placeholder") throw new Error("ci-placeholder artifact requires non-production public Supabase placeholders");
} else if (!publicSupabaseUrl || publicSupabaseUrl.startsWith("https://ci.invalid/") || publicSupabaseAnonKey === "ci-anon-key-placeholder") {
  throw new Error("canonical-public artifact requires valid public Supabase configuration");
}

if (!existsSync(standalone)) throw new Error("Next standalone output is missing; run next build first.");
if (!canonicalBaseline) throw new Error("canonical baseline is missing from check-release-baseline.mjs");
if (existsSync(output)) throw new Error(`artifact already exists: ${output}`);
execFileSync(process.execPath, ["scripts/check-required-routes.mjs"], { cwd: root, stdio: "inherit" });
await mkdir(output, { recursive: true });
await cp(standalone, output, { recursive: true });
// Next 16 standalone tracing can omit framework constants required by the runtime.
const nextFramework = join(root, "node_modules", "next", "dist", "lib", "framework");
const outputNextFramework = join(output, "node_modules", "next", "dist", "lib", "framework");
if (existsSync(nextFramework)) {
  await mkdir(outputNextFramework, { recursive: true });
  await cp(nextFramework, outputNextFramework, { recursive: true });
}
await mkdir(join(output, ".next", "cache"), { recursive: true });
await cp(join(build, "static"), join(output, ".next", "static"), { recursive: true });
if (existsSync(join(root, "public"))) await cp(join(root, "public"), join(output, "public"), { recursive: true });
const sharedRoot = process.env.THOIDAI_SHARED_ROOT || "/opt/thoidai-work";
for (const name of [".env.local", ".env.production"]) {
  await rm(join(output, name), { force: true });
  if (runtimeEnvModel.startsWith("symlink:")) await symlink(join(sharedRoot, name), join(output, name));
}
await cp(join(root, "scripts", "start-standalone.mjs"), join(output, "start-standalone.mjs"));
await cp(join(root, "scripts", "verify-standalone-artifact.mjs"), join(output, "verify-standalone-artifact.mjs"));
await cp(join(root, "scripts", "artifact-manifest.mjs"), join(output, "artifact-manifest.mjs"));
await cp(join(root, "scripts", "verify-artifact-manifest.mjs"), join(output, "verify-artifact-manifest.mjs"));
const authenticatedSmokeFiles = [
  "scripts/contract-smoke.mjs",
  "scripts/required-api-contracts.mjs",
  "scripts/production/browser-path-smoke.mjs",
  "src/lib/journalismScope.mjs",
];
for (const relativePath of authenticatedSmokeFiles) {
  const destination = join(output, ...relativePath.split("/"));
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(root, ...relativePath.split("/")), destination);
}
await mkdir(join(output, "scripts", "production"), { recursive: true });
for (const name of ["build-standalone-release.sh", "mark-release-success.sh", "release-retention.sh", "controlled-deploy-exception.mjs", "produce-rbac-readiness.mjs", "verify-rbac-disposable-restore.sh"]) {
  await cp(join(root, "scripts", "production", name), join(output, "scripts", "production", name));
}
await rm(join(output, "scripts", "check-required-routes.mjs"), { force: true });
await cp(join(root, "scripts", "check-release-baseline.mjs"), join(output, "scripts", "check-release-baseline.mjs"));
await writeFile(join(output, "RELEASE_BASELINE_COMMIT"), `${canonicalBaseline}\n`);
await writeFile(join(output, "required-route-manifest.json"), `${JSON.stringify(REQUIRED_PRODUCTION_ROUTES, null, 2)}\n`);
const migrationReference = [
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
  "supabase/migrations/20261023130000_database_management_v1_workflow_ambiguity_fix.sql",
  "supabase/migrations/20261024110000_database_management_v1_self_approval.sql",
];
await writeFile(join(output, "MIGRATION_REFERENCE"), migrationReference.join("\n") + "\n");
const riskOutput = execFileSync(process.execPath, ["scripts/classify-release-risk.mjs", root], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, THOIDAI_RISK_BASE: process.env.THOIDAI_RISK_BASE || currentProductionParent },
});
const risk = Object.fromEntries(riskOutput.trim().split(/\r?\n/).map((line) => {
  const index = line.indexOf("=");
  return [line.slice(0, index), line.slice(index + 1)];
}));
if (!["low", "high"].includes(risk.risk_class)) throw new Error("risk classifier did not return a valid risk class");
if (!["automated-tests-pass", "missing-or-invalid"].includes(risk.risk_test_evidence)) throw new Error("risk classifier did not return valid test evidence");
await writeFile(join(output, "package.json"), `${JSON.stringify({ name: "thoidai-work-runtime", version: "0.1.0", private: true, scripts: { start: "node start-standalone.mjs" } }, null, 2)}\n`);
const artifactBytes = String(await directoryBytes(output));
await writeFile(join(output, ".release-meta"), [
  `release_id=${buildId}-standalone`,
  `build_id=${buildId}`,
  `commit=${commit}`,
  `branch=${branch}`,
  `local_head=${commit}`,
  `remote_head=${remoteHead}`,
  `artifact_source_commit=${commit}`,
  `metadata_commit=${commit}`,
  `current_production_parent=${currentProductionParent}`,
  `integration_branch=${integrationBranch}`,
  `deployment_profile=${deploymentProfile}`,
  `integration_baseline=${integrationBaseline}`,
  `source_worktree=${sourceWorktree}`,
  `dirty_tree=${dirtyFiles.length ? "dirty" : "clean"}`,
  `dirty_file_count=${dirtyFiles.length}`,
  "deployed_at=",
  `created_at=${new Date().toISOString()}`,
  "artifact_type=next-standalone",
  `canonical_baseline=${canonicalBaseline}`,
  `artifact_bytes=${artifactBytes}`,
  "rbac_v2=supported",
  "migration_reference=" + migrationReference.join(","),
  `env_model=${runtimeEnvModel}`,
  `build_config=${buildConfig}`,
  "build_verification=production-like-env-build-pass",
  `contract_suite=${process.env.THOIDAI_CONTRACT_SUITE_RESULT || "pending"}`,
  `risk_class=${risk.risk_class}`,
  `risk_test_evidence=${risk.risk_test_evidence}`,
  `risk_reason=${risk.risk_reason || "unknown"}`,
  "protection=managed",
  "rollback_eligible=yes",
  "health_status=pending",
  "deploy_status=pending",
  "rollback_role=unassigned",
  "",
].join("\n"));
await import(pathToFileURL(join(output, "artifact-manifest.mjs")).href).then(({ writeManifest }) => writeManifest(output));
execFileSync(process.execPath, [join(output, "verify-standalone-artifact.mjs"), output], { stdio: "inherit" });
console.log(`standalone-artifact: ${output}`);
