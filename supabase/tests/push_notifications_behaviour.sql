\set ON_ERROR_STOP on
begin;
-- Disposable restore only. Fixtures, queue isolation and failure injection roll back.
create function pg_temp.fail_push_notification() returns trigger language plpgsql as $$
begin
  if current_setting('push_test.force_failure',true)='on' then
    raise exception 'forced notification failure' using errcode='23514';
  end if;
  return new;
end $$;
create trigger push_test_force_failure before insert on public.notifications
for each row execute function pg_temp.fail_push_notification();

do $test$
declare
  actor uuid; u uuid; u2 uuid; dept uuid; employee_role uuid; manager_job uuid;
  task uuid; failed_task uuid; n uuid; sub uuid; claimed integer; i integer;
  suffix text:=replace(gen_random_uuid()::text,'-','');
begin
  if has_table_privilege('anon','public.notifications','select')
     or has_table_privilege('authenticated','public.push_subscriptions','insert')
     or has_function_privilege('anon','public.claim_push_notifications(text[])','execute')
     or has_function_privilege('authenticated','public.claim_push_notifications(text[])','execute') then
    raise exception 'push lockdown failed';
  end if;
  select id into employee_role from public.roles where code='nhan_vien' and active;
  select id into manager_job from public.job_titles where code='truong_phong' and active;
  if employee_role is null or manager_job is null then raise exception 'employee role and manager job fixtures required'; end if;
  insert into public.departments(code,name,active)
  values('zz_push_'||suffix,'Push fixture',true) returning id into dept;
  -- The staff trigger derives manager_id from this job title. Never set it directly.
  insert into public.staff_users(full_name,username,password,role_id,department_id,job_title_id,active)
  values('Push manager','zz_push_mgr_'||suffix,'test-only',employee_role,dept,manager_job,true) returning id into actor;
  insert into public.staff_users(full_name,username,password,role_id,department_id,active)
  values('Push owner','zz_push_owner_'||suffix,'test-only',employee_role,dept,true) returning id into u;
  insert into public.staff_users(full_name,username,password,role_id,department_id,active)
  values('Push collaborator','zz_push_ctv_'||suffix,'test-only',employee_role,dept,true) returning id into u2;
  if not exists(select 1 from public.departments d where d.id=dept and d.manager_id=actor) then
    raise exception 'job title manager sync failed';
  end if;
  insert into public.tasks(title,created_by,department_id,task_type,task_category,plan_period,status)
  values('Push fixture',actor,dept,'assigned','regular','ad_hoc','new') returning id into task;
  set constraints all immediate;
  insert into public.task_assignees(task_id,user_id,assignment_role) values(task,u,'owner');
  if (select count(*) from public.notifications where task_id=task)<>1 then raise exception 'normal assignment must enqueue exactly one row'; end if;
  insert into public.task_assignees(task_id,user_id,assignment_role) values(task,u2,'assignee');
  if (select count(*) from public.notifications where task_id=task)<>2 then raise exception 'collaborator notification creation failed'; end if;
  update public.task_assignees set assignment_role='owner' where task_id=task and user_id=u;
  if (select count(*) from public.notifications where task_id=task)<>2 then raise exception 'unchanged assignment duplicate was not suppressed'; end if;
  -- The manager may already be a watcher, so exercise the UPDATE self-assignment path.
  insert into public.task_assignees(task_id,user_id,assignment_role) values(task,actor,'assignee')
  on conflict(task_id,user_id) do update set assignment_role=excluded.assignment_role;
  if exists(select 1 from public.notifications where task_id=task and recipient_id=actor) then raise exception 'self assignment notified actor'; end if;

  insert into public.tasks(title,created_by,department_id,task_type,task_category,plan_period,status)
  values('Failed push fixture',actor,dept,'assigned','regular','ad_hoc','new') returning id into failed_task;
  perform set_config('push_test.force_failure','on',true);
  insert into public.task_assignees(task_id,user_id,assignment_role) values(failed_task,u,'assignee');
  if not exists(select 1 from public.task_assignees where task_id=failed_task and user_id=u) then
    raise exception 'notification failure rolled back assignment insert';
  end if;
  update public.task_assignees set assignment_role='owner' where task_id=failed_task and user_id=u;
  if not exists(select 1 from public.task_assignees where task_id=failed_task and user_id=u and assignment_role='owner') then
    raise exception 'notification failure rolled back assignment update';
  end if;
  if exists(select 1 from public.notifications where task_id=failed_task) then raise exception 'forced failure enqueued a notification'; end if;
  perform set_config('push_test.force_failure','off',true);

  -- Prevent restored pending rows from affecting claim counts; rollback restores them.
  update public.notifications set push_sent_at=now() where push_sent_at is null;
  insert into public.push_subscriptions(user_id,kind,endpoint,platform)
  values(u,'fcm','disposable-push-test-'||suffix,'android') returning id into sub;
  insert into public.notifications(recipient_id,type,title,message,href,event_key)
  values(u,'test','Test','Test','/my-tasks','disposable:'||suffix) returning id into n;
  for i in 1..5 loop
    select count(*) into claimed from public.claim_push_notifications(array['fcm']);
    if claimed<>1 then raise exception 'claim attempt % failed',i; end if;
    if (select push_attempts from public.notifications where id=n)<>i then raise exception 'attempt counter failed'; end if;
    select count(*) into claimed from public.claim_push_notifications(array['fcm']);
    if claimed<>0 then raise exception 'live lease was reclaimed'; end if;
    update public.notifications set push_claimed_at=now()-interval '6 minutes' where id=n;
  end loop;
  select count(*) into claimed from public.claim_push_notifications(array['fcm']);
  if claimed<>0 then raise exception 'attempt limit failed'; end if;
  update public.notifications set push_attempts=0,created_at=now()-interval '25 hours' where id=n;
  select count(*) into claimed from public.claim_push_notifications(array['fcm']);
  if claimed<>0 then raise exception '24-hour cutoff failed'; end if;
  update public.notifications set created_at=now() where id=n;
  update public.push_subscriptions set disabled_at=now() where id=sub;
  select count(*) into claimed from public.claim_push_notifications(array['fcm']);
  if claimed<>0 then raise exception 'disabled subscriptions claimed'; end if;
end $test$;
-- Force any remaining deferred checks before the outer fixture rollback.
set constraints all immediate;
rollback;
