-- Run BEFORE rbac-approval-v1-revert.sql if both are reverted.
begin;

create or replace function public.rbac_v2_scope_supported(p_permission_code text, p_scope text)
returns boolean language sql immutable
as $function$
  select case
    when p_scope is null then false
    when p_permission_code in ('task.quick_report.create', 'attendance.view_self', 'leave.view_self', 'schedule.view_self') then p_scope in ('self', 'all')
    when p_permission_code in ('leave.approve', 'schedule.business.approve', 'schedule.event.approve') then p_scope in ('department', 'all')
    when p_permission_code in ('task.create', 'task.edit_all', 'task.review', 'task.score', 'task.evaluate.step1', 'task.evaluate.step2', 'staff.manage', 'permission.manage', 'evaluation.rubric.manage', 'attendance.view_all', 'asset.manage', 'journalism.metadata.update', 'journalism.publication.manage', 'journalism.publication.verify') then p_scope = 'all'
    when p_permission_code = 'task.assign' then p_scope in ('department', 'all')
    when p_permission_code = 'asset.view' then p_scope in ('assigned', 'department', 'all')
    else p_scope in ('self', 'assigned', 'department', 'all')
  end;
$function$;
delete from public.role_permission_grants where permission_id=(select id from public.permissions where code='attendance.manage');
delete from public.permissions where code='attendance.manage';
update public.permissions set name='Xem chấm công toàn cơ quan', description='Xem chấm công toàn cơ quan.' where code='attendance.view_all';
commit;
