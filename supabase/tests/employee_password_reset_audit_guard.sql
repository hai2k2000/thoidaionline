begin;

create temporary table audit_guard_results (
  role_name text not null,
  operation text not null
) on commit drop;
grant insert, select on audit_guard_results to anon, authenticated;

select set_config('test.audit_update_id', gen_random_uuid()::text, true);
select set_config('test.audit_delete_id', gen_random_uuid()::text, true);

insert into public.audit_logs (id, module, entity_type, action, new_data)
values
  (
    current_setting('test.audit_update_id')::uuid,
    'admin',
    'staff_user',
    'password_reset',
    jsonb_build_object('status', 'pending')
  ),
  (
    current_setting('test.audit_delete_id')::uuid,
    'admin',
    'staff_user',
    'password_reset',
    jsonb_build_object('status', 'pending')
  );

set local role anon;
do $$
declare
  affected bigint;
begin
  begin
    insert into public.audit_logs (module, entity_type, action, new_data)
    values ('admin', 'staff_user', 'password_reset', jsonb_build_object('status', 'pending'));
    insert into audit_guard_results values ('anon', 'insert');
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.audit_logs
       set new_data = jsonb_build_object('status', 'sent')
     where id = current_setting('test.audit_update_id')::uuid;
    get diagnostics affected = row_count;
    if affected > 0 then
      insert into audit_guard_results values ('anon', 'update');
    end if;
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.audit_logs
     where id = current_setting('test.audit_delete_id')::uuid;
    get diagnostics affected = row_count;
    if affected > 0 then
      insert into audit_guard_results values ('anon', 'delete');
    end if;
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

set local role authenticated;
do $$
declare
  affected bigint;
begin
  begin
    insert into public.audit_logs (module, entity_type, action, new_data)
    values ('admin', 'staff_user', 'password_reset', jsonb_build_object('status', 'pending'));
    insert into audit_guard_results values ('authenticated', 'insert');
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.audit_logs
       set new_data = jsonb_build_object('status', 'sent')
     where id = current_setting('test.audit_update_id')::uuid;
    get diagnostics affected = row_count;
    if affected > 0 then
      insert into audit_guard_results values ('authenticated', 'update');
    end if;
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.audit_logs
     where id = current_setting('test.audit_delete_id')::uuid;
    get diagnostics affected = row_count;
    if affected > 0 then
      insert into audit_guard_results values ('authenticated', 'delete');
    end if;
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

do $$
declare
  violation_count bigint;
begin
  select count(*) into violation_count from audit_guard_results;
  if violation_count <> 0 then
    raise exception 'password reset audit mutations unexpectedly allowed: %', violation_count;
  end if;

  if has_table_privilege('anon', 'public.audit_logs', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.audit_logs', 'TRUNCATE') then
    raise exception 'untrusted roles must not truncate audit logs';
  end if;
end;
$$;

rollback;
select 'employee_password_reset_audit_guard ok' as result;
