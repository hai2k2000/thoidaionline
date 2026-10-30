begin;

CREATE OR REPLACE FUNCTION public.api_transition_database_record(p_actor_id uuid, p_record_id uuid, p_action text, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, status text, action text, reason text, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r public.db_records%rowtype;
  v_allowed boolean := false;
  v_self_approval boolean := false;
  v_submitter_id uuid;
  v_next text;
  v_action text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_actor_id is null or not exists (select 1 from public.staff_users u where u.id = p_actor_id and u.active = true) then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;

  select records.* into r
  from public.db_records as records
  where records.id = p_record_id
  for update;
  if not found or r.status = 'deleted' then raise exception 'Record not found.' using errcode = 'P0002'; end if;
  if exists (
    select 1
    from public.db_record_types rt join public.db_categories rc on rc.id = rt.category_id
    where rt.id = r.record_type_id
      and (rc.code = 'doan_the_quan_ly' or rt.code in ('ho_so_dang', 'chi_hoi_nha_bao', 'doan_thanh_nien', 'giay_phep_quan_ly_bao_chi'))
      and not exists (
        select 1 from public.api_list_effective_permissions(p_actor_id) p
        where p.permission_code = 'record.sensitive.access' and cardinality(p.effective_scopes) > 0
      )
  ) then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;

  if p_action = 'submit' then
    if r.status = 'pending_review' then return query select r.id, r.status, 'submit_review', null::text, true; return; end if;
    if r.status <> 'draft' then raise exception 'Invalid transition.' using errcode = '22023'; end if;
    v_allowed := exists (select 1 from public.api_list_effective_permissions(p_actor_id) p where p.permission_code = 'record.edit' and cardinality(p.effective_scopes) > 0)
      and not exists (select 1 from public.db_record_acl a join public.staff_users u on u.id = p_actor_id where a.record_id = r.id and a.capability = 'edit' and a.effect = 'deny' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type='user' and a.principal_id=u.id) or (a.principal_type='role' and a.principal_id=u.role_id) or (a.principal_type='department' and a.principal_id=u.department_id)))
      and (exists (select 1 from public.db_record_acl a join public.staff_users u on u.id = p_actor_id where a.record_id = r.id and a.capability = 'edit' and a.effect = 'allow' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type='user' and a.principal_id=u.id) or (a.principal_type='role' and a.principal_id=u.role_id) or (a.principal_type='department' and a.principal_id=u.department_id)))
        or exists (select 1 from public.api_list_effective_permissions(p_actor_id) p, public.staff_users u where u.id = p_actor_id and p.permission_code = 'record.edit' and ('all' = any(p.effective_scopes) or ('self' = any(p.effective_scopes) and r.owner_id = u.id) or ('department' = any(p.effective_scopes) and r.department_id = u.department_id))));
    v_next := 'pending_review'; v_action := 'submit_review';
  elsif p_action in ('approve','return') then
    if p_action = 'approve' and r.status = 'approved' then return query select r.id, r.status, 'approve', null::text, true; return; end if;
    if r.status <> 'pending_review' then raise exception 'Invalid transition.' using errcode = '22023'; end if;
    v_self_approval := p_action = 'approve' and r.created_by = p_actor_id;
    if p_action = 'return' and r.created_by = p_actor_id then raise exception 'Self approval is not allowed.' using errcode = '42501'; end if;
    v_allowed := (exists (select 1 from public.staff_users u join public.departments d on d.id = r.department_id where u.id = p_actor_id and d.manager_id = p_actor_id)
      or exists (select 1 from public.api_list_effective_permissions(p_actor_id) p where p.permission_code = 'record.approve' and ('all' = any(p.effective_scopes) or ('department' = any(p.effective_scopes) and r.department_id is not null and r.department_id = (select u.department_id from public.staff_users u where u.id = p_actor_id)))) )
      and not exists (select 1 from public.db_record_acl a join public.staff_users u on u.id = p_actor_id where a.record_id = r.id and a.capability = 'approve' and a.effect = 'deny' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type='user' and a.principal_id=u.id) or (a.principal_type='role' and a.principal_id=u.role_id) or (a.principal_type='department' and a.principal_id=u.department_id)));
    if v_self_approval then
      v_allowed := v_allowed and exists (
        select 1 from public.api_list_effective_permissions(p_actor_id) p
        where p.permission_code = 'record.self_approve'
          and ('self' = any(p.effective_scopes) or 'all' = any(p.effective_scopes))
      );
      if not v_allowed then raise exception 'Self approval is not allowed.' using errcode = '42501'; end if;
    end if;
    if p_action = 'approve' then
      select h.actor_id into v_submitter_id
      from public.db_record_history h
      where h.record_id = r.id and h.action = 'submit_review'
      order by h.created_at desc limit 1;
    end if;
    v_next := case when p_action = 'approve' then 'approved' else 'draft' end;
    v_action := case when p_action = 'approve' then 'approve' else 'return_for_correction' end;
    if p_action = 'return' and (v_reason is null or length(v_reason) < 3) then raise exception 'Return reason is required.' using errcode = '22023'; end if;
  else
    raise exception 'Invalid action.' using errcode = '22023';
  end if;

  if not v_allowed then raise exception 'Permission denied.' using errcode = '42501'; end if;
  update public.db_records as updated_record set status = v_next, updated_at = now() where updated_record.id = r.id;
  insert into public.db_record_history(record_id, actor_id, action, old_data, new_data)
  values (
    r.id, p_actor_id, v_action, to_jsonb(r),
    jsonb_build_object(
      'status', v_next,
      'from_status', r.status,
      'to_status', v_next,
      'reason', v_reason,
      'created_by', r.created_by,
      'submitted_by', v_submitter_id,
      'approver_id', p_actor_id,
      'self_approval', v_self_approval
    )
  );
  return query select r.id, v_next, v_action, v_reason, false;
end
$function$
;


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

revoke all on function public.api_transition_database_record(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.api_transition_database_record(uuid, uuid, text, text) to service_role;
alter function public.api_transition_database_record(uuid, uuid, text, text) owner to postgres;

revoke all on function public.rbac_v2_scope_supported(text, text) from public, anon, authenticated;
grant execute on function public.rbac_v2_scope_supported(text, text) to service_role;
alter function public.rbac_v2_scope_supported(text, text) owner to postgres;

commit;
