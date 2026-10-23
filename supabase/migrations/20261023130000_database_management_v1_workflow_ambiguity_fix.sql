begin;

-- Re-declare the existing workflow RPC with qualified record references. The
-- output column named `id` otherwise collides with db_records.id in PL/pgSQL.
create or replace function public.api_transition_database_record(
  p_actor_id uuid, p_record_id uuid, p_action text, p_reason text default null
) returns table(id uuid, status text, action text, reason text, replayed boolean)
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  r public.db_records%rowtype;
  v_allowed boolean := false;
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
    if r.created_by = p_actor_id then raise exception 'Self approval is not allowed.' using errcode = '42501'; end if;
    v_allowed := exists (select 1 from public.api_list_effective_permissions(p_actor_id) p where p.permission_code = 'record.approve' and cardinality(p.effective_scopes) > 0)
      and exists (select 1 from public.db_record_acl a join public.staff_users u on u.id = p_actor_id where a.record_id = r.id and a.capability = 'approve' and a.effect = 'allow' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type='user' and a.principal_id=u.id) or (a.principal_type='role' and a.principal_id=u.role_id) or (a.principal_type='department' and a.principal_id=u.department_id)))
      and not exists (select 1 from public.db_record_acl a join public.staff_users u on u.id = p_actor_id where a.record_id = r.id and a.capability = 'approve' and a.effect = 'deny' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type='user' and a.principal_id=u.id) or (a.principal_type='role' and a.principal_id=u.role_id) or (a.principal_type='department' and a.principal_id=u.department_id)));
    v_next := case when p_action = 'approve' then 'approved' else 'draft' end;
    v_action := case when p_action = 'approve' then 'approve' else 'return_for_correction' end;
    if p_action = 'return' and (v_reason is null or length(v_reason) < 3) then raise exception 'Return reason is required.' using errcode = '22023'; end if;
  else
    raise exception 'Invalid action.' using errcode = '22023';
  end if;

  if not v_allowed then raise exception 'Permission denied.' using errcode = '42501'; end if;
  update public.db_records as updated_record set status = v_next, updated_at = now() where updated_record.id = r.id;
  insert into public.db_record_history(record_id, actor_id, action, old_data, new_data)
  values (r.id, p_actor_id, v_action, to_jsonb(r), jsonb_build_object('status', v_next, 'reason', v_reason));
  return query select r.id, v_next, v_action, v_reason, false;
end
$function$;

revoke all on function public.api_transition_database_record(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.api_transition_database_record(uuid, uuid, text, text) to service_role;
alter function public.api_transition_database_record(uuid, uuid, text, text) owner to postgres;

notify pgrst, 'reload schema';
commit;
