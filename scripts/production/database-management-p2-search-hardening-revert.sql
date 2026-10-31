begin;

create or replace function public.api_search_database_records(
  p_actor_id uuid, p_q text default null, p_status text default null, p_record_type_id uuid default null,
  p_category_id uuid default null, p_limit integer default 50, p_offset integer default 0,
  p_created_from date default null, p_created_to date default null, p_updated_from date default null,
  p_updated_to date default null, p_department_id uuid default null, p_owner_id uuid default null,
  p_created_by uuid default null, p_has_files boolean default null, p_keyword text default null,
  p_sort text default 'updated_at', p_sort_dir text default 'desc', p_visibility text default null
) returns table(id uuid, category_id uuid, record_type_id uuid, record_code text, title text, summary text,
  status text, department_id uuid, owner_id uuid, created_by uuid, metadata jsonb, created_at timestamptz,
  updated_at timestamptz, total_count bigint, visibility text)
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_sort text := case when p_sort in ('updated_at','created_at','record_code','title','status') then p_sort else 'updated_at' end;
  v_sort_dir text := case when lower(p_sort_dir) in ('asc','desc') then lower(p_sort_dir) else 'desc' end;
  v_from timestamptz := case when p_created_from is null then null else timezone('Asia/Ho_Chi_Minh', p_created_from::timestamp) end;
  v_to timestamptz := case when p_created_to is null then null else timezone('Asia/Ho_Chi_Minh', (p_created_to + 1)::timestamp) end;
  v_updated_from timestamptz := case when p_updated_from is null then null else timezone('Asia/Ho_Chi_Minh', p_updated_from::timestamp) end;
  v_updated_to timestamptz := case when p_updated_to is null then null else timezone('Asia/Ho_Chi_Minh', (p_updated_to + 1)::timestamp) end;
begin
  if p_actor_id is null or not exists (select 1 from public.staff_users su where su.id = p_actor_id and su.active = true) then raise exception 'Invalid actor.' using errcode = '42501'; end if;
  if length(coalesce(p_q, '')) > 200 or regexp_count(trim(coalesce(p_q, '')), '\\S+') > 20 then raise exception 'Search query is too complex.' using errcode = '22023'; end if;
  if p_status is not null and p_status not in ('draft', 'pending_review', 'approved', 'archived') then raise exception 'Invalid status.' using errcode = '22023'; end if;
  if p_visibility is not null and p_visibility not in ('department', 'public') then raise exception 'Invalid visibility.' using errcode = '22023'; end if;
  return query
  with actor as (select u.id, u.role_id, u.department_id from public.staff_users u where u.id = p_actor_id),
  permission_scope as (select coalesce('all' = any(p.effective_scopes), false) can_all from public.api_list_effective_permissions(p_actor_id) p where p.permission_code = 'record.discover'),
  candidates as (
    select r.*, t.code record_type_code,
      exists (select 1 from public.api_list_effective_permissions(p_actor_id) p where p.permission_code = 'record.sensitive.access' and cardinality(p.effective_scopes) > 0) sensitive_allowed,
      exists (select 1 from public.db_record_acl a, actor x where a.record_id = r.id and a.capability = 'discover' and a.effect = 'deny' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type = 'user' and a.principal_id = x.id) or (a.principal_type = 'role' and a.principal_id = x.role_id) or (a.principal_type = 'department' and a.principal_id = x.department_id))) explicitly_denied,
      exists (select 1 from public.db_record_acl a, actor x where a.record_id = r.id and a.capability = 'discover' and a.effect = 'allow' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type = 'user' and a.principal_id = x.id) or (a.principal_type = 'role' and a.principal_id = x.role_id) or (a.principal_type = 'department' and a.principal_id = x.department_id))) explicitly_allowed,
      exists (select 1 from actor x where r.owner_id = x.id) is_owner,
      exists (select 1 from actor x where r.department_id is not null and r.department_id = x.department_id) same_department,
      exists (select 1 from public.db_department_view_grants g, actor x where g.user_id = x.id and g.department_id = r.department_id) department_granted,
      exists (select 1 from public.api_list_effective_permissions(p_actor_id) p where p.permission_code = 'record.metadata.view' and cardinality(p.effective_scopes) > 0) metadata_permission,
      exists (select 1 from public.db_record_acl a, actor x where a.record_id = r.id and a.capability = 'metadata.view' and a.effect = 'deny' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type = 'user' and a.principal_id = x.id) or (a.principal_type = 'role' and a.principal_id = x.role_id) or (a.principal_type = 'department' and a.principal_id = x.department_id))) metadata_denied,
      exists (select 1 from public.db_record_acl a, actor x where a.record_id = r.id and a.capability = 'metadata.view' and a.effect = 'allow' and (a.expires_at is null or a.expires_at > now()) and ((a.principal_type = 'user' and a.principal_id = x.id) or (a.principal_type = 'role' and a.principal_id = x.role_id) or (a.principal_type = 'department' and a.principal_id = x.department_id))) metadata_allowed_acl
    from public.db_records r join public.db_record_types t on t.id = r.record_type_id and t.active = true
    where r.status <> 'deleted' and (p_status is null or r.status = p_status) and (p_record_type_id is null or r.record_type_id = p_record_type_id) and (p_category_id is null or r.category_id = p_category_id or exists (select 1 from public.db_categories child where child.id = r.category_id and child.parent_id = p_category_id))
      and (p_created_from is null or r.created_at >= v_from) and (p_created_to is null or r.created_at < v_to)
      and (p_updated_from is null or r.updated_at >= v_updated_from) and (p_updated_to is null or r.updated_at < v_updated_to)
      and (p_department_id is null or r.department_id = p_department_id) and (p_owner_id is null or r.owner_id = p_owner_id) and (p_created_by is null or r.created_by = p_created_by)
      and (p_has_files is null or exists (select 1 from public.db_record_files f where f.record_id = r.id) = p_has_files)
      and (p_keyword is null or exists (select 1 from public.db_record_keywords k where k.record_id = r.id and lower(k.keyword) = lower(trim(p_keyword))))
      and (p_visibility is null or r.visibility = p_visibility)
  ),
  visible as (
    select c.*, to_tsvector('simple', concat_ws(' ', c.record_code, c.title, case when not c.metadata_denied then concat_ws(' ', c.summary, coalesce((select string_agg(e.value, ' ') from jsonb_each_text(c.metadata) e where exists (select 1 from public.db_form_fields f where f.form_definition_id = c.form_definition_id and f.field_key = e.key and f.searchable = true)), '')) else '' end)) searchable_text
    from candidates c cross join permission_scope ps
    where (not (exists (select 1 from public.db_record_types st join public.db_categories sc on sc.id = st.category_id where st.code = c.record_type_code and sc.code = 'doan_the_quan_ly') or c.record_type_code in ('ho_so_dang','chi_hoi_nha_bao','doan_thanh_nien','giay_phep_quan_ly_bao_chi')) or c.sensitive_allowed)
      and (ps.can_all or c.same_department or (c.status in ('approved','archived') and (c.visibility = 'public' or c.department_granted)) or c.explicitly_allowed)
      and not c.explicitly_denied
  )
  select v.id, v.category_id, v.record_type_id, v.record_code, v.title,
    case when v.metadata_denied then null else v.summary end,
    v.status, v.department_id, v.owner_id, v.created_by,
    case when v.metadata_denied then '{}'::jsonb else v.metadata end,
    v.created_at, v.updated_at, count(*) over (), v.visibility
  from visible v where coalesce(trim(p_q), '') = '' or v.searchable_text @@ websearch_to_tsquery('simple', trim(p_q))
  order by case when v_sort = 'updated_at' and v_sort_dir = 'desc' then v.updated_at end desc, case when v_sort = 'updated_at' and v_sort_dir = 'asc' then v.updated_at end asc,
    case when v_sort = 'created_at' and v_sort_dir = 'desc' then v.created_at end desc, case when v_sort = 'created_at' and v_sort_dir = 'asc' then v.created_at end asc,
    case when v_sort = 'record_code' and v_sort_dir = 'desc' then v.record_code end desc, case when v_sort = 'record_code' and v_sort_dir = 'asc' then v.record_code end asc,
    case when v_sort = 'title' and v_sort_dir = 'desc' then v.title end desc, case when v_sort = 'title' and v_sort_dir = 'asc' then v.title end asc,
    case when v_sort = 'status' and v_sort_dir = 'desc' then v.status end desc, case when v_sort = 'status' and v_sort_dir = 'asc' then v.status end asc, v.id desc limit v_limit offset v_offset;
end
$function$;

revoke all on function public.api_search_database_records(uuid, text, text, uuid, uuid, integer, integer, date, date, date, date, uuid, uuid, uuid, boolean, text, text, text, text) from public, anon, authenticated;
grant execute on function public.api_search_database_records(uuid, text, text, uuid, uuid, integer, integer, date, date, date, date, uuid, uuid, uuid, boolean, text, text, text, text) to service_role;
alter function public.api_search_database_records(uuid, text, text, uuid, uuid, integer, integer, date, date, date, date, uuid, uuid, uuid, boolean, text, text, text, text) owner to postgres;

delete from supabase_migrations.schema_migrations where version = '20261031100000';

commit;
