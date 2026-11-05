begin;

create table if not exists public.notification_deliveries (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  delivered_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  primary key (notification_id,subscription_id)
);
alter table public.notification_deliveries owner to postgres;
alter table public.notification_deliveries enable row level security;
revoke all on table public.notification_deliveries from public,anon,authenticated;
grant select,insert,update,delete on table public.notification_deliveries to service_role;
alter table public.notifications add column if not exists actor_id uuid;
alter table public.notifications add column if not exists actor_name text;
alter table public.notifications add column if not exists source_event_id uuid;
alter table public.notifications add column if not exists subject_user_id uuid;
alter table public.task_assignees add column if not exists assigned_by uuid;
revoke all on table public.notifications,public.push_subscriptions from public,anon,authenticated;

create or replace function public.push_mutation_actor(p_fallback uuid)
returns uuid language plpgsql stable security definer set search_path=public,pg_temp
as $function$
declare actor uuid;
begin
  -- Only the server-role client may supply this request-scoped hint. RPCs still
  -- authorize their normal p_actor_id; this hint never grants business access.
  if (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role')='service_role' then
    actor := (nullif(current_setting('request.headers',true),'')::jsonb->>'x-thoidai-push-actor')::uuid;
  end if;
  return coalesce(actor,p_fallback);
exception when others then return p_fallback;
end $function$;
alter function public.push_mutation_actor(uuid) owner to postgres;
revoke all on function public.push_mutation_actor(uuid) from public,anon,authenticated,service_role;

create or replace function public.capture_task_assignment_actor()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  begin
    if TG_OP='INSERT' or old.user_id is distinct from new.user_id or old.assignment_role is distinct from new.assignment_role then
      new.assigned_by := public.push_mutation_actor(coalesce(new.assigned_by,
        (select coalesce(t.entered_by,t.created_by) from public.tasks t where t.id=new.task_id)));
    end if;
  exception when others then
    raise warning 'Assignment actor capture failed (SQLSTATE %)', SQLSTATE;
  end;
  return new;
end $function$;
alter function public.capture_task_assignment_actor() owner to postgres;
revoke all on function public.capture_task_assignment_actor() from public,anon,authenticated,service_role;
drop trigger if exists trg_capture_task_assignment_actor on public.task_assignees;
create trigger trg_capture_task_assignment_actor before insert or update of user_id,assignment_role on public.task_assignees
for each row execute function public.capture_task_assignment_actor();

create or replace function public.enqueue_task_assignment_notification()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $function$
declare t public.tasks; actor uuid;
begin
  if new.assignment_role not in ('owner','assignee') then return new; end if;
  if TG_OP='UPDATE' and old.user_id=new.user_id and old.assignment_role=new.assignment_role then return new; end if;
  begin
    select * into t from public.tasks where id=new.task_id;
    actor := coalesce(new.assigned_by,t.entered_by,t.created_by);
    if t.id is not null and t.task_type='assigned' and new.user_id is distinct from actor then
      insert into public.notifications(recipient_id,type,title,message,href,task_id,event_key,actor_id,actor_name)
      values(new.user_id,'assignment','Công việc mới được giao',t.title,'/tasks/'||t.id,t.id,
        'assignment:'||t.id||':'||new.user_id||':'||new.assigned_at||':'||new.assignment_role,
        actor,(select full_name from public.staff_users where id=actor))
      on conflict(event_key) do nothing;
    end if;
  exception when others then
    raise warning 'Assignment notification enqueue failed (SQLSTATE %)', SQLSTATE;
  end;
  return new;
end $function$;
alter function public.enqueue_task_assignment_notification() owner to postgres;
revoke all on function public.enqueue_task_assignment_notification() from public,anon,authenticated,service_role;

-- Exactly the bell's task set: direct roles plus task participants, not all
-- project members or all department leaders.
create or replace function public.push_task_recipients(p_task uuid)
returns setof uuid language sql stable security definer set search_path=public,pg_temp
as $function$
  select unnest(array[t.created_by,t.owner_id,t.assignee_id,t.reviewer_id]) from public.tasks t where t.id=p_task
  union select a.user_id from public.task_assignees a where a.task_id=p_task;
$function$;
alter function public.push_task_recipients(uuid) owner to postgres;
revoke all on function public.push_task_recipients(uuid) from public,anon,authenticated,service_role;

create or replace function public.enqueue_task_comment_notification()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $function$
declare t public.tasks; author text; recipient uuid;
begin
  begin
    select * into t from public.tasks where id=new.task_id;
    author := coalesce((select full_name from public.staff_users where id=new.user_id),'Một thành viên');
    for recipient in select r from public.push_task_recipients(new.task_id) r
      where r is not null and r is distinct from new.user_id loop
      begin
        insert into public.notifications(recipient_id,type,title,message,href,task_id,event_key,actor_id,actor_name,source_event_id)
        values(recipient,'comment',author||' đã bình luận',t.title||' · '||left(btrim(regexp_replace(new.content,'[[:space:]]+',' ','g')),140),
          '/tasks/'||t.id,t.id,'comment:'||new.id||':'||recipient,new.user_id,author,new.id)
        on conflict(event_key) do nothing;
      exception when others then raise warning 'Comment notification enqueue failed (SQLSTATE %)', SQLSTATE;
      end;
    end loop;
  exception when others then raise warning 'Comment notification lookup failed (SQLSTATE %)', SQLSTATE;
  end;
  return new;
end $function$;
alter function public.enqueue_task_comment_notification() owner to postgres;
revoke all on function public.enqueue_task_comment_notification() from public,anon,authenticated,service_role;
drop trigger if exists trg_enqueue_task_comment_notification on public.task_comments;
create trigger trg_enqueue_task_comment_notification after insert on public.task_comments
for each row execute function public.enqueue_task_comment_notification();

create or replace function public.enqueue_task_status_notification()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $function$
declare t public.tasks; actor text; recipient uuid; label text;
begin
  begin
    select * into t from public.tasks where id=new.task_id;
    select full_name into actor from public.staff_users where id=new.actor_id;
    label := case when t.project_id is not null and new.to_status='pending_review' then 'Chờ duyệt'
      else case new.to_status when 'new' then 'Mới' when 'in_progress' then 'Đang làm'
        when 'blocked' then 'Có vướng mắc' when 'waiting' then 'Chờ duyệt nhận việc'
        when 'pending_review' then 'Chờ chấm điểm' when 'rejected' then 'Trả lại'
        when 'done' then 'Hoàn thành' when 'cancelled' then 'Đã hủy' else new.to_status end end;
    for recipient in select r from public.push_task_recipients(new.task_id) r
      where r is not null and r is distinct from new.actor_id loop
      begin
        insert into public.notifications(recipient_id,type,title,message,href,task_id,event_key,actor_id,actor_name,source_event_id)
        values(recipient,'status','Trạng thái công việc thay đổi',t.title||' → '||label||case when coalesce(new.reason,'')<>'' then ' · '||new.reason else '' end,
          '/tasks/'||t.id,t.id,'status:'||new.id||':'||recipient,new.actor_id,actor,new.id)
        on conflict(event_key) do nothing;
      exception when others then raise warning 'Status notification enqueue failed (SQLSTATE %)', SQLSTATE;
      end;
    end loop;
  exception when others then raise warning 'Status notification lookup failed (SQLSTATE %)', SQLSTATE;
  end;
  return new;
end $function$;
alter function public.enqueue_task_status_notification() owner to postgres;
revoke all on function public.enqueue_task_status_notification() from public,anon,authenticated,service_role;
drop trigger if exists trg_enqueue_task_status_notification on public.task_status_events;
create trigger trg_enqueue_task_status_notification after insert on public.task_status_events
for each row execute function public.enqueue_task_status_notification();

create or replace function public.enqueue_department_collaboration_notification()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $function$
declare t public.tasks; manager uuid; employee text; actor uuid;
begin
  if new.assignment_role<>'assignee' then return new; end if;
  if TG_OP='UPDATE' and old.user_id=new.user_id and old.assignment_role=new.assignment_role then return new; end if;
  begin
    select * into t from public.tasks where id=new.task_id;
    actor := coalesce(new.assigned_by,t.entered_by,t.created_by);
    select d.manager_id,u.full_name into manager,employee
      from public.staff_users u join public.departments d on d.id=u.department_id
      where u.id=new.user_id and u.active and d.active;
    if manager is not null and manager<>new.user_id and manager is distinct from actor
      and manager is distinct from t.owner_id and manager is distinct from t.assignee_id and manager is distinct from t.created_by
      and exists(select 1 from public.task_assignees a where a.task_id=t.id and a.user_id=manager and a.assignment_role='watcher')
      and exists(select 1 from public.task_assignees a where a.task_id=t.id and a.user_id=new.user_id and a.assignment_role='assignee') then
      insert into public.notifications(recipient_id,type,title,message,href,task_id,event_key,actor_id,actor_name,subject_user_id)
      values(manager,'department_collaboration','Nhân viên được thêm phối hợp',
        'Nhân viên '||coalesce(employee,'của bạn')||' của phòng bạn được thêm phối hợp vào việc “'||t.title||'”',
        '/tasks/'||t.id,t.id,'department-collaboration:'||t.id||':'||new.user_id||':'||manager||':'||new.assigned_at,
        actor,(select full_name from public.staff_users where id=actor),new.user_id)
      on conflict(event_key) do nothing;
    end if;
  exception when others then raise warning 'Collaboration notification enqueue failed (SQLSTATE %)', SQLSTATE;
  end;
  return new;
end $function$;
alter function public.enqueue_department_collaboration_notification() owner to postgres;
revoke all on function public.enqueue_department_collaboration_notification() from public,anon,authenticated,service_role;
drop trigger if exists trg_enqueue_department_collaboration_notification on public.task_assignees;
-- Run after the existing deferred manager-watcher trigger and final participant edits.
create constraint trigger trg_enqueue_department_collaboration_notification
after insert or update on public.task_assignees deferrable initially deferred
for each row execute function public.enqueue_department_collaboration_notification();

create or replace function public.push_notification_visible(p_notification public.notifications)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $function$
  select p_notification.recipient_id is distinct from p_notification.actor_id and
    (p_notification.task_id is null or exists (
      select 1 from public.tasks t where t.id=p_notification.task_id and case p_notification.type
      when 'assignment' then t.status<>'cancelled' and exists(select 1 from public.task_assignees a
        where a.task_id=t.id and a.user_id=p_notification.recipient_id and a.assignment_role in ('owner','assignee'))
      when 'comment' then p_notification.recipient_id in (select public.push_task_recipients(t.id))
        and exists(select 1 from public.task_comments c where c.id=p_notification.source_event_id and c.task_id=t.id)
      when 'status' then p_notification.recipient_id in (select public.push_task_recipients(t.id))
        and exists(select 1 from public.task_status_events e where e.id=p_notification.source_event_id and e.task_id=t.id)
      when 'department_collaboration' then
        p_notification.recipient_id is distinct from t.created_by and p_notification.recipient_id is distinct from t.owner_id
        and p_notification.recipient_id is distinct from t.assignee_id
        and exists(select 1 from public.task_assignees a where a.task_id=t.id and a.user_id=p_notification.recipient_id and a.assignment_role='watcher')
        and exists(select 1 from public.task_assignees a join public.staff_users u on u.id=a.user_id
          join public.departments d on d.id=u.department_id where a.task_id=t.id and a.assignment_role='assignee'
          and a.user_id=p_notification.subject_user_id and d.manager_id=p_notification.recipient_id and d.active and u.active)
      else false end
    ));
$function$;
alter function public.push_notification_visible(public.notifications) owner to postgres;
revoke all on function public.push_notification_visible(public.notifications) from public,anon,authenticated,service_role;

create or replace function public.claim_push_notifications(p_kinds text[])
returns setof public.notifications language sql security definer set search_path=public,pg_temp
as $function$
  update public.notifications n
  set push_attempts=n.push_attempts+1,push_claimed_at=now(),push_claim_token=gen_random_uuid()
  where n.id in (
    select pending.id from public.notifications pending
    -- Retry limits belong to each device. A row-level limit could strand a
    -- newly configured device or a fifth successful send whose completion failed.
    where pending.push_sent_at is null and pending.created_at>=now()-interval '24 hours'
      and (pending.push_claimed_at is null or pending.push_claimed_at<now()-interval '5 minutes')
      and exists(select 1 from public.staff_users u where u.id=pending.recipient_id and u.active)
      and exists(select 1 from public.push_subscriptions s where s.user_id=pending.recipient_id and s.disabled_at is null and s.kind=any(p_kinds))
      -- Missing provider configuration must not exhaust retries for devices
      -- already delivered through another provider.
      and (exists(select 1 from public.push_subscriptions s
        left join public.notification_deliveries d on d.notification_id=pending.id and d.subscription_id=s.id
        where s.user_id=pending.recipient_id and s.disabled_at is null and s.kind=any(p_kinds)
          and d.delivered_at is null and coalesce(d.last_error_code,'') not in ('GONE','UNREGISTERED','RETRY_EXHAUSTED'))
        or not exists(select 1 from public.push_subscriptions s
          left join public.notification_deliveries d on d.notification_id=pending.id and d.subscription_id=s.id
          where s.user_id=pending.recipient_id and s.disabled_at is null and d.delivered_at is null
            and coalesce(d.last_error_code,'') not in ('GONE','UNREGISTERED','RETRY_EXHAUSTED')))
      and public.push_notification_visible(pending)
    order by pending.created_at for update skip locked limit 50
  ) returning n.*;
$function$;
alter function public.claim_push_notifications(text[]) owner to postgres;
revoke all on function public.claim_push_notifications(text[]) from public,anon,authenticated,service_role;
grant execute on function public.claim_push_notifications(text[]) to service_role;

notify pgrst,'reload schema';
commit;
