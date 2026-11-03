select case when
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in ('projects','project_members')
     and c.relkind='r' and c.relrowsecurity) = 2
  and exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='tasks' and column_name='project_id' and udt_name='uuid')
  and to_regprocedure('public.api_create_project(uuid,text,text,text,uuid,uuid[])') is not null
  and to_regprocedure('public.api_update_project(uuid,uuid,text,text,text,uuid)') is not null
  and to_regprocedure('public.api_set_project_member(uuid,uuid,uuid,text,boolean)') is not null
  and to_regprocedure('public.api_close_project(uuid,uuid)') is not null
  and to_regprocedure('public.api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text)') is not null
  and (select count(*) from public.permissions where code='project.create') = 1
  and (select count(distinct r.code) from public.role_permission_grants g
    join public.roles r on r.id=g.role_id join public.permissions p on p.id=g.permission_id
    where p.code='project.create' and r.code in ('admin','tong_bien_tap') and g.scope='all') = 2
  and not exists (select 1 from pg_policies
    where schemaname='public' and tablename in ('projects','project_members')
      and (roles && array['anon','authenticated','public']::name[]))
  then 'pass' else 'fail' end;
