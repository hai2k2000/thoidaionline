import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const PRODUCER = "thoidai-rbac-v2-safe-rollout-v1";
const MIGRATIONS = [
  ["20261015100000_rbac_v2_role_user_overrides.sql", "6755059e92c145d60582e1b1e3a483690ddf6d770cc13fcc7eb44785554ac20c"],
  ["20261015110000_rbac_v2_scope_ambiguity_fix.sql", "57a364fdc845c31740518530bb801cd53dea2b4e12cd2753ceb92e58fc19578a"],
  ["20261015120000_quick_report_rpc_payload_compatibility.sql", "166a00b769e819fae7e3888926fd65dbcaa6225ef1c6c8b4292648cc5b621a89"],
];

const [canonicalCommit, backupPath, checksumPath, outputDir] = process.argv.slice(2);
if (!/^[a-f0-9]{40}$/.test(canonicalCommit || "") || !backupPath || !checksumPath || !outputDir) {
  throw new Error("usage: produce-rbac-readiness.mjs <canonical-commit> <backup> <migration-checksums> <output-dir>");
}
if (process.getuid?.() !== 0) throw new Error("readiness producer must run as root");
const dbUrl = process.env.THOIDAI_RBAC_DB_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) throw new Error("production database URL is required through THOIDAI_RBAC_DB_URL/DATABASE_URL/SUPABASE_DB_URL");

const root = resolve(outputDir);
await mkdir(root, { recursive: true, mode: 0o700 });
await chmod(root, 0o700);
const rootStat = await lstat(root);
if (!rootStat.isDirectory() || rootStat.uid !== 0 || (rootStat.mode & 0o077) !== 0) throw new Error("readiness output directory must be private and root-owned");

const run = (command, args, options = {}) => execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
const psql = (sql) => run(process.env.THOIDAI_RBAC_PSQL_BIN || "psql", ["--no-psqlrc", "-X", "-v", "ON_ERROR_STOP=1", "-At", "--dbname", dbUrl, "-c", sql]);
const sha256 = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const expectedVersions = MIGRATIONS.map(([name]) => name.slice(0, 14));
const requiredTables = ["staff_users", "roles", "permissions", "supabase_migrations.schema_migrations"];
const protectedRpcSignatures = [
  "public.api_list_effective_permissions(uuid)",
  "public.api_list_role_permission_grants(uuid)",
  "public.api_create_quick_report_v1(uuid,uuid,jsonb)",
  "public.api_replace_role_permissions(uuid,uuid,jsonb)",
  "public.api_set_user_permission_override(uuid,uuid,text,text,text)",
  "public.api_restore_user_permission_inheritance(uuid,uuid)",
  "public.api_clear_user_permission_override(uuid,uuid,text)",
];
const validateRestoreResult = (result, expectedBackupSha, expectedCanonical) => {
  if (!result || typeof result !== "object" || result.status !== "PASS") throw new Error("disposable restore runner did not report PASS");
  if (String(result.postgres_major) !== "17") throw new Error("disposable restore must use PostgreSQL 17");
  if (result.backup_sha256 !== expectedBackupSha) throw new Error("disposable restore used a different backup");
  if (result.canonical_commit !== expectedCanonical) throw new Error("disposable restore evidence is for a different canonical commit");
  if (result.data_assertions !== true) throw new Error("disposable restore did not verify application data");
  if (!Array.isArray(result.application_tables) || !requiredTables.every((table) => result.application_tables.includes(table))) throw new Error("disposable restore did not verify required application tables");
  if (!Array.isArray(result.ledger_versions) || !expectedVersions.every((version) => result.ledger_versions.includes(version))) throw new Error("disposable restore did not verify the RBAC migration ledger");
  if (typeof result.supabase_extension_limits !== "string" || result.supabase_extension_limits.length < 10) throw new Error("disposable restore extension limits are missing");
};
const proof = async (name, details) => {
  const verifiedAt = new Date().toISOString();
  const body = [`producer=${PRODUCER}`, `canonical_commit=${canonicalCommit}`, "status=PASS", `verified_at=${verifiedAt}`, ...details].join("\n") + "\n";
  const path = resolve(root, `${name}.evidence`);
  await writeFile(path, body, { mode: 0o600 });
  await chmod(path, 0o600);
  return { status: "PASS", evidence_path: `${name}.evidence`, sha256: createHash("sha256").update(body).digest("hex") };
};

const backupStat = await lstat(backupPath);
if (!backupStat.isFile() || backupStat.uid !== 0 || (backupStat.mode & 0o077) !== 0) throw new Error("backup must be a private root-owned regular file");
const backupMetaPath = resolve(dirname(backupPath), "backup-meta.txt");
const backupMetaStat = await lstat(backupMetaPath);
if (!backupMetaStat.isFile() || backupMetaStat.uid !== 0 || (backupMetaStat.mode & 0o077) !== 0) throw new Error("backup metadata must be a private root-owned regular file");
const backupMeta = await readFile(backupMetaPath, "utf8");
const expectedBackupSha = backupMeta.match(/^backup_sha256=([a-f0-9]{64})$/m)?.[1];
if (!expectedBackupSha || expectedBackupSha !== await sha256(backupPath)) throw new Error("backup checksum does not match sealed backup metadata");
const checksumStat = await lstat(checksumPath);
if (!checksumStat.isFile() || checksumStat.uid !== 0 || (checksumStat.mode & 0o077) !== 0) throw new Error("migration checksum evidence must be a private root-owned regular file");
const checksums = await readFile(checksumPath, "utf8");
if (!checksums.includes(`canonical_sha=${canonicalCommit}`)) throw new Error("migration checksum evidence is for a different canonical commit");
for (const [name, expected] of MIGRATIONS) if (!checksums.toLowerCase().includes(`${name} ${expected}`)) throw new Error(`migration checksum missing or mismatched: ${name}`);

const checks = {};
checks.backup_integrity = await proof("backup_integrity", [`backup_path=${backupPath}`, `backup_sha256=${expectedBackupSha}`, `backup_size_bytes=${backupStat.size}`]);

const restoreRunner = process.env.THOIDAI_RBAC_DISPOSABLE_RESTORE_RUNNER;
if (!restoreRunner || !restoreRunner.startsWith("/")) throw new Error("trusted disposable restore runner is required; refusing list-only evidence");
const restoreRunnerStat = await lstat(restoreRunner);
if (!restoreRunnerStat.isFile() || restoreRunnerStat.uid !== 0 || (restoreRunnerStat.mode & 0o077) !== 0 || (restoreRunnerStat.mode & 0o111) === 0) throw new Error("disposable restore runner must be a private root-owned executable");
let restoreResult;
try { restoreResult = JSON.parse(run(restoreRunner, [backupPath, canonicalCommit], { env: { ...process.env, THOIDAI_RBAC_RESTORE_DB_URL: dbUrl, THOIDAI_RBAC_RESTORE_PSQL_BIN: process.env.THOIDAI_RBAC_PSQL_BIN || "psql" } })); } catch { throw new Error("disposable restore runner returned invalid evidence"); }
validateRestoreResult(restoreResult, expectedBackupSha, canonicalCommit);
checks.disposable_restore = await proof("disposable_restore", ["postgres_major=17", `backup_sha256=${expectedBackupSha}`, "data_assertions=PASS", "migration_ledger=PASS", `extension_limits=${restoreResult.supabase_extension_limits}`]);

const ledger = psql("select version from supabase_migrations.schema_migrations order by version").split(/\r?\n/).filter(Boolean);
if (expectedVersions.some((version, index) => ledger.indexOf(version) < 0 || (index > 0 && ledger.indexOf(version) < ledger.indexOf(expectedVersions[index - 1])))) throw new Error("RBAC migration ledger is incomplete or out of order");
checks.migration_rbac_v2 = await proof("migration_rbac_v2", [`ledger_versions=${expectedVersions.join(",")}`, `checksums_sha256=${await sha256(checksumPath)}`]);

const schema = psql(`select case when
  (select count(*) from information_schema.columns where table_schema='public' and table_name='user_permission_grants' and column_name='effect')=1
  and (select count(*) from pg_constraint where conname='user_permission_grants_effect_check')=1
  and (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='api_list_effective_permissions')=1
  and (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='api_list_role_permission_grants')=1
  and (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='api_create_quick_report_v1')=1
 then 'PASS' else 'FAIL' end`);
if (schema !== "PASS") throw new Error("RBAC schema/RPC postcondition failed");
checks.schema_rpc = await proof("schema_rpc", ["effect_constraint=present", "effective_permissions_rpc=present", "scope_rpc=present", "quick_report_rpc=present"]);

const grants = psql(`with expected(signature) as (values ${protectedRpcSignatures.map((signature) => `('${signature}')`).join(",")})
select case when count(*) = ${protectedRpcSignatures.length} and bool_and(p.oid is not null and pg_get_userbyid(p.proowner)='postgres' and has_function_privilege('service_role', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute')) then 'PASS' else 'FAIL' end
from expected e left join pg_proc p on p.oid = to_regprocedure(e.signature)`);
if (grants !== "PASS") throw new Error("protected RPC grant parity failed");
checks.grants_parity = await proof("grants_parity", [`protected_rpc_signatures=${protectedRpcSignatures.join(",")}`, "protected_rpc_owner=postgres", "service_role_execute=present", "anon_execute=denied", "authenticated_execute=denied"]);

try { psql("select public.rbac_v2_assert_manager_survives()"); } catch { throw new Error("last permission.manage manager guard failed"); }
const manager = psql("select case when exists (select 1 from public.staff_users u where u.active = true and exists (select 1 from public.api_list_effective_permissions(u.id) where permission_code='permission.manage' and cardinality(effective_scopes) > 0)) then 'PASS' else 'FAIL' end");
if (manager !== "PASS") throw new Error("last permission.manage manager guard failed");
checks.last_permission_manager = await proof("last_permission_manager", ["manager_survival_guard=PASS", "active_effective_permission_manage_manager=PASS"]);

const now = new Date();
const readiness = { schema_version: 1, evidence_scope: "rbac-v2-production-readiness", canonical_commit: canonicalCommit, produced_by: PRODUCER, producer_version: 1, verified_at: now.toISOString(), expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), checks };
const readinessPath = resolve(root, "readiness.json");
await writeFile(readinessPath, `${JSON.stringify(readiness, null, 2)}\n`, { mode: 0o600 });
await chmod(readinessPath, 0o600);
console.log(`readiness: PASS ${readinessPath}`);
