-- Complete compatibility grants omitted from the initial catalog seed.
-- These rows mirror existing self-service and inactive-role compatibility behavior.
begin;

insert into public.role_permission_grants (role_id, permission_id, scope)
select r.id, p.id, 'self'
from public.roles r
join public.permissions p on p.code in ('attendance.view_self', 'leave.view_self', 'schedule.view_self')
where r.code in ('admin','tong_bien_tap','pho_tong_bien_tap','truong_phong','pho_truong_phong','phong_vien','nhan_vien','tbt_read_only','bien_tap_vien','tri_su','phu_trach_phong_bien_tap','phu_trach_phong_phong_vien','phu_trach_phong_tri_su')
on conflict (role_id, permission_id, scope) do nothing;

with compatibility_grants (role_code, permission_code, scope) as (
  values
    ('bien_tap_vien', 'task.view', 'self'),
    ('bien_tap_vien', 'task.view', 'assigned'),
    ('bien_tap_vien', 'task.comment', 'self'),
    ('bien_tap_vien', 'task.comment', 'assigned'),
    ('tri_su', 'task.view', 'self'),
    ('tri_su', 'task.view', 'assigned'),
    ('tri_su', 'task.comment', 'self'),
    ('tri_su', 'task.comment', 'assigned'),
    ('phu_trach_phong_bien_tap', 'task.view', 'assigned'),
    ('phu_trach_phong_bien_tap', 'task.view', 'department'),
    ('phu_trach_phong_bien_tap', 'task.assign', 'department'),
    ('phu_trach_phong_bien_tap', 'task.comment', 'assigned'),
    ('phu_trach_phong_bien_tap', 'task.comment', 'department'),
    ('phu_trach_phong_bien_tap', 'task.evaluate.step1', 'department'),
    ('phu_trach_phong_phong_vien', 'task.view', 'assigned'),
    ('phu_trach_phong_phong_vien', 'task.view', 'department'),
    ('phu_trach_phong_phong_vien', 'task.assign', 'department'),
    ('phu_trach_phong_phong_vien', 'task.comment', 'assigned'),
    ('phu_trach_phong_phong_vien', 'task.comment', 'department'),
    ('phu_trach_phong_phong_vien', 'task.evaluate.step1', 'department'),
    ('phu_trach_phong_tri_su', 'task.view', 'assigned'),
    ('phu_trach_phong_tri_su', 'task.view', 'department'),
    ('phu_trach_phong_tri_su', 'task.assign', 'department'),
    ('phu_trach_phong_tri_su', 'task.comment', 'assigned'),
    ('phu_trach_phong_tri_su', 'task.comment', 'department'),
    ('phu_trach_phong_tri_su', 'task.evaluate.step1', 'department')
)
insert into public.role_permission_grants (role_id, permission_id, scope)
select r.id, p.id, c.scope
from compatibility_grants c
join public.roles r on r.code = c.role_code
join public.permissions p on p.code = c.permission_code
on conflict (role_id, permission_id, scope) do nothing;

commit;
