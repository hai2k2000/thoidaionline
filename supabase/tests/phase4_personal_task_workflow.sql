\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_actor uuid;
  v_other uuid;
  v_task uuid;
  v_cancel uuid;
  v_old_due date;
begin
  select id into v_actor from public.staff_users where active=true order by created_at,id limit 1;
  select id into v_other from public.staff_users where active=true and id<>v_actor order by created_at,id limit 1;
  if v_actor is null or v_other is null then raise exception 'phase4 test actors unavailable'; end if;

  select id into v_task from public.api_create_personal_task(
    v_actor,'Phase 4 personal test','Nội dung kiểm thử',
    date '2026-08-17',date '2026-08-20','Tiêu chí kiểm thử'
  );
  if not exists (
    select 1 from public.tasks
    where id=v_task and task_type='personal' and owner_id=v_actor
      and assignee_id=v_actor and created_by=v_actor and status='new'
      and start_date=date '2026-08-17' and due_date=date '2026-08-20'
  ) then raise exception 'personal create invariant'; end if;
  if not exists (
    select 1 from public.task_assignees
    where task_id=v_task and user_id=v_actor and assignment_role='owner'
  ) then raise exception 'personal owner invariant'; end if;

  perform public.api_edit_personal_task(
    v_actor,v_task,'Phase 4 personal edited','Nội dung đã sửa',
    date '2026-08-18','Tiêu chí đã sửa'
  );
  if not exists (select 1 from public.tasks where id=v_task and title='Phase 4 personal edited' and start_date=date '2026-08-18') then
    raise exception 'personal edit invariant';
  end if;

  select due_date into v_old_due from public.tasks where id=v_task;
  perform public.api_change_personal_task_deadline(
    v_actor,v_task,date '2026-08-22','Điều chỉnh kế hoạch cá nhân'
  );
  if not exists (
    select 1 from public.task_deadline_history
    where task_id=v_task and old_due_date=v_old_due and new_due_date=date '2026-08-22'
      and changed_by=v_actor and reason='Điều chỉnh kế hoạch cá nhân'
  ) then raise exception 'deadline history invariant'; end if;

  begin
    perform public.api_edit_personal_task(
      v_other,v_task,'Forbidden','Forbidden',date '2026-08-18',null
    );
    raise exception 'unrelated actor unexpectedly edited personal task';
  exception when insufficient_privilege then null;
  end;

  perform public.api_complete_personal_task(v_actor,v_task);
  if not exists (
    select 1 from public.tasks
    where id=v_task and status='done' and completed_at is not null
      and completion_submitted_at=completed_at
  ) then raise exception 'personal completion invariant'; end if;
  if not exists (
    select 1 from public.task_status_events
    where task_id=v_task and from_status='new' and to_status='done' and actor_id=v_actor
  ) then raise exception 'completion event invariant'; end if;

  select id into v_cancel from public.api_create_personal_task(
    v_actor,'Phase 4 cancel test','Nội dung kiểm thử',
    date '2026-08-17',date '2026-08-20',null
  );
  perform public.api_cancel_personal_task(v_actor,v_cancel,'Không còn cần thiết');
  if not exists (
    select 1 from public.tasks
    where id=v_cancel and status='cancelled' and cancelled_by=v_actor
      and cancelled_at is not null and cancel_reason='Không còn cần thiết'
  ) then raise exception 'personal cancel invariant'; end if;

  if (select count(*) from public.audit_logs where entity_id in (v_task,v_cancel) and actor_id=v_actor) < 6 then
    raise exception 'personal audit invariant';
  end if;
end
$test$;

do $test$
begin
  if has_function_privilege('anon','public.api_create_personal_task(uuid,text,text,date,date,text)','EXECUTE')
     or has_function_privilege('authenticated','public.api_create_personal_task(uuid,text,text,date,date,text)','EXECUTE')
     or has_function_privilege('anon','public.api_edit_personal_task(uuid,uuid,text,text,date,text)','EXECUTE')
     or has_function_privilege('anon','public.api_change_personal_task_deadline(uuid,uuid,date,text)','EXECUTE')
     or has_function_privilege('anon','public.api_cancel_personal_task(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.api_complete_personal_task(uuid,uuid)','EXECUTE') then
    raise exception 'personal RPC exposed to browser roles';
  end if;
  if not has_function_privilege('service_role','public.api_create_personal_task(uuid,text,text,date,date,text)','EXECUTE') then
    raise exception 'service role missing personal create';
  end if;
end
$test$;

rollback;