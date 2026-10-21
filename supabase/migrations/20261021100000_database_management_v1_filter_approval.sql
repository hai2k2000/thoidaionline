begin;

-- Parent filters include their direct language children before count/pagination.
create or replace function public.api_search_database_records(
  p_actor_id uuid,
  p_q text default null,
  p_status text default null,
  p_record_type_id uuid default null,
  p_category_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns table(
  id uuid, category_id uuid, record_type_id uuid, record_code text, title text,
  summary text, status text, department_id uuid, owner_id uuid, created_by uuid,
  metadata jsonb, created_at timestamptz, updated_at timestamptz, total_count bigint
)
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_actor_id is null or not exists (select 1 from public.staff_users su where su.id = p_actor_id and su.active = true) then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;
  if length(coalesce(p_q, '')) > 200 or regexp_count(trim(coalesce(p_q, '')), '\\S+') > 20 then
    raise exception 'Search query is too complex.' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('draft', 'pending_review', 'approved', 'archived') then
    raise exception 'Invalid status.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.api_list_effective_permissions(p_actor_id) p
    where p.permission_code = 'record.discover' and cardinality(p.effective_scopes) > 0
  ) then return; end if;
  return query
  with actor as (select u.id, u.role_id, u.department_id from public.staff_users u where u.id = p_actor_id),
  permission_scope as (
    select coalesce('self' = any(p.effective_scopes), false) can_self,
      coalesce('assigned' = any(p.effective_scopes), false) can_assigned,
      coalesce('department' = any(p.effective_scopes), false) can_department,
      coalesce('all' = any(p.effective_scopes), false) can_all
    from public.api_list_effective_permissions(p_actor_id) p
    where p.permission_code = 'record.discover'
  ),
  candidates as (
    select r.*, t.code record_type_code,
      exists (select 1 from public.api_list_effective_permissions(p_actor_id) p where p.permission_code = 'record.sensitive.access' and cardinality(p.effective_scopes) > 0) sensitive_allowed,
      exists (select 1 from public.db_record_acl a, actor x where a.record_id = r.id and a.capability = 'discover' and a.effect = 'deny' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type = 'user' and a.principal_id = x.id) or (a.principal_type = 'role' and a.principal_id = x.role_id) or (a.principal_type = 'department' and a.principal_id = x.department_id))) explicitly_denied,
      exists (select 1 from public.db_record_acl a, actor x where a.record_id = r.id and a.capability = 'discover' and a.effect = 'allow' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type = 'user' and a.principal_id = x.id) or (a.principal_type = 'role' and a.principal_id = x.role_id) or (a.principal_type = 'department' and a.principal_id = x.department_id))) explicitly_allowed,
      exists (select 1 from actor x where r.owner_id = x.id) is_owner,
      exists (select 1 from actor x where r.department_id is not null and r.department_id = x.department_id) same_department,
      exists (select 1 from public.api_list_effective_permissions(p_actor_id) p where p.permission_code = 'record.metadata.view' and cardinality(p.effective_scopes) > 0) metadata_permission,
      exists (select 1 from public.db_record_acl a, actor x where a.record_id = r.id and a.capability = 'metadata.view' and a.effect = 'deny' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type = 'user' and a.principal_id = x.id) or (a.principal_type = 'role' and a.principal_id = x.role_id) or (a.principal_type = 'department' and a.principal_id = x.department_id))) metadata_denied,
      exists (select 1 from public.db_record_acl a, actor x where a.record_id = r.id and a.capability = 'metadata.view' and a.effect = 'allow' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type = 'user' and a.principal_id = x.id) or (a.principal_type = 'role' and a.principal_id = x.role_id) or (a.principal_type = 'department' and a.principal_id = x.department_id))) metadata_allowed_acl
    from public.db_records r join public.db_record_types t on t.id = r.record_type_id and t.active = true
    where r.status <> 'deleted' and (p_status is null or r.status = p_status)
      and (p_record_type_id is null or r.record_type_id = p_record_type_id)
      and (p_category_id is null or r.category_id = p_category_id or exists (select 1 from public.db_categories child where child.id = r.category_id and child.parent_id = p_category_id))
  ),
  visible as (
    select c.*, to_tsvector('simple', concat_ws(' ', c.record_code, c.title,
      case when c.metadata_permission and not c.metadata_denied and (c.metadata_allowed_acl or c.is_owner) then concat_ws(' ', c.summary, coalesce((select string_agg(e.value, ' ') from jsonb_each_text(c.metadata) e where exists (select 1 from public.db_form_fields f where f.form_definition_id = c.form_definition_id and f.field_key = e.key and f.searchable = true)), '')) else '' end)) searchable_text
    from candidates c cross join permission_scope ps
    where (c.record_type_code not in ('ho_so_dang','chi_hoi_nha_bao','doan_thanh_nien','giay_phep_quan_ly_bao_chi') or c.sensitive_allowed)
      and (c.explicitly_allowed or ps.can_all or (ps.can_department and c.same_department) or (ps.can_assigned and c.is_owner) or (ps.can_self and c.is_owner))
      and not c.explicitly_denied
  )
  select v.id, v.category_id, v.record_type_id, v.record_code, v.title,
    case when not v.metadata_permission or v.metadata_denied or not (v.metadata_allowed_acl or v.is_owner) then null else v.summary end,
    v.status, v.department_id, v.owner_id, v.created_by,
    case when not v.metadata_permission or v.metadata_denied or not (v.metadata_allowed_acl or v.is_owner) then '{}'::jsonb else v.metadata end,
    v.created_at, v.updated_at, count(*) over ()
  from visible v where coalesce(trim(p_q), '') = '' or v.searchable_text @@ websearch_to_tsquery('simple', trim(p_q))
  order by v.updated_at desc, v.id desc limit v_limit offset v_offset;
end
$function$;

revoke all on function public.api_search_database_records(uuid, text, text, uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.api_search_database_records(uuid, text, text, uuid, uuid, integer, integer) to service_role;
alter function public.api_search_database_records(uuid, text, text, uuid, uuid, integer, integer) owner to postgres;

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
  select * into r from public.db_records where id = p_record_id for update;
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
  else raise exception 'Invalid action.' using errcode = '22023'; end if;
  if not v_allowed then raise exception 'Permission denied.' using errcode = '42501'; end if;
  update public.db_records set status = v_next, updated_at = now() where id = r.id;
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
