select case when
  (select count(*) from public.permissions where code in ('leave.approve','schedule.business.approve','schedule.event.approve')) = 3
  and (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('approval_effective_scopes','approval_review_basis','approval_assert_can_review','api_review_leave_request','api_review_personal_work_schedule','api_list_reviewable_leave_requests','api_list_reviewable_personal_plans','api_get_approval_capabilities','api_list_user_approval_permissions','api_list_user_permission_history')) = 10
  and not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('approval_effective_scopes','approval_review_basis','approval_assert_can_review','api_review_leave_request','api_review_personal_work_schedule','api_list_reviewable_leave_requests','api_list_reviewable_personal_plans','api_get_approval_capabilities','api_list_user_approval_permissions','api_list_user_permission_history')
      and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute') or has_function_privilege('public',p.oid,'execute') or not has_function_privilege('service_role',p.oid,'execute'))
  ) then 'pass' else 'fail' end;
