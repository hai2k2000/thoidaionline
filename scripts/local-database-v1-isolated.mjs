import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceSupabase = join(root, "supabase");
const baselineCutoff = "20260901095000_backend_security_hardening.sql";
const v1Migrations = new Set([
  "20260911083000_fix_first_login_default_password.sql",
  "20260911110000_enable_deputy_department_assignment.sql",
  "20260911133000_scope_leave_review_to_department.sql",
  "20260911150000_lock_task_completion_scores.sql",
  "20260911170000_atomic_attendance_completion.sql",
  "20260911180000_align_deputy_assignment_reviewer.sql",
  "20260911190000_enforce_first_login_password_change.sql",
  "20260911230000_atomic_attendance_log_merge.sql",
  "20260915120000_personal_work_plans.sql",
  "20260916100000_phase1a_rbac_core.sql",
  "20260916103000_phase1a_rbac_db_helper.sql",
  "20260916104500_phase1a_rbac_compatibility_completion.sql",
  "20261017100000_database_management_v1_foundation.sql",
  "20261017101000_database_management_v1_catalog.sql",
]);
const compatibilityName = "20260826195000_local_bootstrap_task_actor_compatibility.sql";
const compatibilitySql = `begin;
insert into public.roles(code,name,level,active) values ('admin','Local administrator',99,true) on conflict (code) do update set active=true;
insert into public.role_permissions(role_id,can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment)
select id,true,true,true,true,true from public.roles where code='admin'
on conflict (role_id) do update set can_manage_users=true,can_manage_permissions=true,can_create_task=true,can_edit_all_tasks=true,can_comment=true;
insert into public.staff_users(full_name,username,email,password,password_hash,role_id,job_title_id,department_id,active)
select 'Local Admin','admin','admin@local.invalid','local-only-password',extensions.crypt('local-only-password',extensions.gen_salt('bf',4)),r.id,j.id,d.id,true
from public.roles r cross join public.job_titles j cross join public.departments d
where r.code='admin' and j.code='nhan_vien' and d.code='leadership'
  and not exists (select 1 from public.staff_users where lower(username)='admin');
with fixture(username,full_name,email) as (values
  ('thuphuong','Local Reporter EN','thuphuong@local.invalid'),
  ('thithuy','Local Reporter ZH 1','thithuy@local.invalid'),
  ('ngocanh','Local Reporter ZH 2','ngocanh@local.invalid'),
  ('minhduc','Local Reporter LO','minhduc@local.invalid'),
  ('ducanh','Local Reporter KM','ducanh@local.invalid'),
  ('bachduong','Local Reporter RU','bachduong@local.invalid')
)
insert into public.staff_users(full_name,username,email,password,password_hash,role_id,job_title_id,department_id,active)
select f.full_name,f.username,f.email,'local-only-password',extensions.crypt('local-only-password',extensions.gen_salt('bf',4)),r.id,j.id,d.id,true
from fixture f cross join public.roles r cross join public.job_titles j cross join public.departments d
where r.code='phong_vien' and j.code='phong_vien' and d.code='content'
  and not exists (select 1 from public.staff_users u where lower(u.username)=f.username);
do $block$
declare v_actor uuid;
begin
  select id into v_actor from public.staff_users where active = true order by created_at, id limit 1;
  if v_actor is null then raise exception 'isolated baseline requires an active staff actor'; end if;
  update public.tasks set created_by = v_actor, updated_at = coalesce(updated_at, now())
  where task_type = 'assigned' and coalesce(self_claimable, false) = false
    and status = 'new' and coalesce(task_category, '') <> 'duty' and created_by is null;
end
$block$;
commit;`;
const verificationSql = `select
  case when (select count(*) from public.db_record_types where active)=44
    and (select count(*) from public.db_form_definitions where status='published')=44
    and to_regclass('public.db_categories') is not null
    and to_regclass('public.db_record_acl') is not null
    and to_regclass('public.db_record_history') is not null
    and exists (select 1 from pg_class where oid='public.db_records'::regclass and relrowsecurity)
    and has_table_privilege('service_role','public.db_records','select')
    and has_table_privilege('service_role','public.db_records','insert')
  then 'CSDL_ISOLATED_SCHEMA PASS' else 'CSDL_ISOLATED_SCHEMA FAIL' end as result,
  (select count(*) from public.db_record_types where active) as active_record_types,
  (select count(*) from public.db_form_definitions where status='published') as published_forms;`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", ...options });
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? "unknown"}`);
}

export function prepare() {
  if (!existsSync(sourceSupabase)) throw new Error("supabase directory is missing");
  const target = mkdtempSync(join(tmpdir(), "thoidai-csdl-v1-isolated-"));
  const targetSupabase = join(target, "supabase");
  cpSync(sourceSupabase, targetSupabase, { recursive: true });
  const migrationDir = join(targetSupabase, "migrations");
  for (const name of readdirSync(migrationDir)) {
    if (name.endsWith(".sql") && (name > baselineCutoff && !v1Migrations.has(name))) rmSync(join(migrationDir, name), { force: true });
  }
  writeFileSync(join(migrationDir, compatibilityName), compatibilitySql, "utf8");
  let config = readFileSync(join(targetSupabase, "config.toml"), "utf8");
  const projectId = `thoidai-csdl-v1-${target.split(/[\\\\/]/).pop()?.toLowerCase() ?? "local"}`.replace(/[^a-z0-9-]/g, "-");
  config = config.replace('project_id = "thoidai-work"', `project_id = "${projectId}"`);
  config = config.replace(/\[db\.seed\][\s\S]*?sql_paths = \["\.\/seeds\/.*?\"\]/, "[db.seed]\nenabled = false\n");
  writeFileSync(join(targetSupabase, "config.toml"), config, "utf8");
  writeFileSync(join(target, ".thoidai-csdl-v1-isolated"), JSON.stringify({ baselineCutoff, v1Migrations: [...v1Migrations], compatibilityName, projectId }), "utf8");
  return target;
}

const mode = process.argv[2] ?? "start";
if (mode === "prepare") {
  console.log(prepare());
} else if (mode === "start") {
  const target = prepare();
  const verificationPath = join(target, "verify.sql");
  writeFileSync(verificationPath, verificationSql, "utf8");
  console.log(`ISOLATED_ROOT=${target}`);
  try {
    run("npm", ["exec", "--yes", "supabase", "--", "--workdir", target, "start"]);
    run("npm", ["exec", "--yes", "supabase", "--", "--workdir", target, "db", "query", "--local", "--file", verificationPath]);
    console.log(`Stop later with: npm exec --yes supabase -- stop --workdir "${target}"`);
  } catch (error) {
    try { run("npm", ["exec", "--yes", "supabase", "--", "--workdir", target, "stop"]); } catch { /* best effort for a disposable runtime */ }
    throw error;
  }
} else if (mode === "stop") {
  const target = resolve(process.argv[3] ?? "");
  if (!target || !existsSync(join(target, ".thoidai-csdl-v1-isolated"))) throw new Error("Refusing to stop an unmarked isolated directory");
  run("npm", ["exec", "--yes", "supabase", "--", "--workdir", target, "stop"]);
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
