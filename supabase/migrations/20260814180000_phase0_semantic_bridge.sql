do $bridge$
declare
  v_eval regprocedure;
  v_positive_count integer;
  v_positive_distinct integer;
  v_positive_min integer;
  v_positive_max integer;
begin
  if to_regclass('public.password_reset_tokens') is null
     or to_regclass('public.password_reset_attempts') is null then
    raise exception 'password reset catalog is incomplete';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='staff_users'
      and column_name='password_hash' and data_type='text'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='staff_users'
      and column_name='session_version' and data_type='bigint'
      and is_nullable='NO'
  ) then
    raise exception 'staff credential catalog is incomplete';
  end if;

  if to_regprocedure('public.consume_password_reset(text,text)') is null
     or to_regprocedure('public.ensure_staff_password_hash()') is null then
    raise exception 'password reset functions are incomplete';
  end if;

  if exists (
    select 1 from public.staff_users
    where password_hash is null or password is not null
  ) then
    raise exception 'staff credential terminal invariant failed';
  end if;

  if to_regprocedure('public.can_administer_users(uuid)') is null then
    raise exception 'admin policy helper is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_manage_users' and data_type='boolean'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='role_permissions'
      and column_name='can_manage_permissions' and data_type='boolean'
  ) then
    raise exception 'admin permission catalog is incomplete';
  end if;

  v_eval := to_regprocedure(
    'public.save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)'
  );
  if v_eval is null then
    raise exception 'terminal evaluation guard is missing';
  end if;
  if not exists (
    select 1 from pg_proc p
    where p.oid=v_eval
      and p.prosecdef
      and p.proconfig @> array['search_path=public, pg_temp']
  ) then
    raise exception 'terminal evaluation guard security attributes differ';
  end if;
  if has_function_privilege('public',v_eval,'EXECUTE')
     or has_function_privilege('anon',v_eval,'EXECUTE')
     or has_function_privilege('authenticated',v_eval,'EXECUTE')
     or not has_function_privilege('service_role',v_eval,'EXECUTE') then
    raise exception 'terminal evaluation guard privilege invariant failed';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='staff_users'
      and column_name='list_order' and data_type='integer'
      and is_nullable='NO'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='staff_users'
      and indexname='staff_users_list_order_idx'
  ) then
    raise exception 'staff order catalog is incomplete';
  end if;

  if exists (
    select 1 from public.staff_users where list_order < 0
  ) then
    raise exception 'negative staff order exists';
  end if;

  select count(*),count(distinct list_order),min(list_order),max(list_order)
  into v_positive_count,v_positive_distinct,v_positive_min,v_positive_max
  from public.staff_users
  where list_order > 0;

  if v_positive_count<>v_positive_distinct
     or (
       v_positive_count>0
       and (v_positive_min<>1 or v_positive_max<>v_positive_count)
     ) then
    raise exception 'staff order terminal invariant failed';
  end if;
end
$bridge$;
