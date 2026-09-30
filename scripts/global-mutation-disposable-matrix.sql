\set ON_ERROR_STOP on

begin;

set local session_replication_role = replica;

insert into public.roles (id, code, name, level, active) values
  ('20000000-0000-0000-0000-000000000001', 'admin', 'Test Admin', 5, true),
  ('20000000-0000-0000-0000-000000000002', 'nhan_vien', 'Test Employee', 1, true),
  ('20000000-0000-0000-0000-000000000003', 'truong_phong', 'Test Manager', 3, true),
  ('20000000-0000-0000-0000-000000000004', 'tong_bien_tap', 'Test TBT', 4, true),
  ('20000000-0000-0000-0000-000000000005', 'pho_tong_bien_tap', 'Test PTBT', 4, true)
on conflict (code) do update set name = excluded.name, level = excluded.level, active = true;

insert into public.departments (id, code, name, active, manager_id)
values ('10000000-0000-0000-0000-000000000001', 'global_mutation_test', 'Global Mutation Test', true, null)
on conflict (id) do update set active = true;

insert into public.staff_users (id, full_name, email, password_hash, role_id, department_id, active)
values
  ('00000000-0000-0000-0000-000000000001', 'Test Admin', 'admin@test.invalid', 'fixture', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000002', 'Test Creator', 'creator@test.invalid', 'fixture', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000003', 'Test Non Creator', 'noncreator@test.invalid', 'fixture', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000004', 'Test Assignee', 'assignee@test.invalid', 'fixture', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000005', 'Test Reviewer', 'reviewer@test.invalid', 'fixture', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000006', 'Test Manager', 'manager@test.invalid', 'fixture', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000007', 'Test TBT', 'tbt@test.invalid', 'fixture', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000008', 'Test PTBT', 'ptbt@test.invalid', 'fixture', '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', true)
on conflict (id) do update set active = true, password_hash = 'fixture';

update public.departments
set manager_id = '00000000-0000-0000-0000-000000000006'
where id = '10000000-0000-0000-0000-000000000001';

insert into public.tasks
  (id, title, description, status, assignee_id, owner_id, assignment_mode, created_by,
   reviewer_id, department_id, due_date, task_type, approval_required, assignment_source)
values
  ('30000000-0000-0000-0000-000000000001', 'pending creator edit', 'fixture', 'new', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000002', 'pending creator cancel', 'fixture', 'new', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000003', 'pending non creator', 'fixture', 'new', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000004', 'pending assignee', 'fixture', 'new', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000005', 'pending reviewer', 'fixture', 'new', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000006', 'pending manager', 'fixture', 'new', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000007', 'pending tbt', 'fixture', 'new', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000008', 'pending ptbt', 'fixture', 'new', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000009', 'pending admin edit', 'fixture', 'new', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000010', 'done creator', 'fixture', 'done', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000011', 'done admin', 'fixture', 'done', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000012', 'cancelled admin', 'fixture', 'cancelled', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000013', 'personal pending', 'fixture', 'new', null, null, 'individual', '00000000-0000-0000-0000-000000000002', null, '10000000-0000-0000-0000-000000000001', '2026-10-01', 'personal', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000014', 'approved assignment', 'fixture', 'in_progress', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', true, 'self_registered'),
  ('30000000-0000-0000-0000-000000000016', 'personal pending cancel', 'fixture', 'new', null, null, 'individual', '00000000-0000-0000-0000-000000000002', null, '10000000-0000-0000-0000-000000000001', '2026-10-01', 'personal', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000017', 'assigned pending deadline', 'fixture', 'new', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000018', 'personal done', 'fixture', 'done', null, null, 'individual', '00000000-0000-0000-0000-000000000002', null, '10000000-0000-0000-0000-000000000001', '2026-10-01', 'personal', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000019', 'personal approved admin', 'fixture', 'done', null, null, 'individual', '00000000-0000-0000-0000-000000000002', null, '10000000-0000-0000-0000-000000000001', '2026-10-01', 'personal', false, 'legacy_unknown'),
  ('30000000-0000-0000-0000-000000000020', 'journalism approved', 'fixture', 'done', null, null, 'individual', '00000000-0000-0000-0000-000000000002', null, '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown')
on conflict (id) do nothing;

insert into public.tasks
  (id, title, description, status, assignee_id, owner_id, assignment_mode, created_by,
   reviewer_id, department_id, due_date, task_type, approval_required, assignment_source)
values
  ('30000000-0000-0000-0000-000000000021', 'approved in progress without event', 'fixture', 'in_progress', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'individual', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', true, 'self_registered')
on conflict (id) do nothing;

insert into public.task_status_events (id, task_id, from_status, to_status, reason, actor_id)
values ('31000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000014', 'waiting', 'in_progress', 'approved fixture', '00000000-0000-0000-0000-000000000005')
on conflict (id) do nothing;

insert into public.journalism_work_kinds (id, code, name, is_active)
values ('32000000-0000-0000-0000-000000000001', 'global_mutation_test', 'Global Mutation Test', true)
on conflict (id) do nothing;

insert into public.tasks
  (id, title, description, status, assignment_mode, created_by, department_id,
   due_date, task_type, approval_required, assignment_source)
values
  ('30000000-0000-0000-0000-000000000015', 'journalism pending creator', 'fixture', 'new', 'individual', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'assigned', false, 'legacy_unknown')
on conflict (id) do nothing;

insert into public.journalism_task_details (task_id, work_kind_id, publication_status)
values ('30000000-0000-0000-0000-000000000015', '32000000-0000-0000-0000-000000000001', 'not_published')
on conflict (task_id) do nothing;

insert into public.journalism_task_details (task_id, work_kind_id, publication_status)
values ('30000000-0000-0000-0000-000000000020', '32000000-0000-0000-0000-000000000001', 'not_published')
on conflict (task_id) do nothing;

insert into public.task_assignees (task_id, user_id, assignment_role, status)
select id, '00000000-0000-0000-0000-000000000004', 'assignee', 'todo'
from public.tasks
where id between '30000000-0000-0000-0000-000000000001' and '30000000-0000-0000-0000-000000000014'
on conflict do nothing;

insert into public.work_schedules
  (id, work_date, end_date, start_time, end_time, title, participant_ids, created_by,
   schedule_scope, approval_status, workflow_revision, plan_type)
values
  ('40000000-0000-0000-0000-000000000001', '2026-10-01', '2026-10-01', '09:00', '17:00', 'pending edit', array['00000000-0000-0000-0000-000000000002']::uuid[], '00000000-0000-0000-0000-000000000002', 'personal', 'PENDING_APPROVAL', 1, 'work'),
  ('40000000-0000-0000-0000-000000000002', '2026-10-01', '2026-10-01', '09:00', '17:00', 'pending cancel', array['00000000-0000-0000-0000-000000000002']::uuid[], '00000000-0000-0000-0000-000000000002', 'personal', 'PENDING_APPROVAL', 1, 'work'),
  ('40000000-0000-0000-0000-000000000003', '2026-10-01', '2026-10-01', '09:00', '17:00', 'approved creator', array['00000000-0000-0000-0000-000000000002']::uuid[], '00000000-0000-0000-0000-000000000002', 'personal', 'APPROVED', 1, 'work'),
  ('40000000-0000-0000-0000-000000000004', '2026-10-01', '2026-10-01', '09:00', '17:00', 'approved non creator', array['00000000-0000-0000-0000-000000000002']::uuid[], '00000000-0000-0000-0000-000000000002', 'personal', 'APPROVED', 1, 'work'),
  ('40000000-0000-0000-0000-000000000005', '2026-10-01', '2026-10-01', '09:00', '17:00', 'approved admin edit', array['00000000-0000-0000-0000-000000000002']::uuid[], '00000000-0000-0000-0000-000000000002', 'personal', 'APPROVED', 1, 'work'),
  ('40000000-0000-0000-0000-000000000006', '2026-10-01', '2026-10-01', '09:00', '17:00', 'approved admin cancel', array['00000000-0000-0000-0000-000000000002']::uuid[], '00000000-0000-0000-0000-000000000002', 'personal', 'APPROVED', 1, 'work'),
  ('40000000-0000-0000-0000-000000000007', '2026-10-01', '2026-10-01', '09:00', '17:00', 'cancelled schedule', array['00000000-0000-0000-0000-000000000002']::uuid[], '00000000-0000-0000-0000-000000000002', 'personal', 'CANCELLED', 1, 'work'),
  ('40000000-0000-0000-0000-000000000008', '2026-10-01', '2026-10-01', '09:00', '17:00', 'stale schedule', array['00000000-0000-0000-0000-000000000002']::uuid[], '00000000-0000-0000-0000-000000000002', 'personal', 'PENDING_APPROVAL', 1, 'work')
on conflict (id) do nothing;

insert into public.leave_requests
  (id, requester_id, department_id, start_date, end_date, start_period, end_period, leave_type, reason, status)
values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2026-10-02', '2026-10-02', 'full', 'full', 'annual', 'pending edit', 'pending'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2026-10-03', '2026-10-03', 'full', 'full', 'annual', 'pending cancel', 'pending'),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2026-10-04', '2026-10-04', 'full', 'full', 'annual', 'approved creator', 'approved'),
  ('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2026-10-05', '2026-10-05', 'full', 'full', 'annual', 'approved non requester', 'approved'),
  ('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2026-10-06', '2026-10-06', 'full', 'full', 'annual', 'approved admin edit', 'approved'),
  ('50000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2026-10-07', '2026-10-07', 'full', 'full', 'annual', 'approved admin cancel', 'approved'),
  ('50000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2026-10-08', '2026-10-08', 'full', 'full', 'annual', 'cancelled immutable', 'cancelled')
on conflict (id) do nothing;

set local session_replication_role = origin;

create or replace function pg_temp.expect_error(p_label text, p_sql text, p_codes text[])
returns void language plpgsql as $function$
declare
  v_failed boolean := false;
  v_code text;
begin
  begin
    execute p_sql;
  exception when others then
    v_failed := true;
    get stacked diagnostics v_code = returned_sqlstate;
  end;
  if not v_failed then
    raise exception 'expected failure did not occur: %', p_label;
  end if;
  if p_codes is not null and not (v_code = any(p_codes)) then
    raise exception 'unexpected error for %: %', p_label, v_code;
  end if;
end;
$function$;

-- TASK: creator pending edit/cancel pass.
select public.api_update_task('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'in_progress', null, false, null, false);
select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'creator cancellation');

-- TASK: every non-creator role is blocked while pending.
select pg_temp.expect_error('non-creator pending', $$select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'blocked')$$, array['42501']);
select pg_temp.expect_error('assignee pending', $$select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'blocked')$$, array['42501']);
select pg_temp.expect_error('reviewer pending', $$select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 'blocked')$$, array['42501']);
select pg_temp.expect_error('truong phong pending', $$select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000006', 'blocked')$$, array['42501']);
select pg_temp.expect_error('tbt pending', $$select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000007', 'blocked')$$, array['42501']);
select pg_temp.expect_error('ptbt pending', $$select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000008', 'blocked')$$, array['42501']);

-- TASK: admin may edit/cancel pending and done, but cancellation is immutable.
select public.api_update_task('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000009', null, '2026-10-02', true, 'high', true);
select public.api_admin_edit_task('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000009', 'admin edited', 'admin description', '2026-10-01', '2026-10-02', '10:00', 'high', 'new', null, 'admin edit test');
select pg_temp.expect_error('creator done', $$select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000010', 'blocked')$$, array['42501']);
select public.api_update_task('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011', null, '2026-10-03', true, null, false);
select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011', 'admin cancellation');
select pg_temp.expect_error('cancelled task immutable', $$select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000012', 'blocked')$$, array['42501']);
select pg_temp.expect_error('cancelled task admin edit immutable', $$select public.api_admin_edit_task('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000012', 'blocked', 'blocked', '2026-10-01', '2026-10-02', '10:00', 'normal', 'new', null, 'blocked')$$, array['42501']);
-- Assignment approval metadata/events do not finalize a task; creator may still mutate.
select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000014', 'creator cancellation after assignment event');
select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000021', 'creator cancellation while in progress');
select public.api_update_task('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000015', 'in_progress', null, false, null, false);
select public.api_edit_personal_task('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000013', 'personal edited', 'edited', '2026-10-01', null);
select public.api_cancel_personal_task('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000016', 'personal cancellation');
select public.api_change_assigned_task_deadline('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000017', '2026-10-05', 'creator deadline');
select pg_temp.expect_error('personal done creator', $$select public.api_edit_personal_task('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000018', 'blocked', 'blocked', '2026-10-01', null)$$, array['42501']);
select public.api_edit_personal_task('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000019', 'admin personal edit', 'admin', '2026-10-01', null);
select public.api_cancel_personal_task('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000019', 'admin personal cancellation');
select pg_temp.expect_error('journalism done creator', $$select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000020', 'blocked')$$, array['42501']);
select public.api_cancel_assigned_task('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000020', 'admin journalism cancellation');

do $function$
begin
  if has_function_privilege('anon', 'public.api_cancel_assigned_task(uuid,uuid,text)', 'EXECUTE') then raise exception 'anon can execute task mutation'; end if;
  if has_function_privilege('authenticated', 'public.api_cancel_assigned_task(uuid,uuid,text)', 'EXECUTE') then raise exception 'authenticated can execute task mutation'; end if;
  if not has_function_privilege('service_role', 'public.api_cancel_assigned_task(uuid,uuid,text)', 'EXECUTE') then raise exception 'service_role cannot execute task mutation'; end if;
  if has_function_privilege('anon', 'public.api_edit_leave_request(uuid,uuid,date,date,text,text,text,text)', 'EXECUTE') then raise exception 'anon can execute leave mutation'; end if;
  if has_function_privilege('authenticated', 'public.api_edit_leave_request(uuid,uuid,date,date,text,text,text,text)', 'EXECUTE') then raise exception 'authenticated can execute leave mutation'; end if;
  if has_function_privilege('anon', 'public.api_cancel_personal_work_schedule(uuid,uuid,bigint)', 'EXECUTE') then raise exception 'anon can execute schedule mutation'; end if;
  if has_function_privilege('authenticated', 'public.api_cancel_personal_work_schedule(uuid,uuid,bigint)', 'EXECUTE') then raise exception 'authenticated can execute schedule mutation'; end if;
end;
$function$;

-- PERSONAL WORK SCHEDULE: pending creator, approved admin, cancelled immutable, stale revision.
select public.api_create_personal_work_schedule('00000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '2026-10-01', '2026-10-01', 'work', '09:00', '17:00', 'pending edit changed', null, null, array['00000000-0000-0000-0000-000000000002']::uuid[], 1);
select public.api_cancel_personal_work_schedule('00000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 1);
select pg_temp.expect_error('approved schedule creator', $$select public.api_create_personal_work_schedule('00000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', '2026-10-01', '2026-10-01', 'work', '09:00', '17:00', 'blocked', null, null, array['00000000-0000-0000-0000-000000000002']::uuid[], 1)$$, array['42501']);
select pg_temp.expect_error('approved schedule non creator', $$select public.api_cancel_personal_work_schedule('00000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000004', 1)$$, array['42501']);
select public.api_create_personal_work_schedule('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005', '2026-10-01', '2026-10-01', 'work', '10:00', '18:00', 'admin edited', null, null, array['00000000-0000-0000-0000-000000000002']::uuid[], 1);
select public.api_cancel_personal_work_schedule('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000006', 1);
select pg_temp.expect_error('cancelled schedule immutable', $$select public.api_cancel_personal_work_schedule('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000007', 1)$$, array['42501']);
select pg_temp.expect_error('stale schedule revision', $$select public.api_cancel_personal_work_schedule('00000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000008', 99)$$, array['40001']);

-- LEAVE: requester pending, admin approved, cancelled immutable.
select public.api_edit_leave_request('00000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '2026-10-02', '2026-10-02', 'full', 'full', 'annual', 'requester edited');
select public.api_cancel_leave_request('00000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002');
select pg_temp.expect_error('approved leave requester', $$select public.api_edit_leave_request('00000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '2026-10-04', '2026-10-04', 'full', 'full', 'annual', 'blocked')$$, array['42501']);
select pg_temp.expect_error('approved leave non requester', $$select public.api_cancel_leave_request('00000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000004')$$, array['42501']);
select public.api_edit_leave_request('00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000005', '2026-10-06', '2026-10-06', 'full', 'full', 'business', 'admin edited');
select public.api_cancel_leave_request('00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000006');
select pg_temp.expect_error('cancelled leave immutable', $$select public.api_cancel_leave_request('00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007')$$, array['42501']);

do $function$
declare
  v_count integer;
begin
  if (select status from public.tasks where id='30000000-0000-0000-0000-000000000002') <> 'cancelled' then raise exception 'task creator cancel did not persist'; end if;
  if (select cancel_reason from public.tasks where id='30000000-0000-0000-0000-000000000002') <> 'creator cancellation' then raise exception 'task cancellation reason missing'; end if;
  if (select status from public.tasks where id='30000000-0000-0000-0000-000000000011') <> 'cancelled' then raise exception 'admin done cancel did not persist'; end if;
  if (select approval_status from public.work_schedules where id='40000000-0000-0000-0000-000000000002') <> 'CANCELLED' then raise exception 'schedule cancel did not persist'; end if;
  if (select workflow_revision from public.work_schedules where id='40000000-0000-0000-0000-000000000008') <> 1 then raise exception 'stale revision mutated schedule'; end if;
  if (select status from public.leave_requests where id='50000000-0000-0000-0000-000000000002') <> 'cancelled' then raise exception 'leave creator cancel did not persist'; end if;
  select count(*) into v_count from public.audit_logs where actor_id='00000000-0000-0000-0000-000000000002' and action in ('cancel','cancel_assigned_task','cancel_leave_request','cancel_personal_plan');
  if v_count < 2 then raise exception 'creator audit entries missing'; end if;
  if exists (select 1 from public.audit_logs where action like '%cancel%' and created_at is null) then raise exception 'audit timestamp missing'; end if;
end;
$function$;

rollback;

select 'GLOBAL_MUTATION_DB_MATRIX_PASS' as result;
