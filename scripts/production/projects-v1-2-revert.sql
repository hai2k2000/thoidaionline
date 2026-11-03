-- Restore V1.1 behavior without removing projects, membership or library data.
-- Run only with target-specific approval and a verified backup.
begin;
drop function if exists public.api_transfer_project_lead(uuid,uuid,uuid,text);
create or replace function public.api_project_actor_can_create(p_actor uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.api_list_effective_permissions(p_actor) e where e.permission_code='project.create' and cardinality(e.effective_scopes)>0);
$$;

revoke all on function public.api_project_actor_can_create(uuid) from public,anon,authenticated;

grant execute on function public.api_project_actor_can_create(uuid) to service_role;

alter function public.api_project_actor_can_create(uuid) owner to postgres;

create or replace function public.api_project_is_lead(p_actor uuid,p_project uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project and m.user_id=p_actor and m.role='lead' and u.active);
$$;

revoke all on function public.api_project_is_lead(uuid,uuid) from public,anon,authenticated;

grant execute on function public.api_project_is_lead(uuid,uuid) to service_role;

alter function public.api_project_is_lead(uuid,uuid) owner to postgres;

create or replace function public.api_project_can_assign(p_actor uuid,p_project uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id join public.roles r on r.id=u.role_id where m.project_id=p_project and m.user_id=p_actor and m.role in ('lead','deputy') and u.active and r.code<>'cong_tac_vien');
$$;

revoke all on function public.api_project_can_assign(uuid,uuid) from public,anon,authenticated;

grant execute on function public.api_project_can_assign(uuid,uuid) to service_role;

alter function public.api_project_can_assign(uuid,uuid) owner to postgres;

create or replace function public.api_create_project(p_actor_id uuid,p_code text,p_name text,p_description text,p_host_department_id uuid,p_lead_ids uuid[] default '{}'::uuid[]) returns public.projects
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.projects; v_lead uuid;
begin
 if not public.api_project_actor_can_create(p_actor_id) then raise exception 'Project create forbidden.' using errcode='42501'; end if;
 if nullif(btrim(p_code),'') is null or nullif(btrim(p_name),'') is null or length(p_code)>100 or length(p_name)>250 or length(p_description)>10000 or not exists(select 1 from public.departments where id=p_host_department_id and active) or cardinality(coalesce(p_lead_ids,'{}'))=0 then raise exception 'Invalid project input.' using errcode='22023'; end if;
 if exists(select 1 from public.projects where code=btrim(p_code)) then raise exception 'Project code already exists.' using errcode='23505'; end if;
 if exists(select 1 from unnest(p_lead_ids) x where not exists(select 1 from public.staff_users u where u.id=x and u.active)) then raise exception 'Inactive project lead.' using errcode='22023'; end if;
 insert into public.projects(code,name,description,host_department_id,created_by) values(btrim(p_code),btrim(p_name),nullif(btrim(p_description),''),p_host_department_id,p_actor_id) returning * into v;
 foreach v_lead in array p_lead_ids loop insert into public.project_members(project_id,user_id,role,added_by) values(v.id,v_lead,'lead',p_actor_id) on conflict(project_id,user_id) do update set role='lead',added_by=excluded.added_by; end loop;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','projects',v.id,'create',jsonb_build_object('code',v.code,'lead_ids',p_lead_ids)); return v;
end $function$;

revoke all on function public.api_create_project(uuid,text,text,text,uuid,uuid[]) from public,anon,authenticated;

grant execute on function public.api_create_project(uuid,text,text,text,uuid,uuid[]) to service_role;

alter function public.api_create_project(uuid,text,text,text,uuid,uuid[]) owner to postgres;

create or replace function public.api_assert_project_library(p_actor uuid,p_project uuid,p_write boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_write then perform 1 from public.projects where id=p_project for update; end if;
 if not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor and u.active and
   (exists(select 1 from public.project_members m where m.project_id=p_project and m.user_id=u.id) or (not p_write and r.code in ('admin','tong_bien_tap'))))
 then raise exception 'Library forbidden' using errcode='42501'; end if;
end $$;

revoke all on function public.api_assert_project_library(uuid,uuid,boolean) from public,anon,authenticated;

grant execute on function public.api_assert_project_library(uuid,uuid,boolean) to service_role;

alter function public.api_assert_project_library(uuid,uuid,boolean) owner to postgres;

CREATE OR REPLACE FUNCTION public.rbac_v2_scope_supported(p_permission_code text, p_scope text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_scope is null then false
    when p_permission_code in ('task.quick_report.create', 'attendance.view_self', 'leave.view_self', 'schedule.view_self') then p_scope in ('self', 'all')
    when p_permission_code in ('leave.approve', 'schedule.business.approve', 'schedule.event.approve') then p_scope in ('department', 'all')
    when p_permission_code in ('attendance.view_all') then p_scope in ('department', 'all')
    when p_permission_code = 'record.approve' then p_scope in ('department', 'all')
    when p_permission_code in ('task.create', 'task.edit_all', 'task.review', 'task.score', 'task.evaluate.step1', 'task.evaluate.step2', 'staff.manage', 'permission.manage', 'evaluation.rubric.manage', 'attendance.manage', 'asset.manage', 'journalism.metadata.update', 'journalism.publication.manage', 'journalism.publication.verify') then p_scope = 'all'
    when p_permission_code = 'task.assign' then p_scope in ('department', 'all')
    when p_permission_code = 'asset.view' then p_scope in ('assigned', 'department', 'all')
    else p_scope in ('self', 'assigned', 'department', 'all')
  end;
$function$
;

revoke all on function public.rbac_v2_scope_supported(text,text) from public,anon,authenticated;

grant execute on function public.rbac_v2_scope_supported(text,text) to service_role;

alter function public.rbac_v2_scope_supported(text,text) owner to postgres;

create or replace function public.api_set_user_permission_override(
  p_actor_id uuid,
  p_user_id uuid,
  p_permission_code text,
  p_effect text,
  p_scope text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_permission_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  if p_actor_id is null or p_user_id is null or p_permission_code is null or p_effect not in ('allow','deny') or not public.rbac_v2_scope_supported(p_permission_code, p_scope) then
    raise exception 'Invalid permission override.' using errcode = '22023';
  end if;
  if p_actor_id = p_user_id then raise exception 'Self override is not allowed.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rbac.permission.manage', 0));
  perform public.rbac_v2_assert_manager(p_actor_id);
  perform 1 from public.staff_users where id = p_user_id for update;
  if not found then raise exception 'User not found.' using errcode = 'P0002'; end if;
  perform 1 from public.staff_users where active = true for update;
  if p_effect = 'allow' and not exists (select 1 from public.staff_users where id = p_user_id and active = true) then raise exception 'Inactive user cannot receive permission.' using errcode = '22023'; end if;
  select id into v_permission_id from public.permissions where code = p_permission_code;
  if v_permission_id is null then raise exception 'Permission not found.' using errcode = 'P0002'; end if;
  select jsonb_build_object('effect', effect, 'scope', scope) into v_old from public.user_permission_grants where user_id = p_user_id and permission_id = v_permission_id;
  v_new := jsonb_build_object('effect', p_effect, 'scope', p_scope);
  if v_old = v_new then
    return jsonb_build_object('userId', p_user_id, 'permissionCode', p_permission_code, 'changed', false, 'effect', p_effect, 'scope', p_scope, 'effectivePermissions', public.rbac_v2_effective_summary(p_user_id));
  end if;
  insert into public.user_permission_grants(user_id, permission_id, scope, effect, created_by)
  values (p_user_id, v_permission_id, p_scope, p_effect, p_actor_id)
  on conflict (user_id, permission_id) do update set scope = excluded.scope, effect = excluded.effect, updated_at = now();
  perform public.rbac_v2_assert_manager_survives();
  if v_old is distinct from v_new then
    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
    values (p_actor_id, 'admin', 'user_permission_grant', p_user_id, 'set_permission_override', jsonb_build_object('permission_code', p_permission_code, 'old', v_old, 'new', v_new));
  end if;
  return jsonb_build_object('userId', p_user_id, 'permissionCode', p_permission_code, 'changed', true, 'effect', p_effect, 'scope', p_scope, 'effectivePermissions', public.rbac_v2_effective_summary(p_user_id));
end
$function$;

revoke all on function public.api_set_user_permission_override(uuid,uuid,text,text,text) from public,anon,authenticated;

grant execute on function public.api_set_user_permission_override(uuid,uuid,text,text,text) to service_role;

alter function public.api_set_user_permission_override(uuid,uuid,text,text,text) owner to postgres;

create or replace function public.api_list_user_approval_permissions(p_admin uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
begin
  perform public.rbac_v2_assert_manager(p_admin);
  return (select jsonb_agg(jsonb_build_object(
    'permissionCode',p.code,'label',p.name,'roleScopes',coalesce(e.role_scopes,'{}'),
    'structuralScopes',case when p.code='leave.approve' and j.code='truong_phong' and u.active then array['department']::text[] when p.code like 'schedule.%' and d.manager_id=u.id and d.active and u.active then array['department']::text[] else '{}'::text[] end,
    'userEffect',e.user_effect,'userScope',e.user_scope,'effectiveScopes',coalesce(s.scopes,'{}'),'source',coalesce(s.source,'none'),
    'effectiveDepartment',jsonb_build_object('id',u.department_id,'name',d.name),
    'restrictions',case when p.code='leave.approve' then jsonb_build_array('no_self_approval','leave_ge_3_days_tbt_only') else jsonb_build_array('no_self_approval') end,
    'grantedBy',case when g.created_by is null then null else jsonb_build_object('id',g.created_by,'name',gb.full_name) end,'grantedAt',g.created_at
  ) order by p.code)
  from public.permissions p join public.staff_users u on u.id=p_user left join public.departments d on d.id=u.department_id left join public.job_titles j on j.id=u.job_title_id
  left join public.api_list_effective_permissions(p_user) e on e.permission_code=p.code left join lateral public.approval_effective_scopes(p_user,p.code) s on true
  left join public.user_permission_grants g on g.user_id=p_user and g.permission_id=p.id left join public.staff_users gb on gb.id=g.created_by
  where p.code in ('leave.approve','schedule.business.approve','schedule.event.approve'));
end $function$;

revoke all on function public.api_list_user_approval_permissions(uuid,uuid) from public,anon,authenticated;

grant execute on function public.api_list_user_approval_permissions(uuid,uuid) to service_role;

alter function public.api_list_user_approval_permissions(uuid,uuid) owner to postgres;
create or replace function public.api_assign_project_task(p_actor_id uuid,p_project_id uuid,p_title text,p_description text,p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,p_due_time time,p_evaluation_criteria text default null,p_collaborator_ids uuid[] default '{}'::uuid[],p_watcher_ids uuid[] default '{}'::uuid[],p_priority text default 'normal',p_attachment_url text default null) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.tasks; x uuid; v_host uuid; v_status text;
begin
 select status,host_department_id into v_status,v_host from public.projects where id=p_project_id for update;
 if not found or v_status<>'active' then raise exception 'Project is closed or missing.' using errcode='42501'; end if;
 if not public.api_project_can_assign(p_actor_id,p_project_id) then raise exception 'Only project leads and deputies may assign.' using errcode='42501'; end if;
 p_reviewer_id := coalesce(p_reviewer_id,case when public.api_project_is_lead(p_actor_id,p_project_id) then p_actor_id else (select m.user_id from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project_id and m.role='lead' and u.active order by m.added_at,m.user_id limit 1) end);
 if nullif(btrim(p_title),'') is null or nullif(btrim(p_description),'') is null or length(p_title)>500 or length(p_description)>10000 or length(p_evaluation_criteria)>10000 or length(p_attachment_url)>2048 or p_due_date is null or p_due_time is null or p_priority is null or p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid assignment input.' using errcode='22023'; end if;
 if not exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project_id and m.user_id=p_assignee_id and u.active) then raise exception 'Assignee must be an active project member.' using errcode='22023'; end if;
 if not public.api_project_is_lead(p_reviewer_id,p_project_id) then raise exception 'Reviewer must be a project lead.' using errcode='22023'; end if;
 if exists(select 1 from unnest(coalesce(p_collaborator_ids,'{}') || coalesce(p_watcher_ids,'{}')) candidate(id) where not exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project_id and m.user_id=candidate.id and u.active)) then raise exception 'All project participants must be active members.' using errcode='22023'; end if;
 insert into public.tasks(title,description,project_id,department_id,assignee_id,owner_id,reviewer_id,created_by,assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,task_type,priority,attachment_url,evaluation_criteria,start_date) values(btrim(p_title),btrim(p_description),p_project_id,v_host,p_assignee_id,p_assignee_id,p_reviewer_id,p_actor_id,case when cardinality(coalesce(p_collaborator_ids,'{}'))>0 then 'multi_user' else 'individual' end,p_due_date,p_due_time,'new',0,'ad_hoc',false,'assigned',p_priority,p_attachment_url,nullif(btrim(p_evaluation_criteria),''),timezone('Asia/Ho_Chi_Minh',now())::date) returning * into v;
 insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v.id,p_assignee_id,'owner','todo');
 foreach x in array coalesce(p_collaborator_ids,'{}') loop if x<>p_assignee_id then insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v.id,x,'assignee','todo') on conflict do nothing; end if; end loop;
 foreach x in array coalesce(p_watcher_ids,'{}') loop if x<>p_assignee_id and not (x=any(coalesce(p_collaborator_ids,'{}'))) then insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v.id,x,'watcher','todo') on conflict do nothing; end if; end loop;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','tasks',v.id,'assign',jsonb_build_object('project_id',p_project_id)); return v;
end $function$;
revoke all on function public.api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text) from public,anon,authenticated;
grant execute on function public.api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text) to service_role;
alter function public.api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text) owner to postgres;

notify pgrst,'reload schema';
commit;
