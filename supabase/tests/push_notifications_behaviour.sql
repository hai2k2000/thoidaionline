begin;
-- Disposable restore only; all test writes are rolled back.
create temporary table push_assignment_fixture (
  task_id uuid, user_id uuid, assignment_role text, assigned_at timestamptz default now()
) on commit drop;
create trigger fixture_enqueue after insert or update on push_assignment_fixture
for each row execute function public.enqueue_task_assignment_notification();
do $test$
declare u uuid; u2 uuid; task uuid; n uuid; sub uuid; claimed integer; i integer; before_count integer;
begin
  if has_table_privilege('anon','public.notifications','select')
     or has_table_privilege('authenticated','public.push_subscriptions','insert')
     or has_function_privilege('anon','public.claim_push_notifications(text[])','execute')
     or has_function_privilege('authenticated','public.claim_push_notifications(text[])','execute') then
    raise exception 'push lockdown failed';
  end if;
  select id into u from public.staff_users where active limit 1;
  if u is null then raise exception 'restored active staff fixture required'; end if;
  select id into u2 from public.staff_users where active and id<>u limit 1;
  select id into task from public.tasks where task_type='assigned' limit 1;
  if task is null or u2 is null then raise exception 'restored assigned task and two active staff fixtures required'; end if;
  select count(*) into before_count from public.notifications;
  insert into push_assignment_fixture(task_id,user_id,assignment_role) values(task,u,'owner'),(task,u2,'assignee'),(task,u2,'watcher');
  if (select count(*) from public.notifications)<>before_count+2 then raise exception 'assignee/collaborator notification creation failed'; end if;
  insert into push_assignment_fixture(task_id,user_id,assignment_role) values(task,u,'owner');
  if (select count(*) from public.notifications)<>before_count+2 then raise exception 'assignment event duplicate was not suppressed'; end if;
  update public.notifications set push_sent_at=now() where push_sent_at is null;
  insert into public.push_subscriptions(user_id,kind,endpoint,platform)
  values(u,'fcm','disposable-push-test-'||gen_random_uuid(),'android') returning id into sub;
  insert into public.notifications(recipient_id,type,title,message,href,event_key)
  values(u,'test','Test','Test','/my-tasks','disposable:'||gen_random_uuid()) returning id into n;
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
  update public.push_subscriptions set disabled_at=now() where user_id=u;
  select count(*) into claimed from public.claim_push_notifications(array['fcm']);
  if claimed<>0 then raise exception 'disabled subscriptions claimed'; end if;
  if not exists(select 1 from pg_trigger where tgname='trg_enqueue_task_assignment_notification' and not tgisinternal) then raise exception 'assignment trigger missing'; end if;
end $test$;
rollback;
