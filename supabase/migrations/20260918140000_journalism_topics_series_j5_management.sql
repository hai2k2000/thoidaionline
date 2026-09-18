begin;

insert into public.permissions (code, name, module, description) values
  ('journalism.structure.manage', 'Quản lý cấu trúc báo chí', 'journalism', 'Tạo, sửa và lưu trữ Topic/Series trong phạm vi được phép.'),
  ('journalism.structure.assign', 'Gán cấu trúc báo chí', 'journalism', 'Gán Topic/Series cho nội dung trong phạm vi được phép.')
on conflict (code) do update set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description,
  updated_at = now();

with approved(role_code, permission_code, scope) as (values
  ('admin', 'journalism.structure.manage', 'all'),
  ('tong_bien_tap', 'journalism.structure.manage', 'all'),
  ('pho_tong_bien_tap', 'journalism.structure.manage', 'all'),
  ('truong_phong', 'journalism.structure.manage', 'department'),
  ('pho_truong_phong', 'journalism.structure.manage', 'department'),
  ('admin', 'journalism.structure.assign', 'all'),
  ('tong_bien_tap', 'journalism.structure.assign', 'all'),
  ('pho_tong_bien_tap', 'journalism.structure.assign', 'all'),
  ('truong_phong', 'journalism.structure.assign', 'department'),
  ('pho_truong_phong', 'journalism.structure.assign', 'department'),
  ('phong_vien', 'journalism.structure.assign', 'assigned'),
  ('nhan_vien', 'journalism.structure.assign', 'assigned')
)
insert into public.role_permission_grants(role_id, permission_id, scope)
select r.id, p.id, a.scope
from approved a
join public.roles r on r.code = a.role_code and r.active = true
join public.permissions p on p.code = a.permission_code
on conflict (role_id, permission_id, scope) do nothing;

create or replace function public.api_assert_journalism_structure_scope(
  p_actor_id uuid,
  p_permission text,
  p_department_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor_department_id uuid;
  v_role_id uuid;
begin
  select u.department_id, u.role_id
    into v_actor_department_id, v_role_id
  from public.staff_users u
  join public.roles r on r.id = u.role_id and r.active = true
  where u.id = p_actor_id and u.active = true;
  if v_role_id is null then
    raise exception 'Invalid actor.' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.role_permission_grants g
    join public.permissions p on p.id = g.permission_id
    where g.role_id = v_role_id
      and p.code = p_permission
      and (
        g.scope = 'all'
        or (g.scope = 'department' and p_department_id is not null and p_department_id = v_actor_department_id)
      )
  ) then
    raise exception 'Journalism structure permission required.' using errcode = '42501';
  end if;
end
$function$;

create or replace function public.api_create_editorial_topic_v1(
  p_actor_id uuid,
  p_name text,
  p_description text,
  p_department_id uuid
) returns public.editorial_topics
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row public.editorial_topics;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(p_description), '');
begin
  perform public.api_assert_journalism_structure_scope(p_actor_id, 'journalism.structure.manage', p_department_id);
  if char_length(v_name) < 1 or char_length(v_name) > 200 then
    raise exception 'Invalid topic name.' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 5000 then
    raise exception 'Invalid topic description.' using errcode = '22023';
  end if;
  insert into public.editorial_topics(name, description, department_id, created_by)
  values (v_name, v_description, p_department_id, p_actor_id)
  returning * into v_row;
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
  values (p_actor_id, 'journalism', 'editorial_topics', v_row.id, 'create_editorial_topic',
    jsonb_build_object('department_id', v_row.department_id, 'name_length', char_length(v_row.name), 'has_description', v_row.description is not null));
  return v_row;
end
$function$;

create or replace function public.api_update_editorial_topic_v1(
  p_actor_id uuid,
  p_topic_id uuid,
  p_name text,
  p_description text,
  p_update_name boolean,
  p_update_description boolean
) returns public.editorial_topics
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row public.editorial_topics;
  v_old_name text;
  v_old_description text;
  v_name text;
  v_description text;
begin
  select * into v_row from public.editorial_topics where id = p_topic_id for update;
  if not found then raise exception 'Topic not found.' using errcode = 'P0002'; end if;
  perform public.api_assert_journalism_structure_scope(p_actor_id, 'journalism.structure.manage', v_row.department_id);
  if not v_row.is_active then raise exception 'Archived topic cannot be updated.' using errcode = '23505'; end if;
  if not p_update_name and not p_update_description then return v_row; end if;
  v_name := case when p_update_name then btrim(coalesce(p_name, '')) else v_row.name end;
  v_description := case when p_update_description then nullif(btrim(p_description), '') else v_row.description end;
  if char_length(v_name) < 1 or char_length(v_name) > 200 then raise exception 'Invalid topic name.' using errcode = '22023'; end if;
  if v_description is not null and char_length(v_description) > 5000 then raise exception 'Invalid topic description.' using errcode = '22023'; end if;
  v_old_name := v_row.name;
  v_old_description := v_row.description;
  update public.editorial_topics
  set name = v_name, description = v_description
  where id = p_topic_id
  returning * into v_row;
  if v_old_name is distinct from v_row.name or v_old_description is distinct from v_row.description then
    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, old_data, new_data)
    values (p_actor_id, 'journalism', 'editorial_topics', v_row.id, 'update_editorial_topic',
      jsonb_build_object('name_length', char_length(v_old_name), 'has_description', v_old_description is not null),
      jsonb_build_object('name_length', char_length(v_row.name), 'has_description', v_row.description is not null));
  end if;
  return v_row;
end
$function$;

create or replace function public.api_archive_editorial_topic_v1(
  p_actor_id uuid,
  p_topic_id uuid
) returns public.editorial_topics
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row public.editorial_topics;
begin
  select * into v_row from public.editorial_topics where id = p_topic_id for update;
  if not found then raise exception 'Topic not found.' using errcode = 'P0002'; end if;
  perform public.api_assert_journalism_structure_scope(p_actor_id, 'journalism.structure.manage', v_row.department_id);
  if not v_row.is_active then raise exception 'Topic is already archived.' using errcode = '23505'; end if;
  update public.editorial_topics set is_active = false where id = p_topic_id returning * into v_row;
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
  values (p_actor_id, 'journalism', 'editorial_topics', v_row.id, 'archive_editorial_topic',
    jsonb_build_object('department_id', v_row.department_id, 'previous_is_active', true));
  return v_row;
end
$function$;

create or replace function public.api_create_editorial_series_v1(
  p_actor_id uuid,
  p_name text,
  p_description text,
  p_department_id uuid,
  p_topic_id uuid
) returns public.editorial_series
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row public.editorial_series;
  v_topic public.editorial_topics;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(p_description), '');
begin
  perform public.api_assert_journalism_structure_scope(p_actor_id, 'journalism.structure.manage', p_department_id);
  if char_length(v_name) < 1 or char_length(v_name) > 200 then raise exception 'Invalid series name.' using errcode = '22023'; end if;
  if v_description is not null and char_length(v_description) > 5000 then raise exception 'Invalid series description.' using errcode = '22023'; end if;
  if p_topic_id is not null then
    select * into v_topic from public.editorial_topics where id = p_topic_id for share;
    if not found then raise exception 'Topic not found.' using errcode = 'P0002'; end if;
    if not v_topic.is_active then raise exception 'Archived topic cannot be assigned to a new series.' using errcode = '22023'; end if;
    if v_topic.department_id is not null and v_topic.department_id is distinct from p_department_id then
      raise exception 'Series topic department mismatch.' using errcode = '22023';
    end if;
  end if;
  insert into public.editorial_series(name, description, department_id, topic_id, created_by)
  values (v_name, v_description, p_department_id, p_topic_id, p_actor_id)
  returning * into v_row;
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
  values (p_actor_id, 'journalism', 'editorial_series', v_row.id, 'create_editorial_series',
    jsonb_build_object('department_id', v_row.department_id, 'topic_id', v_row.topic_id, 'name_length', char_length(v_row.name), 'has_description', v_row.description is not null));
  return v_row;
end
$function$;

create or replace function public.api_update_editorial_series_v1(
  p_actor_id uuid,
  p_series_id uuid,
  p_name text,
  p_description text,
  p_topic_id uuid,
  p_update_name boolean,
  p_update_description boolean,
  p_update_topic boolean
) returns public.editorial_series
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row public.editorial_series;
  v_topic public.editorial_topics;
  v_name text;
  v_description text;
  v_old jsonb;
  v_new jsonb;
begin
  select * into v_row from public.editorial_series where id = p_series_id for update;
  if not found then raise exception 'Series not found.' using errcode = 'P0002'; end if;
  perform public.api_assert_journalism_structure_scope(p_actor_id, 'journalism.structure.manage', v_row.department_id);
  if not v_row.is_active then raise exception 'Archived series cannot be updated.' using errcode = '23505'; end if;
  if p_update_topic and p_topic_id is not null then
    select * into v_topic from public.editorial_topics where id = p_topic_id for share;
    if not found then raise exception 'Topic not found.' using errcode = 'P0002'; end if;
    if not v_topic.is_active then raise exception 'Archived topic cannot be assigned.' using errcode = '22023'; end if;
    if v_topic.department_id is not null and v_topic.department_id is distinct from v_row.department_id then
      raise exception 'Series topic department mismatch.' using errcode = '22023';
    end if;
  end if;
  v_name := case when p_update_name then btrim(coalesce(p_name, '')) else v_row.name end;
  v_description := case when p_update_description then nullif(btrim(p_description), '') else v_row.description end;
  if char_length(v_name) < 1 or char_length(v_name) > 200 then raise exception 'Invalid series name.' using errcode = '22023'; end if;
  if v_description is not null and char_length(v_description) > 5000 then raise exception 'Invalid series description.' using errcode = '22023'; end if;
  v_old := jsonb_build_object('name_length', char_length(v_row.name), 'has_description', v_row.description is not null, 'topic_id', v_row.topic_id);
  update public.editorial_series
  set name = v_name,
      description = v_description,
      topic_id = case when p_update_topic then p_topic_id else topic_id end
  where id = p_series_id
  returning * into v_row;
  v_new := jsonb_build_object('name_length', char_length(v_row.name), 'has_description', v_row.description is not null, 'topic_id', v_row.topic_id);
  if v_old <> v_new then
    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, old_data, new_data)
    values (p_actor_id, 'journalism', 'editorial_series', v_row.id, 'update_editorial_series', v_old, v_new);
  end if;
  return v_row;
end
$function$;

create or replace function public.api_archive_editorial_series_v1(
  p_actor_id uuid,
  p_series_id uuid
) returns public.editorial_series
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row public.editorial_series;
begin
  select * into v_row from public.editorial_series where id = p_series_id for update;
  if not found then raise exception 'Series not found.' using errcode = 'P0002'; end if;
  perform public.api_assert_journalism_structure_scope(p_actor_id, 'journalism.structure.manage', v_row.department_id);
  if not v_row.is_active then raise exception 'Series is already archived.' using errcode = '23505'; end if;
  update public.editorial_series set is_active = false where id = p_series_id returning * into v_row;
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
  values (p_actor_id, 'journalism', 'editorial_series', v_row.id, 'archive_editorial_series',
    jsonb_build_object('department_id', v_row.department_id, 'previous_is_active', true));
  return v_row;
end
$function$;

do $block$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'api_assert_journalism_structure_scope(uuid,text,uuid)',
    'api_create_editorial_topic_v1(uuid,text,text,uuid)',
    'api_update_editorial_topic_v1(uuid,uuid,text,text,boolean,boolean)',
    'api_archive_editorial_topic_v1(uuid,uuid)',
    'api_create_editorial_series_v1(uuid,text,text,uuid,uuid)',
    'api_update_editorial_series_v1(uuid,uuid,text,text,uuid,boolean,boolean,boolean)',
    'api_archive_editorial_series_v1(uuid,uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', v_signature);
    execute format('grant execute on function public.%s to service_role', v_signature);
    execute format('alter function public.%s owner to postgres', v_signature);
  end loop;
end
$block$;

commit;
