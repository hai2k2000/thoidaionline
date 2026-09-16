-- Phase 1A Checkpoint 1: additive RBAC catalog and compatibility grants.
-- This migration intentionally does not alter legacy role_permissions or runtime authorization.
begin;

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  module text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permissions_code_key unique (code),
  constraint permissions_code_nonempty check (length(btrim(code)) > 0),
  constraint permissions_module_nonempty check (length(btrim(module)) > 0)
);

create table if not exists public.role_permission_grants (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  scope text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_permission_grants_scope_check
    check (scope in ('self', 'assigned', 'department', 'all')),
  constraint role_permission_grants_unique unique (role_id, permission_id, scope)
);

create index if not exists role_permission_grants_permission_idx
  on public.role_permission_grants (permission_id);
create index if not exists role_permission_grants_role_scope_idx
  on public.role_permission_grants (role_id, scope);

alter table public.permissions enable row level security;
alter table public.role_permission_grants enable row level security;

-- These tables are server-side compatibility data. Browser roles must not query them directly.
revoke all on table public.permissions from public, anon, authenticated;
revoke all on table public.role_permission_grants from public, anon, authenticated;
grant select, insert, update, delete on table public.permissions to service_role;
grant select, insert, update, delete on table public.role_permission_grants to service_role;

insert into public.permissions (code, name, module, description)
values
  ('task.view', 'Xem công việc', 'task', 'Xem công việc trong phạm vi được phép.'),
  ('task.create', 'Tạo công việc', 'task', 'Tạo công việc theo quyền hiện tại.'),
  ('task.assign', 'Giao việc', 'task', 'Giao việc theo phạm vi hiện tại.'),
  ('task.comment', 'Bình luận công việc', 'task', 'Bình luận trên công việc được phép xem.'),
  ('task.edit_all', 'Sửa mọi công việc', 'task', 'Sửa công việc theo quyền quản trị hiện tại.'),
  ('task.review', 'Duyệt công việc', 'task', 'Quyền review được xác định thêm bởi reviewer và workflow.'),
  ('task.score', 'Chấm điểm công việc', 'task', 'Quyền chấm điểm được xác định thêm bởi reviewer và workflow.'),
  ('task.evaluate.step1', 'Đánh giá bước 1', 'task', 'Đánh giá bước 1 theo phòng và reviewer.'),
  ('task.evaluate.step2', 'Đánh giá bước 2', 'task', 'Đánh giá bước 2 theo quyền lãnh đạo.'),
  ('staff.view', 'Xem nhân sự', 'staff', 'Xem danh sách nhân sự theo chính sách hiện tại.'),
  ('staff.manage', 'Quản lý nhân sự', 'staff', 'Tạo, sửa và quản lý nhân sự.'),
  ('permission.manage', 'Quản lý phân quyền', 'permission', 'Quản lý role và quyền.'),
  ('evaluation.rubric.manage', 'Quản lý rubric', 'evaluation', 'Quản lý rubric đánh giá.'),
  ('attendance.view_self', 'Xem chấm công cá nhân', 'attendance', 'Xem dữ liệu chấm công của chính mình.'),
  ('attendance.view_all', 'Xem chấm công toàn cơ quan', 'attendance', 'Xem chấm công toàn cơ quan.'),
  ('leave.view_self', 'Xem đơn nghỉ cá nhân', 'leave', 'Xem các đơn nghỉ do chính mình gửi.'),
  ('schedule.view_self', 'Xem kế hoạch cá nhân', 'schedule', 'Xem kế hoạch cá nhân của chính mình.')
on conflict (code) do update set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description,
  updated_at = now();

-- Grant only scopes demonstrated by current role_permissions, helpers, routes, and RPCs.
with compatibility_grants (role_code, permission_code, scope) as (
  values
    ('admin', 'staff.view', 'all'),
    ('admin', 'staff.manage', 'all'),
    ('admin', 'permission.manage', 'all'),
    ('admin', 'task.view', 'all'),
    ('admin', 'task.create', 'all'),
    ('admin', 'task.assign', 'all'),
    ('admin', 'task.comment', 'all'),
    ('admin', 'task.edit_all', 'all'),
    ('admin', 'task.evaluate.step1', 'all'),
    ('admin', 'evaluation.rubric.manage', 'all'),
    ('admin', 'attendance.view_self', 'self'),
    ('admin', 'attendance.view_all', 'all'),
    ('admin', 'leave.view_self', 'self'),
    ('admin', 'schedule.view_self', 'self'),
    ('tong_bien_tap', 'staff.view', 'all'),
    ('tong_bien_tap', 'task.view', 'all'),
    ('tong_bien_tap', 'task.create', 'all'),
    ('tong_bien_tap', 'task.assign', 'all'),
    ('tong_bien_tap', 'task.comment', 'all'),
    ('tong_bien_tap', 'task.evaluate.step2', 'all'),
    ('tong_bien_tap', 'leave.view_self', 'self'),
    ('tong_bien_tap', 'schedule.view_self', 'self'),
    ('tbt_read_only', 'staff.view', 'all'),
    ('tbt_read_only', 'task.view', 'all'),
    ('tbt_read_only', 'leave.view_self', 'self'),
    ('tbt_read_only', 'schedule.view_self', 'self'),
    ('pho_tong_bien_tap', 'task.view', 'assigned'),
    ('pho_tong_bien_tap', 'task.view', 'department'),
    ('pho_tong_bien_tap', 'task.create', 'all'),
    ('pho_tong_bien_tap', 'task.assign', 'all'),
    ('pho_tong_bien_tap', 'task.comment', 'assigned'),
    ('pho_tong_bien_tap', 'task.comment', 'department'),
    ('pho_tong_bien_tap', 'leave.view_self', 'self'),
    ('pho_tong_bien_tap', 'schedule.view_self', 'self'),
    ('pho_truong_phong', 'task.view', 'assigned'),
    ('pho_truong_phong', 'task.view', 'department'),
    ('pho_truong_phong', 'task.create', 'all'),
    ('pho_truong_phong', 'task.assign', 'department'),
    ('pho_truong_phong', 'task.comment', 'assigned'),
    ('pho_truong_phong', 'task.comment', 'department'),
    ('pho_truong_phong', 'leave.view_self', 'self'),
    ('pho_truong_phong', 'schedule.view_self', 'self'),
    ('truong_phong', 'task.view', 'assigned'),
    ('truong_phong', 'task.view', 'department'),
    ('truong_phong', 'task.create', 'all'),
    ('truong_phong', 'task.assign', 'department'),
    ('truong_phong', 'task.comment', 'assigned'),
    ('truong_phong', 'task.comment', 'department'),
    ('truong_phong', 'leave.view_self', 'self'),
    ('truong_phong', 'schedule.view_self', 'self'),
    ('phong_vien', 'task.view', 'self'),
    ('phong_vien', 'task.view', 'assigned'),
    ('phong_vien', 'task.create', 'all'),
    ('phong_vien', 'task.comment', 'self'),
    ('phong_vien', 'task.comment', 'assigned'),
    ('phong_vien', 'leave.view_self', 'self'),
    ('phong_vien', 'schedule.view_self', 'self'),
    ('nhan_vien', 'task.view', 'self'),
    ('nhan_vien', 'task.view', 'assigned'),
    ('nhan_vien', 'task.create', 'all'),
    ('nhan_vien', 'task.comment', 'self'),
    ('nhan_vien', 'task.comment', 'assigned'),
    ('nhan_vien', 'leave.view_self', 'self'),
    ('nhan_vien', 'schedule.view_self', 'self'),
    ('bien_tap_vien', 'task.create', 'all'),
    ('bien_tap_vien', 'task.edit_all', 'all'),
    ('tri_su', 'task.create', 'all'),
    ('tri_su', 'task.edit_all', 'all')
)
insert into public.role_permission_grants (role_id, permission_id, scope)
select r.id, p.id, c.scope
from compatibility_grants c
join public.roles r on r.code = c.role_code
join public.permissions p on p.code = c.permission_code
on conflict (role_id, permission_id, scope) do nothing;

commit;
