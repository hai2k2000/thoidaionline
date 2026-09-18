\set ON_ERROR_STOP on
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
end $$;
\ir /work/migration.sql

do $$
declare
  v_count integer;
  v_kind uuid;
  v_task uuid := gen_random_uuid();
begin
  select count(*) into v_count from public.journalism_work_kinds;
  if v_count <> 10 then raise exception 'expected 10 seeds, got %', v_count; end if;
  select id into v_kind from public.journalism_work_kinds where code = 'news';
  insert into public.tasks(id) values (v_task);
  insert into public.journalism_task_details(task_id, work_kind_id) values (v_task, v_kind);
  begin
    insert into public.journalism_work_kinds(code, name) values ('bad', '   ');
    raise exception 'blank name accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.journalism_work_kinds(code, name) values (' bad', 'Bad');
    raise exception 'trimmed code accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.journalism_work_kinds(code, name) values ('Bad-Code', 'Bad code');
    raise exception 'invalid code accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.journalism_task_details(task_id, work_kind_id) values (v_task, v_kind);
    raise exception 'duplicate detail accepted';
  exception when unique_violation then null;
  end;
  begin
    delete from public.journalism_work_kinds where id = v_kind;
    raise exception 'referenced kind deleted';
  exception when foreign_key_violation then null;
  end;
end $$;

delete from public.journalism_task_details;
delete from public.tasks;

set role anon;
do $$ begin
  begin
    perform * from public.journalism_work_kinds;
    raise exception 'anon read accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role authenticated;
do $$ begin
  begin
    perform * from public.journalism_work_kinds;
    raise exception 'authenticated read accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.journalism_work_kinds(code, name) values ('client_write', 'Client write');
    raise exception 'authenticated write accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
