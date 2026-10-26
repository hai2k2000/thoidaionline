begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- C-01: the application authenticates with its own HMAC session cookie and
-- reaches PostgreSQL only through the service_role client after checking that
-- session. anon/authenticated must not hold any privilege in schema public.
-- Supersedes 20260901095000_backend_security_hardening.sql (public part), which
-- was never applied to production, and covers tables created after it.
-- service_role has BYPASSRLS and explicit grants, so it is unaffected.

do $lockdown$
declare
  rel record;
  fn record;
  priv text;
  kept text[];
begin
  -- 1. Tables, views and sequences reachable by anon/authenticated/PUBLIC.
  for rel in
    select c.oid, c.relname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
      and exists (
        select 1 from aclexplode(coalesce(c.relacl, acldefault(case when c.relkind = 'S' then 's' else 'r' end, c.relowner))) a
        where a.grantee in (0, 'anon'::regrole, 'authenticated'::regrole)
      )
  loop
    kept := array[]::text[];
    foreach priv in array case when rel.relkind = 'S'
      then array['SELECT', 'UPDATE', 'USAGE']
      else array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] end
    loop
      if (rel.relkind = 'S' and has_sequence_privilege('service_role', rel.oid, priv))
         or (rel.relkind <> 'S' and has_table_privilege('service_role', rel.oid, priv)) then
        kept := kept || priv;
      end if;
    end loop;

    execute format('revoke all privileges on %s public.%I from public, anon, authenticated',
      case when rel.relkind = 'S' then 'sequence' else 'table' end, rel.relname);

    if cardinality(kept) > 0 then
      execute format('grant %s on %s public.%I to service_role', array_to_string(kept, ', '),
        case when rel.relkind = 'S' then 'sequence' else 'table' end, rel.relname);
    end if;
  end loop;

  -- 2. Functions executable by anon/authenticated (directly or via PUBLIC).
  for fn in
    select p.oid, p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  loop
    if has_function_privilege('service_role', fn.oid, 'EXECUTE') then
      execute format('grant execute on function %s to service_role', fn.signature);
    end if;
    execute format('revoke execute on function %s from public, anon, authenticated', fn.signature);
  end loop;
end
$lockdown$;

-- 3. Legacy "public read/write" policies for anon (from supabase-init.sql).
drop policy if exists "public read employee_profiles" on public.employee_profiles;
drop policy if exists "public write employee_profiles" on public.employee_profiles;
drop policy if exists "public read official_documents" on public.official_documents;
drop policy if exists "public write official_documents" on public.official_documents;
drop policy if exists "public read document_assignments" on public.document_assignments;
drop policy if exists "public write document_assignments" on public.document_assignments;

-- 4. Defense in depth: RLS on the tables that still had it disabled. No
-- policies are added, so only roles with BYPASSRLS (service_role, postgres)
-- and table owners can read or write them.
alter table public.work_schedules enable row level security;
alter table public.task_completion_scores enable row level security;
alter table public.task_quick_report_idempotency enable row level security;
alter table public.db_record_code_counters enable row level security;

-- 5. Future objects created by postgres in schema public no longer grant
-- anything to anon/authenticated. (Objects owned by supabase_admin are handled
-- separately; there are none in schema public today.)
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- 6. Fail the migration if anything is still reachable.
do $assert$
declare
  leaked bigint;
begin
  select count(*) into leaked
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
    and (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      or has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'));
  if leaked > 0 then raise exception 'C-01 lockdown incomplete: % relations still granted to anon/authenticated', leaked; end if;

  select count(*) into leaked
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if leaked > 0 then raise exception 'C-01 lockdown incomplete: % functions still executable by anon/authenticated', leaked; end if;

  select count(*) into leaked
  from pg_policies where schemaname = 'public'
    and ('anon' = any(roles) or 'authenticated' = any(roles) or 'public' = any(roles));
  if leaked > 0 then raise exception 'C-01 lockdown incomplete: % anon/authenticated/public policies remain', leaked; end if;
end
$assert$;

commit;
