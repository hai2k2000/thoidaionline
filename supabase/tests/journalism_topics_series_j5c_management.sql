begin;

do $test$
declare
  v_admin uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_manager uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_dept_a uuid := '11111111-1111-4111-8111-111111111111';
  v_dept_b uuid := '22222222-2222-4222-8222-222222222222';
  v_topic uuid;
  v_series uuid;
begin
  if (select count(*) from public.permissions) <> 21 then raise exception 'permission count'; end if;
  if (select count(*) from public.role_permission_grants) <> 140 then raise exception 'grant count'; end if;
  insert into public.departments(id, code, name) values
    (v_dept_a, 'j5c-a', 'J5C A'), (v_dept_b, 'j5c-b', 'J5C B') on conflict (id) do nothing;
  insert into public.staff_users(id, full_name, role_id, department_id, active) values
    (v_admin, 'J5C Admin', (select id from public.roles where code='admin'), null, true),
    (v_manager, 'J5C Manager', (select id from public.roles where code='truong_phong'), v_dept_a, true)
  on conflict (id) do nothing;

  v_topic := (select id from public.api_create_editorial_topic_v1(v_admin, '  Alpha  ', 'desc', null));
  if (select name from public.editorial_topics where id=v_topic) <> 'Alpha' then raise exception 'topic trim'; end if;
  begin
    perform public.api_create_editorial_topic_v1(v_manager, 'Denied', null, null);
    raise exception 'department actor created global topic';
  exception when sqlstate '42501' then null;
  end;
  v_series := (select id from public.api_create_editorial_series_v1(v_manager, 'Series A', null, v_dept_a, v_topic));
  perform public.api_archive_editorial_topic_v1(v_admin, v_topic);
  if not exists(select 1 from public.editorial_series where id=v_series and is_active and topic_id=v_topic) then
    raise exception 'topic archive cascaded to series';
  end if;
  begin
    perform public.api_create_editorial_series_v1(v_admin, 'Archived Parent', null, null, v_topic);
    raise exception 'archived topic accepted';
  exception when sqlstate '22023' then null;
  end;
  if not exists(select 1 from public.audit_logs where entity_id=v_topic and action='create_editorial_topic') then raise exception 'create audit'; end if;
  if not exists(select 1 from public.audit_logs where entity_id=v_topic and action='archive_editorial_topic') then raise exception 'archive audit'; end if;
end
$test$;

rollback;
