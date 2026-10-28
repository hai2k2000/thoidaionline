begin;

insert into public.permissions(code,name,module,description) values
  ('attendance.manage','Quản lý chấm công','attendance','Ghi chú chấm công, yêu cầu đồng bộ máy chấm công.')
on conflict (code) do nothing;

update public.permissions
set name='Xem chấm công cơ quan/phòng',
    description='Xem chấm công toàn cơ quan (all) hoặc phòng mình (department).'
where code='attendance.view_all';

create or replace function public.rbac_v2_scope_supported(p_permission_code text, p_scope text)
returns boolean language sql immutable
as $function$
  select case
    when p_scope is null then false
    when p_permission_code in ('task.quick_report.create', 'attendance.view_self', 'leave.view_self', 'schedule.view_self') then p_scope in ('self', 'all')
    when p_permission_code in ('leave.approve', 'schedule.business.approve', 'schedule.event.approve') then p_scope in ('department', 'all')
    when p_permission_code in ('attendance.view_all') then p_scope in ('department', 'all')
    when p_permission_code in ('task.create', 'task.edit_all', 'task.review', 'task.score', 'task.evaluate.step1', 'task.evaluate.step2', 'staff.manage', 'permission.manage', 'evaluation.rubric.manage', 'attendance.manage', 'asset.manage', 'journalism.metadata.update', 'journalism.publication.manage', 'journalism.publication.verify') then p_scope = 'all'
    when p_permission_code = 'task.assign' then p_scope in ('department', 'all')
    when p_permission_code = 'asset.view' then p_scope in ('assigned', 'department', 'all')
    else p_scope in ('self', 'assigned', 'department', 'all')
  end;
$function$;

insert into public.role_permission_grants(role_id,permission_id,scope)
select r.id,p.id,'all' from public.roles r cross join public.permissions p
where r.code='admin' and p.code='attendance.manage'
on conflict (role_id,permission_id,scope) do nothing;

alter table public.staff_users add column if not exists attendance_exempt boolean not null default false;

do $$
declare updated_count integer;
begin
  update public.staff_users
  set attendance_exempt=true
  where lower(translate(replace(replace(full_name,'Đ','D'),'đ','d'), 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyy'))
    in ('dang quang minh','nguyen van linh','nguyen hong khanh')
    and attendance_exempt is distinct from true;
  get diagnostics updated_count = row_count;
  raise notice 'attendance_exempt backfill updated % rows', updated_count;
end $$;

do $$ declare f text; begin
  f := 'rbac_v2_scope_supported(text,text)';
  execute format('revoke all on function public.%s from public, anon, authenticated', f);
  execute format('grant execute on function public.%s to service_role', f);
  execute format('alter function public.%s owner to postgres', f);
end $$;

notify pgrst, 'reload schema';
commit;
