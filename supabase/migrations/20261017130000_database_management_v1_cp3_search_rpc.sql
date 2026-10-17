begin;

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
  if p_actor_id is null or not exists (select 1 from public.staff_users where id = p_actor_id and active = true) then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;
  if length(coalesce(p_q, '')) > 200 or regexp_count(trim(coalesce(p_q, '')), '\S+') > 20 then
    raise exception 'Search query is too complex.' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('draft', 'pending_review', 'approved', 'archived') then
    raise exception 'Invalid status.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.api_list_effective_permissions(p_actor_id) where permission_code = 'record.discover' and cardinality(effective_scopes) > 0) then
    return;
  end if;
  return query
  with actor as (select u.id, u.role_id, u.department_id from public.staff_users u where u.id = p_actor_id),
  candidates as (
    select r.*, t.code as record_type_code,
      exists (select 1 from public.api_list_effective_permissions(p_actor_id) where permission_code = 'record.sensitive.access' and cardinality(effective_scopes) > 0) as sensitive_allowed,
      exists (select 1 from public.db_record_acl a, actor x where a.record_id = r.id and a.capability = 'discover' and a.effect = 'deny' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type = 'user' and a.principal_id = x.id) or (a.principal_type = 'role' and a.principal_id = x.role_id) or (a.principal_type = 'department' and a.principal_id = x.department_id))) as explicitly_denied,
      exists (select 1 from public.db_record_acl a, actor x where a.record_id = r.id and a.capability = 'discover' and a.effect = 'allow' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type = 'user' and a.principal_id = x.id) or (a.principal_type = 'role' and a.principal_id = x.role_id) or (a.principal_type = 'department' and a.principal_id = x.department_id))) as explicitly_allowed,
      exists (select 1 from actor x where r.owner_id = x.id) as is_owner,
      exists (select 1 from actor x where r.department_id is not null and r.department_id = x.department_id) as same_department,
      to_tsvector('simple', concat_ws(' ', r.record_code, r.title, r.summary, coalesce((select string_agg(e.value, ' ') from jsonb_each_text(r.metadata) e where exists (select 1 from public.db_form_fields f where f.form_definition_id = r.form_definition_id and f.field_key = e.key and f.searchable = true)), ''))) as searchable_text
    from public.db_records r join public.db_record_types t on t.id = r.record_type_id and t.active = true
    where r.status <> 'deleted' and (p_status is null or r.status = p_status) and (p_record_type_id is null or r.record_type_id = p_record_type_id) and (p_category_id is null or r.category_id = p_category_id)
  ),
  visible as (
    select c.*,
      exists (select 1 from public.db_record_acl a, actor x where a.record_id = c.id and a.capability = 'metadata.view' and a.effect = 'deny' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type = 'user' and a.principal_id = x.id) or (a.principal_type = 'role' and a.principal_id = x.role_id) or (a.principal_type = 'department' and a.principal_id = x.department_id))) as metadata_denied,
      exists (select 1 from public.db_record_acl a, actor x where a.record_id = c.id and a.capability = 'metadata.view' and a.effect = 'allow' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type = 'user' and a.principal_id = x.id) or (a.principal_type = 'role' and a.principal_id = x.role_id) or (a.principal_type = 'department' and a.principal_id = x.department_id))) as metadata_allowed_acl
    from candidates c
    where (c.record_type_code not in ('ho_so_dang','chi_hoi_nha_bao','doan_thanh_nien','giay_phep_quan_ly_bao_chi') or c.sensitive_allowed)
      and (c.explicitly_allowed or c.is_owner or c.same_department) and not c.explicitly_denied
      and (coalesce(trim(p_q), '') = '' or c.searchable_text @@ websearch_to_tsquery('simple', trim(p_q)))
  )
  select v.id, v.category_id, v.record_type_id, v.record_code, v.title,
    case when v.metadata_denied or not (v.metadata_allowed_acl or v.is_owner) then null else v.summary end,
    v.status, v.department_id, v.owner_id, v.created_by,
    case when v.metadata_denied or not (v.metadata_allowed_acl or v.is_owner) then '{}'::jsonb else v.metadata end,
    v.created_at, v.updated_at, count(*) over ()
  from visible v order by v.updated_at desc, v.id desc limit v_limit offset v_offset;
end
$function$;

revoke all on function public.api_search_database_records(uuid, text, text, uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.api_search_database_records(uuid, text, text, uuid, uuid, integer, integer) to service_role;
alter function public.api_search_database_records(uuid, text, text, uuid, uuid, integer, integer) owner to postgres;
notify pgrst, 'reload schema';
commit;
