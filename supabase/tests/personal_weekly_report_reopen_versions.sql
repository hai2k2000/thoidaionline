\set ON_ERROR_STOP on

begin;

do $$
declare
  v_department uuid := '10000000-0000-0000-0000-000000000071';
  v_employee uuid := '20000000-0000-0000-0000-000000000071';
  v_other uuid := '20000000-0000-0000-0000-000000000072';
  v_admin uuid := '20000000-0000-0000-0000-000000000073';
  v_admin_role uuid;
  v_report public.personal_weekly_reports;
  v_version public.personal_weekly_report_versions;
  v_count integer;
  v_failed boolean;
  v_reason text := 'Correct a completed report';
begin
  select id into v_admin_role from public.roles where code='admin' and active;
  if v_admin_role is null then raise exception 'active admin role missing from rehearsal'; end if;
  insert into public.departments(id,code,name) values(v_department,'weekly-reopen-rehearsal','Weekly Reopen Rehearsal');
  insert into public.staff_users(id,full_name,department_id) values(v_employee,'Reopen Employee',v_department),(v_other,'Other Employee',v_department);
  insert into public.staff_users(id,full_name,department_id,role_id) values(v_admin,'Reopen Admin',v_department,v_admin_role);

  v_report := public.api_complete_personal_weekly_report(v_employee,v_employee,'2026-10-02','2026-10-09','{"currentRows":[]}'::jsonb,'First difficulty');
  if v_report.status <> 'COMPLETED' then raise exception 'first completion failed'; end if;
  select * into v_version from public.personal_weekly_report_versions where report_id=v_report.id and version_no=1;
  if v_version.id is null or v_version.snapshot_payload is distinct from v_report.snapshot_payload then raise exception 'first version missing or mismatched'; end if;
  perform public.api_complete_personal_weekly_report(v_employee,v_employee,'2026-10-02','2026-10-09','{"currentRows":[1]}'::jsonb,'Changed');
  if (select count(*) from public.personal_weekly_report_versions where report_id=v_report.id) <> 1 then raise exception 'completion is not idempotent'; end if;

  v_failed := false;
  begin update public.personal_weekly_reports set difficulties='Tampered' where id=v_report.id; exception when sqlstate '42501' then v_failed:=true; end;
  if not v_failed then raise exception 'direct completed update succeeded'; end if;
  v_failed := false;
  begin update public.personal_weekly_report_versions set difficulties='Tampered' where id=v_version.id; exception when sqlstate '42501' then v_failed:=true; end;
  if not v_failed then raise exception 'version update succeeded'; end if;
  v_failed := false;
  begin delete from public.personal_weekly_report_versions where id=v_version.id; exception when sqlstate '42501' then v_failed:=true; end;
  if not v_failed then raise exception 'version delete succeeded'; end if;

  foreach v_reason in array array['', 'four', repeat('x',501)] loop
    v_failed := false;
    begin perform public.api_reopen_personal_weekly_report(v_employee,v_report.id,v_reason); exception when sqlstate '22023' then v_failed:=true; end;
    if not v_failed then raise exception 'invalid reason accepted'; end if;
  end loop;
  v_failed := false;
  begin perform public.api_reopen_personal_weekly_report(v_other,v_report.id,'Valid other reason'); exception when sqlstate '42501' then v_failed:=true; end;
  if not v_failed then raise exception 'cross-user reopen accepted'; end if;

  -- Fixture clock adjustment is available only in this rolled-back superuser rehearsal.
  perform set_config('app.personal_weekly_report_reopen_id',v_report.id::text,true);
  update public.personal_weekly_reports set status='DRAFT',snapshot_payload=null,completed_at=null where id=v_report.id;
  update public.personal_weekly_reports set status='COMPLETED',snapshot_payload=v_version.snapshot_payload,completed_at=now()-interval '23 hours 59 minutes' where id=v_report.id;
  perform set_config('app.personal_weekly_report_reopen_id','',true);
  v_report := public.api_reopen_personal_weekly_report(v_employee,v_report.id,'  Correct a completed report  ');
  if v_report.status <> 'DRAFT' or v_report.draft_payload is distinct from v_version.snapshot_payload
    or v_report.snapshot_payload is not null or v_report.completed_at is not null then raise exception 'draft not seeded from completed snapshot'; end if;
  if not exists(select 1 from public.audit_logs where entity_id=v_report.id and action='personal_weekly_report.reopened'
    and new_data->>'reason'='Correct a completed report' and new_data->>'version_no'='1') then raise exception 'reopen audit missing'; end if;
  v_report := public.api_complete_personal_weekly_report(v_employee,v_employee,'2026-10-02','2026-10-09','{"currentRows":[2]}'::jsonb,'Second difficulty');
  if (select count(*) from public.personal_weekly_report_versions where report_id=v_report.id) <> 2
    or (select snapshot_payload from public.personal_weekly_report_versions where id=v_version.id) is distinct from v_version.snapshot_payload then
    raise exception 'second completion versioning failed'; end if;

  -- Rebuild only this rolled-back fixture at the exact boundary.
  perform set_config('app.personal_weekly_report_reopen_id',v_report.id::text,true);
  update public.personal_weekly_reports set status='DRAFT',snapshot_payload=null,completed_at=null where id=v_report.id;
  update public.personal_weekly_reports set status='COMPLETED',snapshot_payload=v_report.snapshot_payload,completed_at=now()-interval '24 hours' + interval '1 second' where id=v_report.id;
  perform set_config('app.personal_weekly_report_reopen_id','',true);
  -- The one-second allowance keeps the 24:00 boundary deterministic while the RPC uses server time.
  perform public.api_reopen_personal_weekly_report(v_employee,v_report.id,'Exact boundary reason');
  v_report := public.api_complete_personal_weekly_report(v_employee,v_employee,'2026-10-02','2026-10-09','{"currentRows":[3]}'::jsonb,'Third difficulty');
  perform set_config('app.personal_weekly_report_reopen_id',v_report.id::text,true);
  update public.personal_weekly_reports set status='DRAFT',snapshot_payload=null,completed_at=null where id=v_report.id;
  update public.personal_weekly_reports set status='COMPLETED',snapshot_payload=v_report.snapshot_payload,completed_at=now()-interval '24 hours 1 second' where id=v_report.id;
  perform set_config('app.personal_weekly_report_reopen_id','',true);
  v_failed:=false;
  begin perform public.api_reopen_personal_weekly_report(v_employee,v_report.id,'Expired reason'); exception when sqlstate '42501' then v_failed:=true; end;
  if not v_failed then raise exception 'expired employee reopen accepted'; end if;
  perform public.api_reopen_personal_weekly_report(v_admin,v_report.id,'Admin correction');

  -- Legacy snapshot is seeded only when a completed legacy row is reopened.
  v_report := public.api_complete_personal_weekly_report(v_employee,v_employee,'2026-10-09','2026-10-16','{"currentRows":[]}'::jsonb,'Legacy difficulty');
  -- The immutable version is removed only in this rolled-back rehearsal fixture by disabling its guard locally.
  alter table public.personal_weekly_report_versions disable trigger personal_weekly_report_versions_immutable;
  delete from public.personal_weekly_report_versions where report_id=v_report.id;
  alter table public.personal_weekly_report_versions enable trigger personal_weekly_report_versions_immutable;
  perform public.api_reopen_personal_weekly_report(v_employee,v_report.id,'Legacy correction');
  if (select count(*) from public.personal_weekly_report_versions where report_id=v_report.id and version_no=1) <> 1 then raise exception 'legacy version seed missing'; end if;
end;
$$;

rollback;
select 'PERSONAL_WEEKLY_REPORT_REOPEN_VERSIONS_PASS' as result;
