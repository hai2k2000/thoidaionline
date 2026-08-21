begin;

insert into public.role_permissions(role_id)
select id from public.roles where lower(code)='truong_phong'
on conflict(role_id) do nothing;

update public.role_permissions permission
set can_assign_task=true,
    can_view_department_tasks=true
from public.roles role
where permission.role_id=role.id
  and lower(role.code)='truong_phong';

commit;
