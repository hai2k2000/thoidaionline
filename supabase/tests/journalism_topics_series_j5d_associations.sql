begin;

do $test$
declare
  v_admin uuid := 'a5d00000-0000-4000-8000-000000000001';
  v_manager uuid := 'a5d00000-0000-4000-8000-000000000002';
  v_reporter uuid := 'a5d00000-0000-4000-8000-000000000003';
  v_outsider uuid := 'a5d00000-0000-4000-8000-000000000004';
  v_ptbt uuid := 'a5d00000-0000-4000-8000-000000000005';
  v_dept_a uuid := 'a5d10000-0000-4000-8000-000000000001';
  v_dept_b uuid := 'a5d10000-0000-4000-8000-000000000002';
  v_task_a uuid := 'a5d20000-0000-4000-8000-000000000001';
  v_task_b uuid := 'a5d20000-0000-4000-8000-000000000002';
  v_task_c uuid := 'a5d20000-0000-4000-8000-000000000003';
  v_normal uuid := 'a5d20000-0000-4000-8000-000000000004';
  v_task_d uuid := 'a5d20000-0000-4000-8000-000000000005';
  v_kind uuid;
  v_global_topic uuid;
  v_dept_topic uuid;
  v_other_topic uuid;
  v_archived_topic uuid;
  v_global_series uuid;
  v_dept_series uuid;
  v_other_series uuid;
  v_archived_series uuid;
  v_second_series uuid;
  v_audit integer;
  v_before uuid[];
begin
  if (select count(*) from public.permissions) <> 21 then raise exception 'permission count changed'; end if;
  if (select count(*) from public.role_permission_grants) <> 140 then raise exception 'grant count changed'; end if;

  insert into public.departments(id, code, name) values
    (v_dept_a, 'j5d-a', 'J5D A'), (v_dept_b, 'j5d-b', 'J5D B') on conflict (id) do nothing;
  insert into public.staff_users(id, full_name, role_id, department_id, active) values
    (v_admin, 'J5D Admin', (select id from public.roles where code='admin'), null, true),
    (v_manager, 'J5D Manager', (select id from public.roles where code='truong_phong'), v_dept_a, true),
    (v_reporter, 'J5D Reporter', (select id from public.roles where code='phong_vien'), v_dept_a, true),
    (v_outsider, 'J5D Outsider', (select id from public.roles where code='phong_vien'), v_dept_a, true),
    (v_ptbt, 'J5D PTBT', (select id from public.roles where code='pho_tong_bien_tap'), v_dept_a, true)
  on conflict (id) do update set active=true;
  select id into v_kind from public.journalism_work_kinds limit 1;
  insert into public.tasks(id,title,department_id,created_by,owner_id,assignee_id,reviewer_id) values
    (v_task_a,'J5D SQL A',v_dept_a,v_admin,v_reporter,v_reporter,v_manager),
    (v_task_b,'J5D SQL B',v_dept_a,v_admin,v_manager,v_manager,v_manager),
    (v_task_c,'J5D SQL C',v_dept_b,v_admin,v_admin,v_admin,v_admin),
    (v_normal,'J5D SQL Normal',v_dept_a,v_admin,v_reporter,v_reporter,v_manager),
    (v_task_d,'J5D SQL D',v_dept_a,v_admin,v_reporter,v_reporter,v_manager)
  on conflict (id) do nothing;
  insert into public.journalism_task_details(task_id,work_kind_id) values
    (v_task_a,v_kind),(v_task_b,v_kind),(v_task_c,v_kind),(v_task_d,v_kind)
  on conflict (task_id) do nothing;

  insert into public.editorial_topics(name,department_id,is_active,created_by) values
    ('J5D Global Topic SQL',null,true,v_admin),
    ('J5D Dept Topic SQL',v_dept_a,true,v_admin),
    ('J5D Other Topic SQL',v_dept_b,true,v_admin),
    ('J5D Archived Topic SQL',v_dept_a,false,v_admin);
  select id into v_global_topic from public.editorial_topics where name='J5D Global Topic SQL';
  select id into v_dept_topic from public.editorial_topics where name='J5D Dept Topic SQL';
  select id into v_other_topic from public.editorial_topics where name='J5D Other Topic SQL';
  select id into v_archived_topic from public.editorial_topics where name='J5D Archived Topic SQL';

  perform public.api_attach_editorial_topic_task_v1(v_admin,v_task_a,v_global_topic);
  perform public.api_attach_editorial_topic_task_v1(v_manager,v_task_b,v_dept_topic);
  perform public.api_attach_editorial_topic_task_v1(v_reporter,v_task_d,v_dept_topic);
  begin perform public.api_attach_editorial_topic_task_v1(v_manager,v_task_b,v_other_topic); raise exception 'cross-department topic accepted'; exception when sqlstate '42501' then null; end;
  begin perform public.api_attach_editorial_topic_task_v1(v_admin,v_task_a,v_archived_topic); raise exception 'archived topic accepted'; exception when unique_violation then null; end;
  begin perform public.api_attach_editorial_topic_task_v1(v_admin,v_normal,v_global_topic); raise exception 'normal task accepted'; exception when no_data_found then null; end;
  begin perform public.api_attach_editorial_topic_task_v1(v_outsider,v_task_a,v_dept_topic); raise exception 'unassigned actor accepted'; exception when sqlstate '42501' then null; end;
  begin perform public.api_attach_editorial_topic_task_v1(v_admin,v_task_a,v_global_topic); raise exception 'duplicate topic accepted'; exception when unique_violation then null; end;
  update public.editorial_topics set is_active=false where id=v_dept_topic;
  perform public.api_detach_editorial_topic_task_v1(v_manager,v_task_b,v_dept_topic);
  select count(*) into v_audit from public.audit_logs where action='detach_topic_from_journalism_task' and entity_id=v_task_b;
  perform public.api_detach_editorial_topic_task_v1(v_manager,v_task_b,v_dept_topic);
  if (select count(*) from public.audit_logs where action='detach_topic_from_journalism_task' and entity_id=v_task_b) <> v_audit then raise exception 'topic no-op audit'; end if;

  insert into public.editorial_series(name,department_id,is_active,created_by) values
    ('J5D Global Series SQL',null,true,v_admin),
    ('J5D Dept Series SQL',v_dept_a,true,v_admin),
    ('J5D Other Series SQL',v_dept_b,true,v_admin),
    ('J5D Archived Series SQL',v_dept_a,false,v_admin),
    ('J5D Second Series SQL',v_dept_a,true,v_admin);
  select id into v_global_series from public.editorial_series where name='J5D Global Series SQL';
  select id into v_dept_series from public.editorial_series where name='J5D Dept Series SQL';
  select id into v_other_series from public.editorial_series where name='J5D Other Series SQL';
  select id into v_archived_series from public.editorial_series where name='J5D Archived Series SQL';
  select id into v_second_series from public.editorial_series where name='J5D Second Series SQL';

  if public.api_attach_editorial_series_task_v1(v_admin,v_task_a,v_global_series) <> 1 then raise exception 'first append'; end if;
  if public.api_attach_editorial_series_task_v1(v_admin,v_task_b,v_global_series) <> 2 then raise exception 'second append'; end if;
  select count(*) into v_audit from public.audit_logs where action='attach_series_to_journalism_task' and entity_id=v_task_a;
  if public.api_attach_editorial_series_task_v1(v_admin,v_task_a,v_global_series) <> 1 then raise exception 'same series result'; end if;
  if (select count(*) from public.audit_logs where action='attach_series_to_journalism_task' and entity_id=v_task_a) <> v_audit then raise exception 'same series audit'; end if;
  begin perform public.api_attach_editorial_series_task_v1(v_admin,v_task_a,v_second_series); raise exception 'silent move accepted'; exception when unique_violation then null; end;
  begin perform public.api_attach_editorial_series_task_v1(v_admin,v_task_d,v_archived_series); raise exception 'archived series accepted'; exception when unique_violation then null; end;
  begin perform public.api_attach_editorial_series_task_v1(v_manager,v_task_d,v_other_series); raise exception 'cross-department series accepted'; exception when sqlstate '42501' then null; end;

  select array_agg(task_id order by position) into v_before from public.editorial_series_items where series_id=v_global_series;
  perform public.api_reorder_editorial_series_v1(v_admin,v_global_series,array[v_task_b,v_task_a]);
  if (select array_agg(task_id order by position) from public.editorial_series_items where series_id=v_global_series) <> array[v_task_b,v_task_a] then raise exception 'reorder failed'; end if;
  select count(*) into v_audit from public.audit_logs where action='reorder_editorial_series' and entity_id=v_global_series;
  perform public.api_reorder_editorial_series_v1(v_admin,v_global_series,array[v_task_b,v_task_a]);
  if (select count(*) from public.audit_logs where action='reorder_editorial_series' and entity_id=v_global_series) <> v_audit then raise exception 'reorder no-op audit'; end if;
  begin perform public.api_reorder_editorial_series_v1(v_admin,v_global_series,array[v_task_b]); raise exception 'missing item accepted'; exception when unique_violation then null; end;
  begin perform public.api_reorder_editorial_series_v1(v_admin,v_global_series,array[v_task_b,v_task_b]); raise exception 'duplicate item accepted'; exception when unique_violation then null; end;
  begin perform public.api_reorder_editorial_series_v1(v_ptbt,v_global_series,array[v_task_a,v_task_b]); raise exception 'task visibility expansion'; exception when sqlstate '42501' then null; end;

  update public.editorial_series set is_active=false where id=v_global_series;
  begin perform public.api_reorder_editorial_series_v1(v_admin,v_global_series,array[v_task_b,v_task_a]); raise exception 'archived reorder accepted'; exception when unique_violation then null; end;
  perform public.api_detach_editorial_series_task_v1(v_admin,v_task_a);
  if (select array_agg(position order by position) from public.editorial_series_items where series_id=v_global_series) <> array[1] then raise exception 'detach compaction'; end if;
  select count(*) into v_audit from public.audit_logs where action='detach_series_from_journalism_task' and entity_id=v_task_a;
  perform public.api_detach_editorial_series_task_v1(v_admin,v_task_a);
  if (select count(*) from public.audit_logs where action='detach_series_from_journalism_task' and entity_id=v_task_a) <> v_audit then raise exception 'series no-op audit'; end if;
end
$test$;

do $audit_rollback$
declare
  v_admin uuid := 'a5d00000-0000-4000-8000-000000000001';
  v_task uuid := 'a5d20000-0000-4000-8000-000000000005';
  v_topic uuid := (select id from public.editorial_topics where name='J5D Global Topic SQL');
begin
  create temporary table j5d_audit_block(enabled boolean) on commit drop;
  insert into j5d_audit_block values(true);
  create or replace function pg_temp.j5d_reject_audit() returns trigger language plpgsql as $fn$
  begin
    if new.action='attach_topic_to_journalism_task' then raise exception 'forced audit failure'; end if;
    return new;
  end $fn$;
  create trigger j5d_reject_audit before insert on public.audit_logs for each row execute function pg_temp.j5d_reject_audit();
  begin perform public.api_attach_editorial_topic_task_v1(v_admin,v_task,v_topic); exception when others then null; end;
  if exists(select 1 from public.editorial_topic_tasks where task_id=v_task and topic_id=v_topic) then raise exception 'audit failure did not roll back'; end if;
  drop trigger j5d_reject_audit on public.audit_logs;
end
$audit_rollback$;

do $acl$
declare v_bad integer;
begin
  select count(*) into v_bad
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'api_attach_editorial_topic_task_v1','api_detach_editorial_topic_task_v1',
    'api_attach_editorial_series_task_v1','api_detach_editorial_series_task_v1','api_reorder_editorial_series_v1'
  ) and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'));
  if v_bad <> 0 then raise exception 'browser RPC execute privilege'; end if;
end
$acl$;

select 'J5D_ASSOCIATION_SQL_PASS' as result;
rollback;
