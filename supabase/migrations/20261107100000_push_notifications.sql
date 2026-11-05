begin;

-- Durable notification queue and per-device delivery state. All access remains
-- server-role only; authenticated clients use the API routes below.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_users(id) on delete cascade,
  kind text not null check (kind in ('webpush','fcm')),
  endpoint text not null,
  p256dh text,
  auth text,
  platform text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  failed_count integer not null default 0 check (failed_count >= 0),
  disabled_at timestamptz,
  constraint push_subscriptions_key_shape check (
    (kind = 'webpush' and p256dh is not null and auth is not null)
    or (kind = 'fcm' and p256dh is null and auth is null)
  )
);
create unique index if not exists push_subscriptions_endpoint_uq on public.push_subscriptions(kind, endpoint);
create index if not exists push_subscriptions_user_active_idx on public.push_subscriptions(user_id) where disabled_at is null;
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on table public.push_subscriptions to service_role;

-- The legacy APK table is retained for compatibility, but future writes use the
-- unified table. Replaying this insert is safe because the endpoint is unique.
do $legacy$
begin
  if to_regclass('public.mobile_push_tokens') is not null then
    insert into public.push_subscriptions(user_id,kind,endpoint,platform,created_at,last_seen_at)
    select user_id,'fcm',fcm_token,platform,coalesce(created_at,now()),coalesce(updated_at,now())
    from public.mobile_push_tokens
    on conflict (kind,endpoint) do nothing;
    alter table public.mobile_push_tokens enable row level security;
    revoke all on table public.mobile_push_tokens from public,anon,authenticated;
  end if;
end $legacy$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.staff_users(id) on delete cascade,
  type text not null,
  title text not null,
  event_key text not null unique,
  task_id uuid references public.tasks(id) on delete cascade,
  message text not null,
  href text not null default '/my-tasks',
  created_at timestamptz not null default now(),
  push_sent_at timestamptz,
  push_attempts integer not null default 0 check (push_attempts >= 0),
  push_claimed_at timestamptz,
  push_claim_token uuid
);
alter table public.notifications add column if not exists push_sent_at timestamptz;
alter table public.notifications add column if not exists push_attempts integer not null default 0;
alter table public.notifications add column if not exists push_claimed_at timestamptz;
alter table public.notifications add column if not exists push_claim_token uuid;

create index if not exists notifications_unsent_idx
  on public.notifications(created_at, push_attempts) where push_sent_at is null;
alter table public.notifications enable row level security;
revoke all on table public.notifications from public,anon,authenticated;
grant select,insert,update on table public.notifications to service_role;

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
  select * into t from public.tasks where id=new.task_id;
  recipient := new.user_id;
  if recipient is null or t.id is null or t.task_type is distinct from 'assigned' then return new; end if;
  insert into public.notifications(recipient_id,type,title,message,href,task_id,event_key)
  values(recipient,'assignment','Công việc mới được giao',coalesce(t.title,'Công việc'),'/tasks/'||t.id,t.id,'assignment:'||t.id||':'||recipient||':'||new.assigned_at||':'||new.assignment_role)
  on conflict (event_key) do nothing;
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
