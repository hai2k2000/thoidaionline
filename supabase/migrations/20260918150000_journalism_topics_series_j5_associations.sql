begin;

create or replace function public.api_j5d_assert_assign(
  p_actor_id uuid,
  p_task_id uuid,
  p_structure_department_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_task_department_id uuid;
begin
  perform public.api_assert_journalism_access(p_actor_id, p_task_id, 'journalism.structure.assign');
  select department_id into v_task_department_id from public.tasks where id = p_task_id;
  if p_structure_department_id is not null and p_structure_department_id is distinct from v_task_department_id then
    raise exception 'Structure department mismatch.' using errcode = '42501';
  end if;
end
$function$;

create or replace function public.api_j5d_assert_manage_series(
  p_actor_id uuid,
  p_series_id uuid
) returns public.editorial_series
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_series public.editorial_series;
begin
  select * into v_series from public.editorial_series where id = p_series_id for update;
  if not found then raise exception 'Series not found.' using errcode = 'P0002'; end if;
  perform public.api_assert_journalism_structure_scope(p_actor_id, 'journalism.structure.manage', v_series.department_id);
  if not v_series.is_active then raise exception 'Archived series cannot be changed.' using errcode = '23505'; end if;
  return v_series;
end
$function$;

create or replace function public.api_attach_editorial_topic_task_v1(
  p_actor_id uuid,
  p_task_id uuid,
  p_topic_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_topic public.editorial_topics;
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or not exists (select 1 from public.journalism_task_details d where d.task_id = p_task_id) then
    raise exception 'Task not found.' using errcode = 'P0002';
  end if;
  select * into v_topic from public.editorial_topics where id = p_topic_id for share;
  if not found then raise exception 'Topic not found.' using errcode = 'P0002'; end if;
  if not v_topic.is_active then raise exception 'Archived topic cannot be assigned.' using errcode = '23505'; end if;
  perform public.api_j5d_assert_assign(p_actor_id, p_task_id, v_topic.department_id);
  insert into public.editorial_topic_tasks(topic_id, task_id, created_by)
  values (p_topic_id, p_task_id, p_actor_id);
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
  values (p_actor_id, 'journalism', 'journalism_task_details', p_task_id, 'attach_topic_to_journalism_task',
    jsonb_build_object('topicId', p_topic_id, 'topicDepartmentId', v_topic.department_id, 'taskDepartmentId', v_task.department_id));
exception when unique_violation then
  raise exception 'Topic is already attached.' using errcode = '23505';
end
$function$;

create or replace function public.api_detach_editorial_topic_task_v1(
  p_actor_id uuid,
  p_task_id uuid,
  p_topic_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_topic_department uuid;
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or not exists (select 1 from public.journalism_task_details d where d.task_id = p_task_id) then
    raise exception 'Task not found.' using errcode = 'P0002';
  end if;
  select department_id into v_topic_department from public.editorial_topics where id = p_topic_id for share;
  if not found then raise exception 'Topic not found.' using errcode = 'P0002'; end if;
  perform public.api_j5d_assert_assign(p_actor_id, p_task_id, v_topic_department);
  delete from public.editorial_topic_tasks where topic_id = p_topic_id and task_id = p_task_id;
  if found then
    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
    values (p_actor_id, 'journalism', 'journalism_task_details', p_task_id, 'detach_topic_from_journalism_task',
      jsonb_build_object('topicId', p_topic_id, 'topicDepartmentId', v_topic_department, 'taskDepartmentId', v_task.department_id));
  end if;
end
$function$;

create or replace function public.api_attach_editorial_series_task_v1(
  p_actor_id uuid,
  p_task_id uuid,
  p_series_id uuid
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_series public.editorial_series;
  v_task public.tasks;
  v_existing public.editorial_series_items;
  v_position integer;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or not exists (select 1 from public.journalism_task_details d where d.task_id = p_task_id) then
    raise exception 'Task not found.' using errcode = 'P0002';
  end if;
  select * into v_series from public.editorial_series where id = p_series_id for update;
  if not found then raise exception 'Series not found.' using errcode = 'P0002'; end if;
  perform public.api_j5d_assert_assign(p_actor_id, p_task_id, v_series.department_id);
  select * into v_existing from public.editorial_series_items where task_id = p_task_id for update;
  if found and v_existing.series_id = p_series_id then
    return v_existing.position;
  end if;
  if found then raise exception 'Task already belongs to a series.' using errcode = '23505'; end if;
  if not v_series.is_active then raise exception 'Archived series cannot be assigned.' using errcode = '23505'; end if;
  select coalesce(max(position), 0) + 1 into v_position from public.editorial_series_items where series_id = p_series_id;
  insert into public.editorial_series_items(series_id, task_id, position, created_by)
  values (p_series_id, p_task_id, v_position, p_actor_id);
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
  values (p_actor_id, 'journalism', 'journalism_task_details', p_task_id, 'attach_series_to_journalism_task',
    jsonb_build_object('seriesId', p_series_id, 'position', v_position, 'seriesDepartmentId', v_series.department_id, 'taskDepartmentId', v_task.department_id));
  return v_position;
end
$function$;

create or replace function public.api_detach_editorial_series_task_v1(
  p_actor_id uuid,
  p_task_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_item public.editorial_series_items;
  v_task public.tasks;
  v_series_id uuid;
  v_offset integer;
  v_remaining integer;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or not exists (select 1 from public.journalism_task_details d where d.task_id = p_task_id) then
    raise exception 'Task not found.' using errcode = 'P0002';
  end if;
  perform public.api_j5d_assert_assign(p_actor_id, p_task_id, null);
  select series_id into v_series_id from public.editorial_series_items where task_id = p_task_id;
  if not found then return; end if;
  perform 1 from public.editorial_series where id = v_series_id for update;
  select * into v_item from public.editorial_series_items where task_id = p_task_id for update;
  if not found then return; end if;
  perform public.api_j5d_assert_assign(p_actor_id, p_task_id, (select department_id from public.editorial_series where id = v_item.series_id));
  delete from public.editorial_series_items where task_id = p_task_id;
  select coalesce(max(position), 0) + count(*) + 1 into v_offset
  from public.editorial_series_items where series_id = v_item.series_id;
  update public.editorial_series_items set position = position + v_offset where series_id = v_item.series_id;
  with renumbered as (
    select task_id, row_number() over (order by position, task_id)::integer as new_position
    from public.editorial_series_items where series_id = v_item.series_id
  )
  update public.editorial_series_items i set position = r.new_position from renumbered r where i.task_id = r.task_id;
  select count(*) into v_remaining from public.editorial_series_items where series_id = v_item.series_id;
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
  values (p_actor_id, 'journalism', 'journalism_task_details', p_task_id, 'detach_series_from_journalism_task',
    jsonb_build_object('seriesId', v_item.series_id, 'oldPosition', v_item.position, 'itemCount', v_remaining));
end
$function$;

create or replace function public.api_reorder_editorial_series_v1(
  p_actor_id uuid,
  p_series_id uuid,
  p_task_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_series public.editorial_series;
  v_count integer;
  v_offset integer;
  v_index integer;
  v_moved_count integer;
  v_task uuid;
begin
  v_series := public.api_j5d_assert_manage_series(p_actor_id, p_series_id);
  perform 1 from public.editorial_series_items where series_id = p_series_id order by position for update;
  for v_task in select task_id from public.editorial_series_items where series_id = p_series_id order by position loop
    perform public.api_assert_journalism_access(p_actor_id, v_task, 'task.view');
  end loop;
  select count(*) into v_count from public.editorial_series_items where series_id = p_series_id;
  if coalesce(array_length(p_task_ids, 1), 0) <> v_count then raise exception 'Series order must include every task.' using errcode = '23505'; end if;
  if exists (
    select 1 from (
      select unnest(p_task_ids) as task_id
    ) submitted
    full join (
      select task_id from public.editorial_series_items where series_id = p_series_id
    ) current on current.task_id = submitted.task_id
    where submitted.task_id is null or current.task_id is null
  ) or exists (select 1 from (select unnest(p_task_ids) task_id) x group by task_id having count(*) > 1) then
    raise exception 'Series order must be an exact permutation.' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.editorial_series_items i
    join unnest(p_task_ids) with ordinality requested(task_id, new_position) on requested.task_id = i.task_id
    where i.series_id = p_series_id and i.position <> requested.new_position
  ) then
    select count(*) into v_moved_count from public.editorial_series_items i
    join unnest(p_task_ids) with ordinality requested(task_id, new_position) on requested.task_id = i.task_id
    where i.series_id = p_series_id and i.position <> requested.new_position;
    select coalesce(max(position), 0) + v_count + 1 into v_offset
    from public.editorial_series_items where series_id = p_series_id;
    update public.editorial_series_items set position = position + v_offset where series_id = p_series_id;
    v_index := 1;
    foreach v_task in array p_task_ids loop
      update public.editorial_series_items set position = v_index where series_id = p_series_id and task_id = v_task;
      v_index := v_index + 1;
    end loop;
    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
    values (p_actor_id, 'journalism', 'editorial_series', p_series_id, 'reorder_editorial_series',
      jsonb_build_object('itemCount', v_count, 'movedCount', v_moved_count));
  end if;
end
$function$;

do $block$
declare v_signature text;
begin
  foreach v_signature in array array[
    'api_j5d_assert_assign(uuid,uuid,uuid)',
    'api_j5d_assert_manage_series(uuid,uuid)',
    'api_attach_editorial_topic_task_v1(uuid,uuid,uuid)',
    'api_detach_editorial_topic_task_v1(uuid,uuid,uuid)',
    'api_attach_editorial_series_task_v1(uuid,uuid,uuid)',
    'api_detach_editorial_series_task_v1(uuid,uuid)',
    'api_reorder_editorial_series_v1(uuid,uuid,uuid[])'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', v_signature);
    execute format('grant execute on function public.%s to service_role', v_signature);
    execute format('alter function public.%s owner to postgres', v_signature);
  end loop;
end
$block$;

commit;
