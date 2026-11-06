-- Separately approved rollback only. Stop dispatcher and restore the v1 app first.
-- Preserve queue, delivery history, subscriptions and added columns for recovery.
begin;
drop trigger if exists trg_capture_task_assignment_actor on public.task_assignees;
drop trigger if exists trg_enqueue_task_comment_notification on public.task_comments;
drop trigger if exists trg_enqueue_task_status_notification on public.task_status_events;
drop trigger if exists trg_enqueue_department_collaboration_notification on public.task_assignees;
create or replace function public.claim_push_notifications(p_kinds text[])
returns setof public.notifications
language sql security definer set search_path=public,pg_temp
as $function$
  update public.notifications n
  set push_attempts=n.push_attempts+1, push_claimed_at=now(), push_claim_token=gen_random_uuid()
  where n.id in (
    select pending.id from public.notifications pending
    where push_sent_at is null and push_attempts < 5 and created_at >= now() - interval '24 hours'
      and (push_claimed_at is null or push_claimed_at < now() - interval '5 minutes')
      and exists(select 1 from public.staff_users u where u.id=pending.recipient_id and u.active)
      and exists(select 1 from public.push_subscriptions s where s.user_id=pending.recipient_id and s.disabled_at is null and s.kind=any(p_kinds))
      -- Re-check assignment membership before putting task text on a device.
      and (pending.task_id is null or exists(select 1 from public.tasks t
        join public.task_assignees a on a.task_id=t.id
        where t.id=pending.task_id and t.status <> 'cancelled'
          and a.user_id=pending.recipient_id and a.assignment_role in ('owner','assignee')))
    order by created_at
    for update skip locked limit 50
  )
  returning n.*;
$function$;
revoke all on function public.claim_push_notifications(text[]) from public,anon,authenticated,service_role;
grant execute on function public.claim_push_notifications(text[]) to service_role;
alter function public.claim_push_notifications(text[]) owner to postgres;

create or replace function public.enqueue_task_assignment_notification()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $function$
declare t public.tasks; recipient uuid;
begin
  if new.assignment_role not in ('owner','assignee') then return new; end if;
  if TG_OP='UPDATE' and old.user_id=new.user_id and old.assignment_role=new.assignment_role then return new; end if;
  -- Notification work is best-effort and must not roll back the assignment.
  begin
    select * into t from public.tasks where id=new.task_id;
    recipient := new.user_id;
    if recipient is null or t.id is null or t.task_type is distinct from 'assigned' then return new; end if;
    -- created_by is the available assignment actor; no request/JWT is required.
    if recipient is distinct from t.created_by then
      insert into public.notifications(recipient_id,type,title,message,href,task_id,event_key)
      values(recipient,'assignment','Công việc mới được giao',coalesce(t.title,'Công việc'),'/tasks/'||t.id,t.id,'assignment:'||t.id||':'||recipient||':'||new.assigned_at||':'||new.assignment_role)
      on conflict (event_key) do nothing;
    end if;
  exception when others then
    raise warning 'Assignment notification enqueue failed (SQLSTATE %)', SQLSTATE;
  end;
  return new;
end
$function$;
drop trigger if exists trg_enqueue_task_assignment_notification on public.task_assignees;
create trigger trg_enqueue_task_assignment_notification
after insert or update of user_id,assignment_role on public.task_assignees for each row
execute function public.enqueue_task_assignment_notification();
revoke all on function public.enqueue_task_assignment_notification() from public,anon,authenticated,service_role;
alter function public.enqueue_task_assignment_notification() owner to postgres;

notify pgrst,'reload schema';
commit;
