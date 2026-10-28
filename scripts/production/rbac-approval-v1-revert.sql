-- If the attendance-RBAC migrations (PR #63; they redefine `rbac_v2_scope_supported` on top of this one) are applied, run their revert FIRST, then this file. This file restores the P1 production definition, which would otherwise drop attendance's scope branch.
begin;

-- FN api_review_leave_request
CREATE OR REPLACE FUNCTION public.api_review_leave_request(p_actor uuid, p_request_id uuid, p_decision text, p_note text)
 RETURNS leave_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_row public.leave_requests; v_old public.leave_requests; v_role text; v_job text; v_department uuid; v_days integer;
begin
  if p_decision not in ('approved','rejected') or length(coalesce(p_note,''))>1000 then raise exception 'invalid review' using errcode='22023'; end if;
  select r.code,j.code,u.department_id into v_role,v_job,v_department from public.staff_users u
  join public.roles r on r.id=u.role_id left join public.job_titles j on j.id=u.job_title_id where u.id=p_actor and u.active=true;
  select * into v_old from public.leave_requests where id=p_request_id and status='pending' for update;
  if not found then raise exception 'leave request unavailable' using errcode='40001'; end if;
  v_days := (v_old.end_date - v_old.start_date) + 1;
  if p_actor=v_old.requester_id
    or (v_days >= 3 and lower(coalesce(v_role,'')) <> 'tong_bien_tap')
    or (v_days < 3 and not (
      lower(coalesce(v_role,'')) in ('admin','tong_bien_tap','pho_tong_bien_tap')
      or (
        lower(coalesce(v_role,'')) in ('phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap')
        and v_department is not distinct from v_old.department_id
      )
      or (lower(coalesce(v_job,'')) in ('truong_phong','pho_truong_phong') and v_department is not distinct from v_old.department_id)
    )) then raise exception 'forbidden' using errcode='42501'; end if;
  update public.leave_requests set status=p_decision,reviewed_by=p_actor,reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now()
  where id=p_request_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','leave_requests',v_row.id,'review_leave_request',to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$
;

CREATE OR REPLACE FUNCTION public.api_review_personal_work_schedule(p_actor uuid, p_id uuid, p_action text, p_note text, p_expected_revision bigint)
 RETURNS work_schedules
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_row public.work_schedules;
  v_old public.work_schedules;
  v_role text;
  v_actor_department uuid;
  v_creator_department uuid;
  v_manager uuid;
  v_status text;
begin
  if p_action not in ('approve','reject') or p_expected_revision is null
     or (p_action='reject' and length(trim(coalesce(p_note,''))) not between 3 and 1000)
     or (p_action='approve' and length(coalesce(p_note,'')) > 1000) then
    raise exception 'invalid review' using errcode='22023';
  end if;

  select u.department_id, lower(r.code)
  into v_actor_department, v_role
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  where u.id=p_actor and u.active=true;
  if not found then
    raise exception 'forbidden' using errcode='42501';
  end if;

  select * into v_old from public.work_schedules where id=p_id for update;
  if not found then
    raise exception 'personal plan unavailable' using errcode='P0002';
  end if;
  if v_old.schedule_scope <> 'personal' or v_old.approval_status <> 'PENDING_APPROVAL'
     or v_old.workflow_revision <> p_expected_revision then
    raise exception 'personal plan is stale or not pending' using errcode='40001';
  end if;
  if v_old.created_by = p_actor then
    raise exception 'forbidden' using errcode='42501';
  end if;

  select department_id into v_creator_department
  from public.staff_users where id=v_old.created_by and active=true;
  select d.manager_id into v_manager
  from public.departments d
  join public.staff_users manager on manager.id=d.manager_id and manager.active=true
  where d.id=v_creator_department and d.active=true;

  if v_role not in ('admin','tong_bien_tap','pho_tong_bien_tap')
     and (v_manager is distinct from p_actor or v_actor_department is distinct from v_creator_department) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  v_status := case when p_action='approve' then 'APPROVED' else 'REJECTED' end;
  update public.work_schedules
  set approval_status=v_status,reviewed_by=p_actor,reviewed_at=now(),
      review_note=nullif(trim(coalesce(p_note,'')),''),
      workflow_revision=v_old.workflow_revision+1,updated_at=now()
  where id=p_id
  returning * into v_row;

  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','work_schedules',v_row.id,
    case when p_action='approve' then 'approve_personal_plan' else 'reject_personal_plan' end,
    to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;

CREATE OR REPLACE FUNCTION public.rbac_v2_scope_supported(p_permission_code text, p_scope text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_scope is null then false
    when p_permission_code in ('task.quick_report.create', 'attendance.view_self', 'leave.view_self', 'schedule.view_self') then p_scope in ('self', 'all')
    when p_permission_code in ('task.create', 'task.edit_all', 'task.review', 'task.score', 'task.evaluate.step1', 'task.evaluate.step2', 'staff.manage', 'permission.manage', 'evaluation.rubric.manage', 'attendance.view_all', 'asset.manage', 'journalism.metadata.update', 'journalism.publication.manage', 'journalism.publication.verify') then p_scope = 'all'
    when p_permission_code = 'task.assign' then p_scope in ('department', 'all')
    when p_permission_code = 'asset.view' then p_scope in ('assigned', 'department', 'all')
    else p_scope in ('self', 'assigned', 'department', 'all')
  end;
$function$;
-- Drop only functions introduced by the RBAC approval migration.
drop function if exists public.approval_effective_scopes(uuid,text);
drop function if exists public.approval_review_basis(uuid,text,uuid,uuid,integer);
drop function if exists public.approval_assert_can_review(uuid,text,uuid,uuid,integer);
drop function if exists public.api_list_reviewable_leave_requests(uuid,date,date);
drop function if exists public.api_list_reviewable_personal_plans(uuid);
drop function if exists public.api_get_approval_capabilities(uuid);
drop function if exists public.api_list_user_approval_permissions(uuid,uuid);
drop function if exists public.api_list_user_permission_history(uuid,uuid,integer,timestamptz);

-- Keep permission catalog/history and user overrides; remove only seeded role grants.
delete from public.role_permission_grants g using public.permissions p
where p.id=g.permission_id and p.code in ('leave.approve','schedule.business.approve','schedule.event.approve');

-- Roll back this one migration so safe-apply can re-apply it in the same database.
delete from supabase_migrations.schema_migrations where version = '20261028100000';

commit;
