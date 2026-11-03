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


-- Project reviewers follow project membership, independent of department titles.
create or replace function public.validate_task_report_recipient()
returns trigger
language plpgsql
set search_path=public
as $function$
declare
  v_job_title text;
  v_role text;
  v_active boolean;
  v_department uuid;
begin
  if new.reviewer_id is not null then
    select lower(jt.code),lower(r.code),u.active,u.department_id
    into v_job_title,v_role,v_active,v_department
    from public.staff_users u
    join public.roles r on r.id=u.role_id
    left join public.job_titles jt on jt.id=u.job_title_id and jt.active=true
    where u.id=new.reviewer_id;

    if not coalesce(v_active,false) then
      raise exception 'Người duyệt không hợp lệ.' using errcode='22023';
    end if;
    if new.reviewer_id=(select manager_id from public.departments where id=new.department_id and active=true) then
      null;
    elsif v_job_title in ('truong_phong','pho_truong_phong') then
      if v_department is distinct from new.department_id then
        raise exception 'Người duyệt phải thuộc phòng ban của công việc.' using errcode='42501';
      end if;
    elsif v_role not in ('phu_trach_phong_tri_su','phu_trach_phong_phong_vien',
      'phu_trach_phong_bien_tap','pho_tong_bien_tap','tong_bien_tap') then
      raise exception 'Người duyệt phải là Trưởng hoặc Phó phòng.' using errcode='42501';
    end if;
  end if;
  if new.self_claimable and new.assignment_mode<>'individual' then
    raise exception 'Kế hoạch tự nhận chỉ hỗ trợ kiểu giao cá nhân.' using errcode='22023';
  end if;
  return new;
end
$function$;
revoke all on function public.validate_task_report_recipient() from public,anon,authenticated;
grant execute on function public.validate_task_report_recipient() to service_role;
alter function public.validate_task_report_recipient() owner to postgres;

create or replace function public.api_approve_task_claim(
  p_actor_id uuid,p_task_id uuid,p_decision text,p_reason text default null
) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v public.tasks; v_allowed boolean := false; v_role text; v_department uuid; v_status text;
begin
  select * into v from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Không tìm thấy công việc.' using errcode='P0002'; end if;
  select r.code,u.department_id into v_role,v_department
  from public.staff_users u join public.roles r on r.id=u.role_id
  where u.id=p_actor_id and u.active=true;
  if v.approval_required then
    select coalesce(
      v_role in ('admin','tong_bien_tap','pho_tong_bien_tap')
      or (v_department=v.department_id and exists(select 1 from public.departments d where d.id=v.department_id and d.manager_id=p_actor_id)),
      false
    ) into v_allowed;
    if p_actor_id=v.created_by then v_allowed:=false; end if;
    if not v_allowed then raise exception 'Không có quyền duyệt giao việc.' using errcode='42501'; end if;
    if v.status<>'waiting' or p_decision not in ('approve','reject')
       or (p_decision='reject' and nullif(btrim(p_reason),'') is null) then
      raise exception 'Quyết định hoặc trạng thái không hợp lệ.' using errcode='22023';
    end if;
    v_status:=case when p_decision='approve' then 'in_progress' else 'rejected' end;
    update public.tasks set status=v_status,updated_at=now() where id=p_task_id returning * into v;
    insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
    values(p_task_id,'waiting',v_status,nullif(btrim(p_reason),''),p_actor_id);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
    values(p_actor_id,'task','tasks',p_task_id,case when p_decision='approve' then 'approve_assignment' else 'reject_assignment' end,
      jsonb_build_object('status','waiting','approval_required',true),jsonb_build_object('status',v_status,'reason',nullif(btrim(p_reason),'')));
    return v;
  end if;
  if v.task_type<>'assigned' or coalesce(v.self_claimable,false) is not true then
    raise exception 'Chỉ công việc tự nhận mới cần duyệt nhận việc.' using errcode='22023';
  end if;
  select (p_actor_id=v.reviewer_id or exists(
    select 1 from public.staff_users u join public.roles r on r.id=u.role_id
    where u.id=p_actor_id and u.active=true and r.code='admin'
  )) into v_allowed;
  if not coalesce(v_allowed,false) then raise exception 'Không có quyền duyệt nhận việc.' using errcode='42501'; end if;
  if v.status<>'waiting' then raise exception 'Công việc không ở trạng thái chờ duyệt nhận việc.' using errcode='22023'; end if;
  if p_decision not in ('approve','reject') or (p_decision='reject' and nullif(btrim(p_reason),'') is null) then raise exception 'Quyết định hoặc lý do không hợp lệ.' using errcode='22023'; end if;
  v_status:=case when p_decision='approve' then 'in_progress' else 'rejected' end;
  update public.tasks set status=v_status,updated_at=now() where id=p_task_id returning * into v;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,'waiting',v_status,nullif(btrim(p_reason),''),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,case when p_decision='approve' then 'approve_claim' else 'reject_claim' end,jsonb_build_object('status','waiting'),jsonb_build_object('status',v_status,'reason',nullif(btrim(p_reason),'')));
  return v;
end
$function$;
revoke all on function public.api_approve_task_claim(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.api_approve_task_claim(uuid,uuid,text,text) to service_role;
alter function public.api_approve_task_claim(uuid,uuid,text,text) owner to postgres;

create or replace function public.api_review_assigned_task_completion(
  p_actor_id uuid,p_task_id uuid,p_decision text,p_reason text default null
) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks; v_status text; v_now timestamptz:=now(); v_action text;
  v_role text; v_actor_department uuid; v_allowed boolean := false;
begin
  select * into v_before from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if v_before.approval_required then
    select r.code,u.department_id into v_role,v_actor_department
    from public.staff_users u join public.roles r on r.id=u.role_id
    where u.id=p_actor_id and u.active=true;
    select coalesce(
      v_role in ('admin','tong_bien_tap','pho_tong_bien_tap')
      or (v_actor_department=v_before.department_id and exists(
        select 1 from public.departments d where d.id=v_before.department_id and d.manager_id=p_actor_id
      )),false
    ) into v_allowed;
    if p_actor_id=v_before.created_by or p_actor_id=v_before.owner_id then v_allowed:=false; end if;
    if not v_allowed then raise exception 'Task action forbidden.' using errcode='42501'; end if;
    if v_before.status<>'pending_review' or p_decision not in ('approve','return')
       or (p_decision='return' and nullif(btrim(p_reason),'') is null)
       or length(coalesce(p_reason,''))>2000 then raise exception 'Invalid completion review.' using errcode='22023'; end if;
    v_status:=case when p_decision='approve' then 'done' else 'in_progress' end;
    update public.tasks set status=v_status,progress_percent=case when p_decision='approve' then 100 else progress_percent end,
      completed_at=case when p_decision='approve' then v_now else null end,
      completion_submitted_at=case when p_decision='approve' then completion_submitted_at else null end,updated_at=v_now
      where id=p_task_id returning * into v_after;
    v_action:=case when p_decision='approve' then 'approve_completion' else 'request_rework' end;
    insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,'pending_review',v_status,nullif(btrim(p_reason),''),p_actor_id);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
    values(p_actor_id,'task','tasks',p_task_id,v_action,jsonb_build_object('status','pending_review'),jsonb_build_object('status',v_status,'reason',nullif(btrim(p_reason),'')));
    return v_after;
  end if;
  perform public.api_assert_task_action(p_actor_id,p_task_id,'review');
  if v_before.task_type<>'assigned' or v_before.status<>'pending_review' or p_decision not in ('approve','return')
     or (p_decision='return' and nullif(btrim(p_reason),'') is null) then raise exception 'Invalid assigned review.' using errcode='22023'; end if;
  v_status:=case when p_decision='approve' then 'done' else 'rejected' end;
  update public.tasks set status=v_status,progress_percent=case when p_decision='approve' then 100 else progress_percent end,
    completed_at=case when p_decision='approve' then v_now else null end,updated_at=v_now where id=p_task_id returning * into v_after;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,'pending_review',v_status,nullif(btrim(p_reason),''),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,case when p_decision='approve' then 'approve' else 'return' end,jsonb_build_object('status','pending_review'),jsonb_build_object('status',v_status,'reason',nullif(btrim(p_reason),'')));
  return v_after;
end
$function$;
revoke all on function public.api_review_assigned_task_completion(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.api_review_assigned_task_completion(uuid,uuid,text,text) to service_role;
alter function public.api_review_assigned_task_completion(uuid,uuid,text,text) owner to postgres;

drop trigger if exists guard_project_task_score_row on public.task_completion_scores;
drop trigger if exists guard_project_task_evaluation_row on public.task_evaluation_checkpoints;
drop function if exists public.guard_project_task_score_row();
drop trigger if exists guard_project_task_evaluation_row on public.task_qualitative_evaluations;
drop function if exists public.guard_project_task_evaluation_row();
create or replace function public.require_task_score_before_done()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
begin
  if new.status='done'
     and old.status is distinct from 'done'
     and new.task_type='assigned'
     and coalesce(new.task_category,'regular')<>'duty'
     and (
       new.completion_submitted_at is null
       or not exists (
         select 1 from public.task_completion_scores s
         where s.task_id=new.id
           and s.updated_at>=new.completion_submitted_at
       )
     ) then
    raise exception 'Công việc phải được chấm điểm cho lần gửi hiện tại trước khi hoàn thành.' using errcode='22023';
  end if;
  if new.status='rejected' and old.status is distinct from 'rejected' then
    delete from public.task_completion_scores where task_id=new.id;
  end if;
  return new;
end
$function$;
create or replace function public.api_score_task_completion(
  p_actor_id uuid,
  p_task_id uuid,
  p_requirement_results jsonb,
  p_requirement_score numeric,
  p_collaboration_score numeric,
  p_initiative_score numeric,
  p_note text default null
) returns public.task_completion_scores
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_row public.task_completion_scores;
  v_requirements jsonb := '[]'::jsonb;
  v_count integer;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'review');
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if v_task.status <> 'pending_review' then raise exception 'Task is not awaiting review.' using errcode='22023'; end if;
  if v_task.reviewer_id <> p_actor_id and not exists (
    select 1 from public.staff_users u join public.roles r on r.id=u.role_id
    where u.id=p_actor_id and r.code='admin'
  ) then raise exception 'Only the assigned reviewer can score this task.' using errcode='42501'; end if;
  if jsonb_typeof(coalesce(p_requirement_results,'[]'::jsonb)) <> 'array'
     or p_requirement_score is null or p_requirement_score < 0 or p_requirement_score > 60
     or p_collaboration_score not in (5,10,15,20)
     or p_initiative_score not in (5,10,15,20) then
    raise exception 'Invalid completion score.' using errcode='22023';
  end if;
  begin
    v_requirements := case when v_task.evaluation_criteria is null then '[]'::jsonb else v_task.evaluation_criteria::jsonb end;
  exception when others then
    v_requirements := '[]'::jsonb;
  end;
  if jsonb_typeof(v_requirements) <> 'array' then v_requirements := '[]'::jsonb; end if;
  v_count := jsonb_array_length(v_requirements);
  if jsonb_array_length(p_requirement_results) <> v_count then
    raise exception 'Requirement score count does not match task requirements.' using errcode='22023';
  end if;
  insert into public.task_completion_scores(
    task_id,reviewer_id,requirement_results,requirement_score,collaboration_score,initiative_score,note,updated_at
  ) values (
    p_task_id,p_actor_id,p_requirement_results,p_requirement_score,
    p_collaboration_score,p_initiative_score,nullif(btrim(coalesce(p_note,'')),''),now()
  )
  on conflict (task_id) do update set
    reviewer_id=excluded.reviewer_id,
    requirement_results=excluded.requirement_results,
    requirement_score=excluded.requirement_score,
    collaboration_score=excluded.collaboration_score,
    initiative_score=excluded.initiative_score,
    note=excluded.note,
    updated_at=now()
  returning * into v_row;
  perform public.api_review_assigned_task_completion(p_actor_id,p_task_id,'approve',null);
  insert into public.task_comments(task_id,user_id,content)
  values (p_task_id,p_actor_id,'Đã chấm điểm công việc. Tổng điểm: ' || v_row.total_score || '/100.');
  return v_row;
end
$function$;
create or replace function public.api_get_personnel_evaluation_detail(
  p_actor uuid,
  p_employee uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $function$
declare
  v_employee_name text;
  v_department_name text;
  v_review public.performance_reviews;
  v_cycle public.performance_cycles;
  v_factors jsonb:='[]'::jsonb;
  v_scores jsonb:='[]'::jsonb;
  v_tasks jsonb:='[]'::jsonb;
  v_allowed_action text;
  v_role text;
  v_step1 boolean;
  v_step2 boolean;
  v_is_direct_manager boolean;
  v_is_leader boolean;
begin
  if p_from is null or p_to is null or p_from>p_to or p_employee is null then
    raise exception 'invalid evaluation detail request' using errcode='22023';
  end if;
  if not public.phase9_can_view_personnel_evaluation(p_actor,p_employee) then
    raise exception 'personnel evaluation forbidden' using errcode='42501';
  end if;

  select u.full_name,coalesce(d.name,'—')
  into v_employee_name,v_department_name
  from public.staff_users u
  left join public.departments d on d.id=u.department_id
  where u.id=p_employee and u.active=true;
  if not found then
    raise exception 'personnel evaluation forbidden' using errcode='42501';
  end if;

  select r.code,coalesce(rp.can_evaluate_step1,false),
    coalesce(rp.can_evaluate_step2,false)
  into v_role,v_step1,v_step2
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  left join public.role_permissions rp on rp.role_id=r.id
  where u.id=p_actor and u.active=true;
  v_is_direct_manager:=coalesce(v_step1,false) and exists(
    select 1
    from public.staff_users employee
    join public.departments d on d.id=employee.department_id
    where employee.id=p_employee and employee.active=true
      and d.active=true and d.manager_id=p_actor
  );
  v_is_leader:=v_role='tong_bien_tap' and coalesce(v_step2,false);

  select pr.*
  into v_review
  from public.performance_reviews pr
  join public.performance_cycles pc on pc.id=pr.cycle_id
  where pr.employee_id=p_employee
    and pc.start_date<=p_to
    and pc.end_date>=p_from
  order by pc.end_date desc,pc.start_date desc,
    pr.revision_no desc,pr.created_at desc,pr.id
  limit 1;

  if v_review.id is not null then
    select pc.* into v_cycle
    from public.performance_cycles pc
    where pc.id=v_review.cycle_id;
    v_factors:=coalesce(v_review.rubric_snapshot->'factors','[]'::jsonb);
    select coalesce(jsonb_agg(jsonb_build_object(
      'stage',s.stage,'factor_code',s.factor_code,'score',s.score,
      'comment',s.comment
    ) order by case s.stage when 'self' then 1 when 'manager' then 2 else 3 end,
      s.factor_code),'[]'::jsonb)
    into v_scores
    from public.performance_review_scores s
    where s.review_id=v_review.id;
    v_allowed_action:=case
      when v_is_direct_manager and v_review.status='awaiting_manager'
        then 'manager'
      when v_is_leader and v_review.status='awaiting_tbt'
        then 'tbt'
      else null
    end;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'position',f.position,'factor_code',f.factor_code,'label',f.label,
      'description',f.description,'max_score',f.max_score,
      'band_definitions',f.band_definitions
    ) order by f.position),'[]'::jsonb)
    into v_factors
    from public.evaluation_rubric_versions rv
    join public.evaluation_rubric_factors f on f.rubric_version_id=rv.id
    where rv.status='published';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',task.id,
    'title',task.title,
    'description',task.description,
    'status',task.status,
    'difficulty',task.priority,
    'department_id',task.department_id,
    'department_name',(select d.name from public.departments d where d.id=task.department_id),
    'assignee_id',coalesce(task.assignee_id,task.owner_id,(
      select ta.user_id from public.task_assignees ta
      where ta.task_id=task.id and ta.assignment_role<>'watcher'
      order by case ta.assignment_role when 'assignee' then 1 else 2 end,ta.user_id limit 1
    )),
    'assignee_name',(select assignee.full_name from public.staff_users assignee
      where assignee.id=coalesce(task.assignee_id,task.owner_id,(
        select ta.user_id from public.task_assignees ta
        where ta.task_id=task.id and ta.assignment_role<>'watcher'
        order by case ta.assignment_role when 'assignee' then 1 else 2 end,ta.user_id limit 1
      ))),
    'reviewer_id',task.reviewer_id,
    'reviewer_name',(select reviewer.full_name from public.staff_users reviewer where reviewer.id=task.reviewer_id),
    'completion_status',case when task.status='done'
      then 'completed' else 'unfinished' end,
    'deadline_outcome',case
      when task.due_date is null then 'no_deadline'
      when task.status='done' and
        coalesce(task.completion_submitted_at,task.completed_at,task.updated_at)::date
          <=task.due_date then 'on_time'
      when task.status='done' then 'overdue'
      when task.due_date<current_date then 'overdue'
      else 'in_time'
    end,
    'due_date',task.due_date,
    'evaluation_criteria',task.evaluation_criteria,
    'task_type',task.task_type,'assignment_mode',task.assignment_mode,'plan_period',task.plan_period,
    'progress_percent',coalesce(task.progress_percent,0),'start_date',task.start_date,
    'created_at',task.created_at,'completion_submitted_at',task.completion_submitted_at,
    'completed_at',task.completed_at,'cancelled_at',task.cancelled_at,'cancel_reason',task.cancel_reason,
    'owner_id',task.owner_id,'owner_name',(select u.full_name from public.staff_users u where u.id=task.owner_id),
    'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'created_at',a.created_at,'uploaded_by',a.uploaded_by) order by a.created_at desc) from public.task_attachments a where a.task_id=task.id),'[]'::jsonb),
    'progress_reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'reported_by',r.reported_by,'reported_on',r.reported_on,'report_status',r.report_status,'progress_text',r.progress_text,'blockers',r.blockers,'created_at',r.created_at) order by r.reported_on desc,r.created_at desc) from public.task_progress_reports r where r.task_id=task.id),'[]'::jsonb),
    'progress_logs',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'old_progress',l.old_progress,'new_progress',l.new_progress,'note',l.note,'created_at',l.created_at,'user_id',l.user_id) order by l.created_at desc) from public.task_progress_logs l where l.task_id=task.id),'[]'::jsonb),
    'comments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'content',c.content,'created_at',c.created_at,'user_id',c.user_id,'author_name',(select u.full_name from public.staff_users u where u.id=c.user_id)) order by c.created_at desc) from public.task_comments c where c.task_id=task.id),'[]'::jsonb),
    'qualitative_evaluations',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'evaluation_text',q.evaluation_text,'evaluation_deadline',q.evaluation_deadline,'evaluation_source',q.evaluation_source,'created_at',q.created_at,'evaluator_name',(select u.full_name from public.staff_users u where u.id=q.evaluator_id)) order by q.created_at desc) from public.task_qualitative_evaluations q where q.task_id=task.id),'[]'::jsonb),
    'legacy_evaluations',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'employee_id',e.employee_id,'opinion',e.opinion,'checkpoint_date',e.checkpoint_date,'created_at',e.created_at) order by e.checkpoint_date desc,e.created_at desc) from public.task_evaluation_checkpoints e where e.task_id=task.id),'[]'::jsonb),
    'deadline_history',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'old_due_date',h.old_due_date,'new_due_date',h.new_due_date,'reason',h.reason,'changed_at',h.changed_at) order by h.changed_at desc) from public.task_deadline_history h where h.task_id=task.id),'[]'::jsonb),
    'status_events',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'from_status',s.from_status,'to_status',s.to_status,'reason',s.reason,'created_at',s.created_at) order by s.created_at desc) from public.task_status_events s where s.task_id=task.id),'[]'::jsonb)
  ) order by task.due_date nulls last,lower(task.title),task.id),'[]'::jsonb)
  into v_tasks
  from public.tasks task
  where (
      task.owner_id=p_employee
      or task.assignee_id=p_employee
      or exists(
        select 1 from public.task_assignees ta
        where ta.task_id=task.id and ta.user_id=p_employee
          and ta.assignment_role<>'watcher'
      )
    )
    and coalesce(task.start_date,task.created_at::date)<=p_to
    and coalesce(
      task.due_date,
      task.completion_submitted_at::date,
      task.completed_at::date,
      p_to
    )>=p_from;

  return jsonb_build_object(
    'employee_id',p_employee,
    'employee_name',v_employee_name,
    'department_name',v_department_name,
    'review_id',v_review.id,
    'review_status',v_review.status,
    'workflow_type',v_review.workflow_type,
    'cycle_name',v_cycle.name,
    'cycle_start',v_cycle.start_date,
    'cycle_end',v_cycle.end_date,
    'allowed_action',v_allowed_action,
    'factors',v_factors,
    'scores',v_scores,
    'tasks',v_tasks
  );
end
$function$;

notify pgrst,'reload schema';
commit;
