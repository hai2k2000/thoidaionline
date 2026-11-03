select case when
  (select count(*) from public.roles where code = 'cong_tac_vien') = 1
  and exists (
    select 1 from public.roles r join public.role_permissions rp on rp.role_id = r.id
    where r.code = 'cong_tac_vien' and r.active is true and r.level = 1
      and rp.can_comment is true
      and rp.can_manage_users is false and rp.can_manage_permissions is false
      and rp.can_create_task is false and rp.can_edit_all_tasks is false
      and rp.can_assign_task is false and rp.can_view_department_tasks is false
      and rp.can_evaluate_step1 is false and rp.can_evaluate_step2 is false
      and rp.can_manage_rubrics is false
  )
  and (select count(*) from public.role_permission_grants g
       join public.roles r on r.id = g.role_id where r.code = 'cong_tac_vien') = 2
  and not exists (
    select 1 from public.role_permission_grants g
    join public.roles r on r.id = g.role_id
    left join public.permissions p on p.id = g.permission_id
    where r.code = 'cong_tac_vien'
      and (p.code is null or p.code not in ('task.view', 'task.comment')
           or g.scope is distinct from 'assigned')
  )
  and not exists (
    select 1 from (values ('task.view'), ('task.comment')) expected(code)
    where not exists (
      select 1 from public.role_permission_grants g
      join public.roles r on r.id = g.role_id
      join public.permissions p on p.id = g.permission_id
      where r.code = 'cong_tac_vien' and p.code = expected.code and g.scope = 'assigned'
    )
  )
then 'pass' else 'fail' end;
