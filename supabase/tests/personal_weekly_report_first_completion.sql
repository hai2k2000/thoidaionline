\set ON_ERROR_STOP on

do $$
declare
  v_department uuid := '10000000-0000-0000-0000-000000000011';
  v_employee uuid := '20000000-0000-0000-0000-000000000011';
  v_report public.personal_weekly_reports;
  v_snapshot jsonb;
  v_count integer;
begin
  insert into public.departments(id, code, name) values (v_department, 'first-completion', 'First Completion');
  insert into public.staff_users(id, full_name, department_id) values (v_employee, 'First Employee', v_department);

  v_report := public.api_complete_personal_weekly_report(
    v_employee, v_employee, '2026-10-02', '2026-10-09',
    '{"employee":{"full_name":"First Employee","departments":{"name":"First Completion"}},"currentRows":[],"nextRows":[]}'::jsonb,
    'Submitted difficulty'
  );
  if v_report.status <> 'COMPLETED' or v_report.snapshot_payload->>'difficulties' <> 'Submitted difficulty'
     or v_report.difficulties <> 'Submitted difficulty' then
    raise exception 'first completion did not persist the submitted difficulty';
  end if;
  v_snapshot := v_report.snapshot_payload;
  select count(*) into v_count from public.personal_weekly_reports
  where employee_id = v_employee and period_start = '2026-10-02' and period_end = '2026-10-09';
  if v_count <> 1 then raise exception 'first completion created % rows', v_count; end if;

  v_report := public.api_complete_personal_weekly_report(
    v_employee, v_employee, '2026-10-02', '2026-10-09',
    '{"currentRows":[{"taskId":"changed"}]}'::jsonb, 'Changed difficulty'
  );
  if v_report.snapshot_payload is distinct from v_snapshot or v_report.difficulties <> 'Submitted difficulty' then
    raise exception 'repeated completion changed the immutable snapshot';
  end if;
end;
$$;

select 'FIRST_COMPLETION_PASS' as result;
