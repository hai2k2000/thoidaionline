-- Split full administration into a dedicated admin role and keep TBT roles read-only.
-- Idempotent: safe to apply repeatedly.
insert into public.roles (code, name, level)
values ('admin', 'Quáº£n trá»‹ viÃªn', 5)
on conflict (code) do update
  set name = excluded.name,
      level = excluded.level;

insert into public.role_permissions (
  role_id, can_manage_users, can_manage_permissions,
  can_create_task, can_edit_all_tasks, can_comment
)
select id, true, true, true, true, true
from public.roles
where code = 'admin'
on conflict (role_id) do update set
  can_manage_users = true,
  can_manage_permissions = true,
  can_create_task = true,
  can_edit_all_tasks = true,
  can_comment = true,
  updated_at = now();

-- TBT is a view-only role for work and HR. Keep both legacy codes mapped
-- consistently so existing accounts do not retain administrative privileges.
update public.role_permissions rp
   set can_manage_users = false,
       can_manage_permissions = false,
       can_create_task = false,
       can_edit_all_tasks = false,
       can_comment = false,
       updated_at = now()
  from public.roles r
 where r.id = rp.role_id
   and r.code in ('tong_bien_tap', 'tbt_read_only');

update public.roles
   set name = 'Tá»•ng biÃªn táº­p (chá»‰ xem cÃ´ng viá»‡c vÃ  nhÃ¢n sá»±)'
 where code = 'tong_bien_tap';

create or replace function public.can_administer_users(p_actor_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.staff_users u
      join public.roles r on r.id = u.role_id
     where u.id = p_actor_id
       and u.active = true
       and r.code = 'admin'
  );
$$;
