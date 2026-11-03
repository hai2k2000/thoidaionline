begin;

insert into public.roles (code, name, level, active)
values ('cong_tac_vien', 'Cộng tác viên', 1, true)
on conflict (code) do update set name = excluded.name, level = excluded.level;

-- Legacy workflow uses task.view for progress, submission and attachments;
-- own account/password endpoints authorize against the signed session.
insert into public.role_permissions (
  role_id, can_manage_users, can_manage_permissions, can_create_task,
  can_edit_all_tasks, can_comment, can_assign_task, can_view_department_tasks,
  can_evaluate_step1, can_evaluate_step2, can_manage_rubrics
)
select id, false, false, false, false, true, false, false, false, false, false
from public.roles where code = 'cong_tac_vien'
on conflict (role_id) do update set
  can_manage_users = false, can_manage_permissions = false, can_create_task = false,
  can_edit_all_tasks = false, can_comment = true, can_assign_task = false,
  can_view_department_tasks = false, can_evaluate_step1 = false,
  can_evaluate_step2 = false, can_manage_rubrics = false;

delete from public.role_permission_grants
where role_id = (select id from public.roles where code = 'cong_tac_vien');

insert into public.role_permission_grants (role_id, permission_id, scope)
select r.id, p.id, 'assigned'
from public.roles r cross join public.permissions p
where r.code = 'cong_tac_vien' and p.code in ('task.view', 'task.comment')
on conflict (role_id, permission_id, scope) do nothing;

commit;
