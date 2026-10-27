begin;

insert into public.permissions(code,name,module,description) values
  ('leave.approve','Duyệt đơn xin nghỉ (dưới 3 ngày)','leave','Duyệt đơn xin nghỉ dưới 3 ngày.'),
  ('schedule.business.approve','Duyệt kế hoạch công tác cá nhân','schedule','Duyệt kế hoạch công tác cá nhân.'),
  ('schedule.event.approve','Duyệt kế hoạch tham gia sự kiện cá nhân','schedule','Duyệt kế hoạch tham gia sự kiện cá nhân.')
on conflict (code) do nothing;

create or replace function public.rbac_v2_scope_supported(p_permission_code text, p_scope text)
returns boolean language sql immutable
as $function$
  select case
    when p_scope is null then false
    when p_permission_code in ('task.quick_report.create', 'attendance.view_self', 'leave.view_self', 'schedule.view_self') then p_scope in ('self', 'all')
    when p_permission_code in ('leave.approve', 'schedule.business.approve', 'schedule.event.approve') then p_scope in ('department', 'all')
    when p_permission_code in ('task.create', 'task.edit_all', 'task.review', 'task.score', 'task.evaluate.step1', 'task.evaluate.step2', 'staff.manage', 'permission.manage', 'evaluation.rubric.manage', 'attendance.view_all', 'asset.manage', 'journalism.metadata.update', 'journalism.publication.manage', 'journalism.publication.verify') then p_scope = 'all'
    when p_permission_code = 'task.assign' then p_scope in ('department', 'all')
    when p_permission_code = 'asset.view' then p_scope in ('assigned', 'department', 'all')
    else p_scope in ('self', 'assigned', 'department', 'all')
  end;
$function$;

insert into public.role_permission_grants(role_id,permission_id,scope)
select r.id,p.id,'all' from public.roles r cross join public.permissions p
where r.code in ('admin','tong_bien_tap','pho_tong_bien_tap')
  and p.code in ('leave.approve','schedule.business.approve','schedule.event.approve')
on conflict (role_id,permission_id,scope) do nothing;
insert into public.role_permission_grants(role_id,permission_id,scope)
select r.id,p.id,'department' from public.roles r cross join public.permissions p
where r.code in ('phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap')
  and p.code='leave.approve'
on conflict (role_id,permission_id,scope) do nothing;

create or replace function public.approval_effective_scopes(p_actor uuid,p_permission text)
returns table(scopes text[],source text) language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v record; v_structural text[] := '{}'; v_combined text[];
begin
  if p_permission not in ('leave.approve','schedule.business.approve','schedule.event.approve') then raise exception 'invalid approval permission' using errcode='22023'; end if;
  select * into v from public.api_list_effective_permissions(p_actor) where permission_code=p_permission;
  if not found or v.actor_active is distinct from true then return query select '{}'::text[],'none'; return; end if;
  if v.user_effect='deny' then return query select '{}'::text[],'user_deny'; return; end if;
  if v.user_effect='allow' then return query select array[v.user_scope]::text[],'user_allow'; return; end if;
  if p_permission='leave.approve' and exists(select 1 from public.staff_users u join public.job_titles j on j.id=u.job_title_id where u.id=p_actor and u.active and j.code='truong_phong') then v_structural := array['department']; end if;
  if p_permission in ('schedule.business.approve','schedule.event.approve') and exists(select 1 from public.staff_users u join public.departments d on d.id=u.department_id and d.active and d.manager_id=u.id where u.id=p_actor and u.active) then v_structural := array['department']; end if;
  select coalesce(array_agg(x order by x),'{}'::text[]) into v_combined from (select unnest(coalesce(v.effective_scopes,'{}'::text[])) x union select unnest(v_structural) x) q;
  if cardinality(coalesce(v.effective_scopes,'{}')) > 0 then return query select v_combined,'role';
  elsif cardinality(v_structural)>0 then return query select v_structural,'structural';
  else return query select '{}'::text[],'none'; end if;
end $function$;

create or replace function public.approval_review_basis(p_actor uuid,p_permission text,p_subject_user uuid,p_subject_department uuid,p_leave_days integer default null)
returns text language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_scope record; v_actor public.staff_users; v_subject_level integer; v_actor_level integer;
begin
  select * into v_actor from public.staff_users where id=p_actor and active=true; if not found or p_actor=p_subject_user then return null; end if;
  if p_permission='leave.approve' and p_leave_days >= 3 then
    if exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor and lower(r.code)='tong_bien_tap') then return 'tbt_rule'; end if; return null;
  end if;
  select * into v_scope from public.approval_effective_scopes(p_actor,p_permission);
  if v_scope.source='none' or v_scope.source='user_deny' then return null; end if;
  if 'all'=any(v_scope.scopes) then
    if v_scope.source='user_allow' then select coalesce(r.level,0) into v_actor_level from public.staff_users u left join public.roles r on r.id=u.role_id where u.id=p_actor; select coalesce(r.level,0) into v_subject_level from public.staff_users u left join public.roles r on r.id=u.role_id where u.id=p_subject_user; if v_subject_level>v_actor_level then return null; end if; end if;
    return v_scope.source;
  end if;
  if 'department'=any(v_scope.scopes) and v_actor.department_id is not null and v_actor.department_id=p_subject_department then
    if v_scope.source='user_allow' then select coalesce(r.level,0) into v_actor_level from public.staff_users u left join public.roles r on r.id=u.role_id where u.id=p_actor; select coalesce(r.level,0) into v_subject_level from public.staff_users u left join public.roles r on r.id=u.role_id where u.id=p_subject_user; if v_subject_level>v_actor_level then return null; end if; end if;
    return v_scope.source;
  end if; return null;
end $function$;

create or replace function public.approval_assert_can_review(p_actor uuid,p_permission text,p_subject_user uuid,p_subject_department uuid,p_leave_days integer default null)
returns text language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_basis text;
begin v_basis := public.approval_review_basis(p_actor,p_permission,p_subject_user,p_subject_department,p_leave_days); if v_basis is null then raise exception 'forbidden' using errcode='42501'; end if; return v_basis; end $function$;

create or replace function public.api_review_leave_request(p_actor uuid,p_request_id uuid,p_decision text,p_note text)
returns public.leave_requests language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_row public.leave_requests; v_old public.leave_requests; v_basis text; v_days integer;
begin
  if p_decision not in ('approved','rejected') or length(coalesce(p_note,''))>1000 then raise exception 'invalid review' using errcode='22023'; end if;
  select * into v_old from public.leave_requests where id=p_request_id and status='pending' for update; if not found then raise exception 'leave request unavailable' using errcode='40001'; end if;
  v_days := (v_old.end_date-v_old.start_date)+1; v_basis := public.approval_assert_can_review(p_actor,'leave.approve',v_old.requester_id,v_old.department_id,v_days);
  update public.leave_requests set status=p_decision,reviewed_by=p_actor,reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=p_request_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor,'admin','leave_requests',v_row.id,'review_leave_request',to_jsonb(v_old),to_jsonb(v_row)||jsonb_build_object('approval_basis',v_basis)); return v_row;
end $function$;

create or replace function public.api_review_personal_work_schedule(p_actor uuid,p_id uuid,p_action text,p_note text,p_expected_revision bigint)
returns public.work_schedules language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_row public.work_schedules; v_old public.work_schedules; v_basis text; v_subject_department uuid; v_role text;
begin
  if p_action not in ('approve','reject') or p_expected_revision is null or (p_action='reject' and length(trim(coalesce(p_note,''))) not between 3 and 1000) or (p_action='approve' and length(coalesce(p_note,''))>1000) then raise exception 'invalid review' using errcode='22023'; end if;
  select * into v_old from public.work_schedules where id=p_id for update; if not found then raise exception 'personal plan unavailable' using errcode='P0002'; end if;
  if v_old.schedule_scope <> 'personal' or v_old.approval_status <> 'PENDING_APPROVAL' or v_old.workflow_revision <> p_expected_revision then raise exception 'personal plan is stale or not pending' using errcode='40001'; end if;
  if v_old.created_by=p_actor then raise exception 'forbidden' using errcode='42501'; end if;
  select department_id into v_subject_department from public.staff_users where id=v_old.created_by and active=true;
  if v_old.plan_type='business' then v_basis := public.approval_assert_can_review(p_actor,'schedule.business.approve',v_old.created_by,v_subject_department); elsif v_old.plan_type='event' then v_basis := public.approval_assert_can_review(p_actor,'schedule.event.approve',v_old.created_by,v_subject_department); else
    select lower(r.code) into v_role from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor and u.active=true;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    if coalesce(v_role,'') not in ('admin','tong_bien_tap','pho_tong_bien_tap') and not exists(select 1 from public.staff_users u join public.departments d on d.id=u.department_id and d.active and d.manager_id=u.id where u.id=p_actor and u.active=true and u.department_id is not distinct from v_subject_department) then raise exception 'forbidden' using errcode='42501'; end if;
    v_basis := 'legacy_work';
  end if;
  update public.work_schedules set approval_status=case when p_action='approve' then 'APPROVED' else 'REJECTED' end,reviewed_by=p_actor,reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),''),workflow_revision=v_old.workflow_revision+1,updated_at=now() where id=p_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor,'admin','work_schedules',v_row.id,case when p_action='approve' then 'approve_personal_plan' else 'reject_personal_plan' end,to_jsonb(v_old),to_jsonb(v_row)||jsonb_build_object('approval_basis',v_basis)); return v_row;
end $function$;

create or replace function public.api_list_reviewable_leave_requests(p_actor uuid,p_from date,p_to date)
returns table(id uuid,approval_basis text) language sql security definer set search_path = public, pg_temp
as $function$ select l.id,public.approval_review_basis(p_actor,'leave.approve',l.requester_id,l.department_id,(l.end_date-l.start_date)+1) from public.leave_requests l where l.status='pending' and l.start_date <= p_to and l.end_date >= p_from and public.approval_review_basis(p_actor,'leave.approve',l.requester_id,l.department_id,(l.end_date-l.start_date)+1) is not null order by l.created_at asc limit 200 $function$;

create or replace function public.api_list_reviewable_personal_plans(p_actor uuid)
returns table(id uuid,approval_basis text) language sql security definer set search_path = public, pg_temp
as $function$
  select w.id,
    case when w.plan_type='business' then public.approval_review_basis(p_actor,'schedule.business.approve',w.created_by,c.department_id)
         when w.plan_type='event' then public.approval_review_basis(p_actor,'schedule.event.approve',w.created_by,c.department_id)
         else 'legacy_work' end
  from public.work_schedules w
  left join public.staff_users c on c.id=w.created_by and c.active=true
  where w.schedule_scope='personal' and w.approval_status='PENDING_APPROVAL' and w.created_by<>p_actor
    and ((w.plan_type in ('business','event') and public.approval_review_basis(p_actor,case when w.plan_type='business' then 'schedule.business.approve' else 'schedule.event.approve' end,w.created_by,c.department_id) is not null)
      or (w.plan_type='work' and exists(select 1 from public.staff_users a join public.roles r on r.id=a.role_id where a.id=p_actor and a.active=true and (lower(r.code) in ('admin','tong_bien_tap','pho_tong_bien_tap') or exists(select 1 from public.departments d where d.id=c.department_id and d.active=true and d.manager_id=p_actor and a.department_id is not distinct from c.department_id)))))
  order by w.submitted_at asc
$function$;

create or replace function public.api_get_approval_capabilities(p_actor uuid) returns jsonb language sql security definer set search_path = public, pg_temp as $function$ select jsonb_build_object('leave.approve',(select to_jsonb(x) from public.approval_effective_scopes(p_actor,'leave.approve') x),'schedule.business.approve',(select to_jsonb(x) from public.approval_effective_scopes(p_actor,'schedule.business.approve') x),'schedule.event.approve',(select to_jsonb(x) from public.approval_effective_scopes(p_actor,'schedule.event.approve') x),'leaveLongTbt',exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor and u.active and lower(r.code)='tong_bien_tap'),'personalWorkLegacy',exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor and u.active and (lower(r.code) in ('admin','tong_bien_tap','pho_tong_bien_tap') or exists(select 1 from public.departments d where d.id=u.department_id and d.active=true and d.manager_id=u.id)))) $function$;

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

create or replace function public.api_list_user_permission_history(p_admin uuid,p_user uuid,p_limit integer default 50,p_before timestamptz default null) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$ begin perform public.rbac_v2_assert_manager(p_admin); return coalesce((select jsonb_agg(jsonb_build_object('actor',jsonb_build_object('id',x.actor_id,'name',x.actor_name),'action',x.action,'createdAt',x.created_at,'newData',x.new_data,'oldData',x.old_data) order by x.created_at desc) from (select l.actor_id,a.full_name actor_name,l.action,l.created_at,l.new_data,l.old_data from public.audit_logs l left join public.staff_users a on a.id=l.actor_id where l.entity_id=p_user and (l.entity_type='user_permission_grant' or l.action in ('grant_permission','revoke_permission')) and (p_before is null or l.created_at<p_before) order by l.created_at desc limit least(greatest(coalesce(p_limit,50),1),200)) x),'[]'::jsonb); end $function$;

do $$ declare f text; begin foreach f in array['approval_effective_scopes(uuid,text)','approval_review_basis(uuid,text,uuid,uuid,integer)','approval_assert_can_review(uuid,text,uuid,uuid,integer)','api_review_leave_request(uuid,uuid,text,text)','api_review_personal_work_schedule(uuid,uuid,text,text,bigint)','api_list_reviewable_leave_requests(uuid,date,date)','api_list_reviewable_personal_plans(uuid)','api_get_approval_capabilities(uuid)','api_list_user_approval_permissions(uuid,uuid)','api_list_user_permission_history(uuid,uuid,integer,timestamptz)'] loop execute format('revoke all on function public.%s from public, anon, authenticated',f); execute format('grant execute on function public.%s to service_role',f); execute format('alter function public.%s owner to postgres',f); end loop; end $$;

notify pgrst, 'reload schema';
commit;
