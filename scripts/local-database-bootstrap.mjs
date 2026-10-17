import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceSupabase = join(root, "supabase");
const compatibilityName = "20260826195000_local_bootstrap_task_actor_compatibility.sql";
const compatibilitySql = `-- Local disposable bootstrap only; never part of the production migration set.
begin;
insert into public.departments(code,name,active)
values ('general','General (local fixture)',true),('editorial','Editorial (local fixture)',true)
on conflict (code) do update set active=true;
insert into public.roles(code,name,level,active)
values ('admin','Local administrator',99,true)
on conflict (code) do update set active=true;
insert into public.role_permissions(role_id,can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment)
select id,true,true,true,true,true from public.roles where code='admin'
on conflict (role_id) do update set can_manage_users=true,can_manage_permissions=true,can_create_task=true,can_edit_all_tasks=true,can_comment=true;
with fixture(username,full_name,email,role_code,department_code,job_code) as (
  values
    ('admin','Local Admin','admin@local.invalid','admin','leadership','tong_bien_tap'),
    ('thuphuong','Local Reporter EN','thuphuong@local.invalid','phong_vien','content','phong_vien_tieng_anh'),
    ('thithuy','Local Reporter ZH 1','thithuy@local.invalid','phong_vien','content','phong_vien_tieng_trung'),
    ('ngocanh','Local Reporter ZH 2','ngocanh@local.invalid','phong_vien','content','phong_vien_tieng_trung'),
    ('minhduc','Local Reporter LO','minhduc@local.invalid','phong_vien','content','phong_vien_tieng_lao'),
    ('ducanh','Local Reporter KM','ducanh@local.invalid','phong_vien','content','phong_vien_tieng_khmer'),
    ('bachduong','Local Reporter RU','bachduong@local.invalid','phong_vien','content','phong_vien_tieng_nga'),
    ('quangthien','Local Reviewer','quangthien@local.invalid','pho_tong_bien_tap','leadership','pho_tong_bien_tap'),
    ('hongninh','Local Editor','hongninh@local.invalid','phong_vien','content','phong_vien'),
    ('leson','Local Editor 2','leson@local.invalid','phong_vien','content','phong_vien'),
    ('triduong','Local Editor 3','triduong@local.invalid','phong_vien','content','phong_vien'),
    ('thihung','Local Editor 4','thihung@local.invalid','phong_vien','content','phong_vien'),
    ('dinhhai','Local Publisher','dinhhai@local.invalid','phong_vien','content','phong_vien'),
    ('thily','Local Reporter 2','thily@local.invalid','phong_vien','content','phong_vien'),
    ('maianh','Local Reporter 3','maianh@local.invalid','phong_vien','content','phong_vien'),
    ('thidoan','Local Reporter 4','thidoan@local.invalid','phong_vien','content','phong_vien')
)
insert into public.staff_users(full_name,username,email,password_hash,role_id,job_title_id,department_id,active)
select f.full_name,f.username,f.email,crypt('local-only-password',gen_salt('bf',4)),r.id,j.id,d.id,true
from fixture f
join public.roles r on r.code=f.role_code
join public.departments d on d.code=f.department_code
join public.job_titles j on j.code=f.job_code
where not exists (select 1 from public.staff_users u where lower(u.username)=lower(f.username));
update public.staff_users u
set active=true
from (values ('admin'),('thuphuong'),('thithuy'),('ngocanh'),('minhduc'),('ducanh'),('bachduong'),('quangthien'),('hongninh'),('leson'),('triduong'),('thihung'),('dinhhai'),('thily'),('maianh'),('thidoan')) f(username)
where lower(u.username)=f.username;
do $block$
declare
  v_actor uuid;
begin
  select id into v_actor
  from public.staff_users
  where active = true and email = 'hai@example.com'
  order by created_at, id
  limit 1;
  if v_actor is null then
    select id into v_actor
    from public.staff_users
    where active = true
    order by created_at, id
    limit 1;
  end if;
  if v_actor is null then
    raise exception 'Local bootstrap requires an active staff actor.';
  end if;
  update public.tasks
  set created_by = v_actor,
      updated_at = coalesce(updated_at, now())
  where task_type = 'assigned'
    and coalesce(self_claimable, false) = false
    and status = 'new'
    and coalesce(task_category, '') <> 'duty'
    and created_by is null;
end
$block$;
commit;`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function prepare() {
  if (!existsSync(sourceSupabase)) throw new Error("supabase directory is missing");
  const target = mkdtempSync(join(tmpdir(), "thoidai-local-db-v1-"));
  const targetSupabase = join(target, "supabase");
  cpSync(sourceSupabase, targetSupabase, { recursive: true });
  writeFileSync(join(targetSupabase, "migrations", compatibilityName), compatibilitySql, "utf8");
  const configPath = join(targetSupabase, "config.toml");
  let config = readFileSync(configPath, "utf8");
  config = config.replace('project_id = "thoidai-work"', 'project_id = "thoidai-local-db-v1"');
  config = config.replace(/\[db\.seed\][\s\S]*?sql_paths = \["\.\/seed\.sql"\]/, '[db.seed]\nenabled = false\n');
  writeFileSync(configPath, config, "utf8");
  writeFileSync(join(target, ".thoidai-local-bootstrap"), compatibilityName, "utf8");
  return target;
}

const mode = process.argv[2] ?? "start";
if (mode === "prepare") {
  console.log(prepare());
} else if (mode === "start") {
  const target = prepare();
  console.log(`LOCAL_BOOTSTRAP_ROOT=${target}`);
  run("npm", ["exec", "--yes", "supabase", "--", "--workdir", target, "start"]);
  run("npm", ["exec", "--yes", "supabase", "--", "--workdir", target, "db", "query", "--local", "select count(*) as invalid_direct_tasks from public.tasks where task_type='assigned' and coalesce(self_claimable,false)=false and status='new' and coalesce(task_category,'')<>'duty' and created_by is null;"]);
  run("npm", ["exec", "--yes", "supabase", "--", "--workdir", target, "db", "query", "--local", "select count(*) as status_events from public.task_status_events;"]);
  console.log(`Stop later with: npm exec --yes supabase -- stop --workdir "${target}"`);
} else if (mode === "stop") {
  const target = resolve(process.argv[3] ?? "");
  if (!target || !existsSync(join(target, ".thoidai-local-bootstrap"))) throw new Error("Refusing to stop an unmarked bootstrap directory");
  run("npm", ["exec", "--yes", "supabase", "--", "--workdir", target, "stop"]);
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
