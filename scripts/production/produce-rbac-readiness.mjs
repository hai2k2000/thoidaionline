import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
const proof = async (name, details) => {
  const verifiedAt = new Date().toISOString();
  const body = [`producer=${PRODUCER}`, `canonical_commit=${canonicalCommit}`, "status=PASS", `verified_at=${verifiedAt}`, ...details].join("\n") + "\n";
  const path = resolve(root, `${name}.evidence`);
  await writeFile(path, body, { mode: 0o600 });
  await chmod(path, 0o600);
  return { status: "PASS", evidence_path: `${name}.evidence`, sha256: createHash("sha256").update(body).digest("hex") };
};

const backupStat = await stat(backupPath);
if (!backupStat.isFile() || backupStat.uid !== 0 || (backupStat.mode & 0o077) !== 0) throw new Error("backup must be a private root-owned regular file");
const backupMetaPath = resolve(dirname(backupPath), "backup-meta.txt");
const backupMetaStat = await stat(backupMetaPath);
if (!backupMetaStat.isFile() || backupMetaStat.uid !== 0 || (backupMetaStat.mode & 0o077) !== 0) throw new Error("backup metadata must be a private root-owned regular file");
const backupMeta = await readFile(backupMetaPath, "utf8");
const expectedBackupSha = backupMeta.match(/^backup_sha256=([a-f0-9]{64})$/m)?.[1];
if (!expectedBackupSha || expectedBackupSha !== await sha256(backupPath)) throw new Error("backup checksum does not match sealed backup metadata");
const checksumStat = await stat(checksumPath);
if (!checksumStat.isFile() || checksumStat.uid !== 0 || (checksumStat.mode & 0o077) !== 0) throw new Error("migration checksum evidence must be a private root-owned regular file");
const checksums = await readFile(checksumPath, "utf8");
if (!checksums.includes(`canonical_sha=${canonicalCommit}`)) throw new Error("migration checksum evidence is for a different canonical commit");
for (const [name, expected] of MIGRATIONS) if (!checksums.toLowerCase().includes(`${name} ${expected}`)) throw new Error(`migration checksum missing or mismatched: ${name}`);

const checks = {};
checks.backup_integrity = await proof("backup_integrity", [`backup_path=${backupPath}`, `backup_sha256=${expectedBackupSha}`, `backup_size_bytes=${backupStat.size}`]);

const restoreCommand = process.env.THOIDAI_RBAC_DISPOSABLE_RESTORE_COMMAND;
if (!restoreCommand) throw new Error("trusted disposable restore command is required; refusing list-only evidence");
run("/bin/sh", ["-c", restoreCommand]);
checks.disposable_restore = await proof("disposable_restore", ["restore_exit=0"]);

const ledger = psql("select version from supabase_migrations.schema_migrations order by version").split(/\r?\n/).filter(Boolean);
const expectedVersions = MIGRATIONS.map(([name]) => name.slice(0, 14));
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

const grants = psql(`select case when bool_and(pg_get_userbyid(p.proowner)='postgres' and has_function_privilege('service_role', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute')) then 'PASS' else 'FAIL' end
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('api_list_effective_permissions','api_list_role_permission_grants','api_create_quick_report_v1','api_replace_role_permissions','api_set_user_permission_override','api_restore_user_permission_inheritance','api_clear_user_permission_override')`);
if (grants !== "PASS") throw new Error("protected RPC grant parity failed");
checks.grants_parity = await proof("grants_parity", ["protected_rpc_owner=postgres", "service_role_execute=present", "anon_execute=denied", "authenticated_execute=denied"]);

const manager = psql("select case when public.rbac_v2_assert_manager_survives() and exists (select 1 from public.api_list_effective_permissions((select id from public.staff_users where username='admin' limit 1)) where permission_code='permission.manage' and effective_scopes @> array['all']::text[]) then 'PASS' else 'FAIL' end");
if (manager !== "PASS") throw new Error("last permission.manage manager guard failed");
checks.last_permission_manager = await proof("last_permission_manager", ["manager_survival_guard=PASS", "effective_permission_manage_all=PASS"]);

const now = new Date();
const readiness = { schema_version: 1, evidence_scope: "rbac-v2-production-readiness", canonical_commit: canonicalCommit, produced_by: PRODUCER, producer_version: 1, verified_at: now.toISOString(), expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), checks };
const readinessPath = resolve(root, "readiness.json");
await writeFile(readinessPath, `${JSON.stringify(readiness, null, 2)}\n`, { mode: 0o600 });
await chmod(readinessPath, 0o600);
console.log(`readiness: PASS ${readinessPath}`);
