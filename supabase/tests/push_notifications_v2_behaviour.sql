\set ON_ERROR_STOP on
begin;
-- Disposable restored data only. Every fixture, injection and claim rolls back.
create function pg_temp.fail_push_v2() returns trigger language plpgsql as $$
begin
  if current_setting('push_v2_test.fail',true)='on' then raise exception 'injected push failure' using errcode='23514'; end if;
  return new;
end $$;
create trigger push_v2_test_failure before insert on public.notifications
for each row execute function pg_temp.fail_push_v2();

do $test$
declare
  role_id uuid; manager_job uuid; dept uuid; manager uuid; actor uuid; owner_user uuid; collaborator uuid; watcher uuid;
  task uuid; project uuid; comment_id uuid; status_id uuid; test_notification uuid; sub uuid;
  n integer; expected integer; event_id uuid; status text; assigned_time timestamptz;
  suffix text:=replace(gen_random_uuid()::text,'-','');
begin
  if exists(select 1 from unnest(array['anon','authenticated']) r
    where has_table_privilege(r,'public.notification_deliveries','select,insert,update,delete')
      or has_function_privilege(r,'public.claim_push_notifications(text[])','execute')) then raise exception 'v2 lockdown failed'; end if;
  select id into role_id from public.roles where code='nhan_vien' and active;
  select id into manager_job from public.job_titles where code='truong_phong' and active;
  if role_id is null or manager_job is null then raise exception 'restored role/job fixtures required'; end if;
  insert into public.departments(code,name,active) values('zz_push_v2_'||suffix,'Push v2 fixture',true) returning id into dept;
  -- departments.manager_id is owned by the staff job-title sync trigger.
  insert into public.staff_users(full_name,username,password,role_id,department_id,job_title_id,active)
  values('Manager','zz_v2_mgr_'||suffix,'test-only',role_id,dept,manager_job,true) returning id into manager;
  insert into public.staff_users(full_name,username,password,role_id,department_id,active)
  values('Actor','zz_v2_actor_'||suffix,'test-only',role_id,dept,true) returning id into actor;
  insert into public.staff_users(full_name,username,password,role_id,department_id,active)
  values('Owner','zz_v2_owner_'||suffix,'test-only',role_id,dept,true) returning id into owner_user;
  insert into public.staff_users(full_name,username,password,role_id,department_id,active)
  values('Collaborator','zz_v2_collab_'||suffix,'test-only',role_id,dept,true) returning id into collaborator;
  insert into public.staff_users(full_name,username,password,role_id,department_id,active)
  values('Watcher','zz_v2_watch_'||suffix,'test-only',role_id,dept,true) returning id into watcher;
  if (select manager_id from public.departments where id=dept) is distinct from manager then raise exception 'manager fixture sync failed'; end if;
  insert into public.tasks(title,created_by,department_id,task_type,task_category,plan_period,status)
  values('Push v2 task',actor,dept,'assigned','regular','ad_hoc','new') returning id into task;
  insert into public.task_assignees(task_id,user_id,assignment_role) values(task,owner_user,'owner'),(task,watcher,'watcher');
  insert into public.task_assignees(task_id,user_id,assignment_role) values(task,collaborator,'assignee');
  set constraints all immediate;
  if (select count(*) from public.notifications where task_id=task and type='assignment')<>2 then raise exception 'assignment recipients failed'; end if;
  if (select count(*) from public.notifications where task_id=task and type='department_collaboration' and recipient_id=manager)<>1 then raise exception 'manager collaboration failed'; end if;
  if exists(select 1 from public.notifications where task_id=task and recipient_id=actor) then raise exception 'assignment actor notified'; end if;

  select assigned_at into assigned_time from public.task_assignees where task_id=task and user_id=collaborator;
  select count(*) into n from public.notifications where task_id=task;
  delete from public.task_assignees where task_id=task and user_id=collaborator;
  insert into public.task_assignees(task_id,user_id,assignment_role,assigned_at) values(task,collaborator,'assignee',assigned_time);
  if (select count(*) from public.notifications where task_id=task)<>n then raise exception 'assignment/collaboration event-key dedupe failed'; end if;

  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform set_config('request.headers',jsonb_build_object('x-thoidai-push-actor',manager)::text,true);
  select count(*) into n from public.notifications where task_id=task and type='department_collaboration' and recipient_id=manager;
  insert into public.task_assignees(task_id,user_id,assignment_role) values(task,actor,'assignee');
  if (select count(*) from public.notifications where task_id=task and type='department_collaboration' and recipient_id=manager)<>n then raise exception 'collaboration actor notified'; end if;
  delete from public.task_assignees where task_id=task and user_id=actor;
  perform set_config('request.headers','{}',true);

  -- The server-validated actor can differ from the original task creator.
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform set_config('request.headers',jsonb_build_object('x-thoidai-push-actor',watcher)::text,true);
  update public.task_assignees set assignment_role='assignee' where task_id=task and user_id=watcher;
  if exists(select 1 from public.notifications where task_id=task and type='assignment' and recipient_id=watcher) then raise exception 'current assignment actor notified'; end if;
  if (select assigned_by from public.task_assignees where task_id=task and user_id=watcher) is distinct from watcher then raise exception 'actor capture failed'; end if;
  perform set_config('request.headers','{}',true);

  insert into public.task_comments(task_id,user_id,content) values(task,collaborator,E'  hello\n  world  ') returning id into comment_id;
  select count(distinct r) into expected from public.push_task_recipients(task) r where r is not null and r<>collaborator;
  select count(*) into n from public.notifications where source_event_id=comment_id and type='comment';
  if n<>expected or exists(select 1 from public.notifications where source_event_id=comment_id and recipient_id=collaborator) then raise exception 'comment recipients/actor failed'; end if;
  if exists(select 1 from public.notifications where source_event_id=comment_id and (title<>'Collaborator đã bình luận' or message<>'Push v2 task · hello world' or href<>'/tasks/'||task)) then raise exception 'comment content differs from bell'; end if;
  -- Replaying the same event identity cannot enqueue twice.
  delete from public.task_comments where id=comment_id;
  insert into public.task_comments(id,task_id,user_id,content) values(comment_id,task,collaborator,'hello world');
  if (select count(*) from public.notifications where source_event_id=comment_id)<>expected then raise exception 'comment dedupe failed'; end if;

  foreach status in array array['waiting','in_progress','pending_review','rejected','done'] loop
    insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
    values(task,'new',status,'Review note',owner_user) returning id into status_id;
    select count(distinct r) into expected from public.push_task_recipients(task) r where r is not null and r<>owner_user;
    if (select count(*) from public.notifications where source_event_id=status_id and type='status')<>expected
      or exists(select 1 from public.notifications where source_event_id=status_id and recipient_id=owner_user) then raise exception 'status recipients failed: %',status; end if;
    delete from public.task_status_events where id=status_id;
    insert into public.task_status_events(id,task_id,from_status,to_status,reason,actor_id) values(status_id,task,'new',status,'Review note',owner_user);
    if (select count(*) from public.notifications where source_event_id=status_id)<>expected then raise exception 'status dedupe failed'; end if;
  end loop;
  select count(*) into n from public.notifications where task_id=task;
  update public.task_assignees set assignment_role='assignee' where task_id=task and user_id=collaborator;
  if (select count(*) from public.notifications where task_id=task)<>n then raise exception 'unchanged participant duplicate'; end if;

  -- Real project task wording uses Cho duyet rather than scoring language.
  insert into public.projects(code,name,host_department_id,created_by) values('ZZV2_'||suffix,'Push project',dept,actor) returning id into project;
  update public.tasks set project_id=project where id=task;
  insert into public.task_status_events(task_id,from_status,to_status,actor_id) values(task,'in_progress','pending_review',owner_user) returning id into status_id;
  if exists(select 1 from public.notifications where source_event_id=status_id and message<>'Push v2 task → Chờ duyệt') then raise exception 'project review label failed'; end if;

  -- Every new trigger must fail open without losing a business row.
  perform set_config('push_v2_test.fail','on',true);
  insert into public.task_comments(task_id,user_id,content) values(task,actor,'forced failure') returning id into event_id;
  if not exists(select 1 from public.task_comments where id=event_id) or exists(select 1 from public.notifications where source_event_id=event_id) then raise exception 'comment failure isolation failed'; end if;
  insert into public.task_status_events(task_id,from_status,to_status,actor_id) values(task,'new','done',actor) returning id into event_id;
  if not exists(select 1 from public.task_status_events where id=event_id) or exists(select 1 from public.notifications where source_event_id=event_id) then raise exception 'status failure isolation failed'; end if;
  delete from public.task_assignees where task_id=task and user_id=collaborator;
  select count(*) into n from public.notifications where task_id=task;
  insert into public.task_assignees(task_id,user_id,assignment_role,assigned_at) values(task,collaborator,'assignee',clock_timestamp());
  set constraints all immediate;
  if not exists(select 1 from public.task_assignees where task_id=task and user_id=collaborator)
    or (select count(*) from public.notifications where task_id=task)<>n then raise exception 'assignment/collaboration failure isolation failed'; end if;
  perform set_config('push_v2_test.fail','off',true);

  -- Isolate the restored queue, then prove claim-time visibility and delivery PK.
  update public.notifications set push_sent_at=now() where push_sent_at is null;
  insert into public.push_subscriptions(user_id,kind,endpoint,platform) values(watcher,'fcm','disposable-v2-'||suffix,'android') returning id into sub;
  select id into test_notification from public.notifications where source_event_id=comment_id and recipient_id=watcher;
  update public.notifications set push_sent_at=null,push_attempts=0,push_claimed_at=null where id=test_notification;
  if (select count(*) from public.claim_push_notifications(array['fcm']))<>1 then raise exception 'participant comment claim failed'; end if;
  if (select count(*) from public.claim_push_notifications(array['fcm']))<>0 then raise exception 'live lease reclaimed'; end if;
  insert into public.notification_deliveries(notification_id,subscription_id,delivered_at,attempts) values(test_notification,sub,now(),1);
  insert into public.notification_deliveries(notification_id,subscription_id,attempts) values(test_notification,sub,0) on conflict do nothing;
  if (select count(*) from public.notification_deliveries where notification_id=test_notification)<>1 then raise exception 'delivery dedupe failed'; end if;
  -- A failed final completion write must remain reclaimable after five claims.
  update public.notifications set push_claimed_at=null,push_attempts=5 where id=test_notification;
  if (select count(*) from public.claim_push_notifications(array['fcm']))<>1 then raise exception 'delivered row completion recovery failed'; end if;
  delete from public.task_assignees where task_id=task and user_id=watcher;
  update public.notifications set push_claimed_at=null where id=test_notification;
  if (select count(*) from public.claim_push_notifications(array['fcm']))<>0 then raise exception 'removed participant claim leaked task'; end if;
  update public.notifications set push_sent_at=null,push_attempts=0,push_claimed_at=null
    where source_event_id=status_id and recipient_id=watcher;
  if (select count(*) from public.claim_push_notifications(array['fcm']))<>0 then raise exception 'removed status recipient claim leaked task'; end if;
  insert into public.push_subscriptions(user_id,kind,endpoint,platform) values(manager,'fcm','disposable-manager-v2-'||suffix,'android');
  update public.notifications set push_sent_at=null,push_attempts=0,push_claimed_at=null
    where task_id=task and type='department_collaboration' and subject_user_id=collaborator;
  delete from public.task_assignees where task_id=task and user_id=collaborator;
  if (select count(*) from public.claim_push_notifications(array['fcm']))<>0 then raise exception 'removed collaboration claim leaked task'; end if;
end $test$;
set constraints all immediate;
rollback;
