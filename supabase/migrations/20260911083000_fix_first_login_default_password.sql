begin;

create temp table first_login_password_repair_targets (
  id uuid primary key,
  reason text not null
) on commit drop;

with latest_password_action as (
  select distinct on (entity_id)
    entity_id,
    action
  from public.audit_logs
  where entity_type = 'staff_user'
    and action in ('bulk_password_reset', 'admin_password_set', 'password_reset')
  order by entity_id, created_at desc
)
insert into first_login_password_repair_targets (id, reason)
select staff.id, 'bulk_first_login'
from public.staff_users staff
join latest_password_action latest
  on latest.entity_id = staff.id
 and latest.action = 'bulk_password_reset'
where staff.active = true
  and staff.session_version = 1
  and lower(staff.username) <> 'admin';

insert into first_login_password_repair_targets (id, reason)
select staff.id, 'old_default'
from public.staff_users staff
where staff.active = true
  and lower(staff.username) <> 'admin'
  and staff.password_hash is not null
  and extensions.crypt('123456', staff.password_hash) = staff.password_hash
on conflict (id) do nothing;

update public.staff_users staff
set password_hash = extensions.crypt('Thoidai@123456', extensions.gen_salt('bf', 12)),
    password = null,
    session_version = staff.session_version + 1
from first_login_password_repair_targets target
where staff.id = target.id;

update public.password_reset_tokens token
set used_at = coalesce(token.used_at, now())
from first_login_password_repair_targets target
where token.user_id = target.id
  and token.used_at is null;

insert into public.audit_logs (
  actor_id,
  module,
  entity_type,
  entity_id,
  action,
  old_data,
  new_data
)
select
  null,
  'authentication',
  'staff_user',
  target.id,
  'first_login_default_password_repair',
  null,
  jsonb_build_object(
    'status', 'completed',
    'reason', target.reason,
    'sessions_revoked', true,
    'reset_tokens_invalidated', true
  )
from first_login_password_repair_targets target;

create or replace function public.ensure_staff_password_hash()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
begin
  if new.password_hash is null or new.password_hash = '' then
    new.password_hash := extensions.crypt('Thoidai@123456', extensions.gen_salt('bf', 12));
  end if;
  new.password := null;
  return new;
end;
$function$;

alter function public.ensure_staff_password_hash() owner to postgres;

commit;
