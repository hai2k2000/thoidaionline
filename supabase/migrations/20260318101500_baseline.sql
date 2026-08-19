create extension if not exists pgcrypto;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  active boolean not null default true
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  level int not null default 1
);

create table if not exists public.role_permissions (
  role_id uuid primary key references public.roles(id) on delete cascade,
  can_manage_users boolean not null default false,
  can_manage_permissions boolean not null default false,
  can_create_task boolean not null default true,
  can_edit_all_tasks boolean not null default false,
  can_comment boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  password text not null default '123456',
  role_id uuid not null references public.roles(id),
  department_id uuid not null references public.departments(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.staff_users add column if not exists password text;
update public.staff_users set password = coalesce(password, '123456');

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'new' check (status in ('new','in_progress','pending_review','done','rejected')),
  progress_percent int not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  attachment_url text,
  assignee_id uuid references public.staff_users(id),
  owner_id uuid references public.staff_users(id),
  parent_task_id uuid references public.tasks(id) on delete set null,
  assignment_mode text not null default 'individual' check (assignment_mode in ('individual','multi_user','department','mixed')),
  created_by uuid references public.staff_users(id),
  reviewer_id uuid references public.staff_users(id),
  department_id uuid references public.departments(id),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks add column if not exists attachment_url text;
alter table public.tasks add column if not exists owner_id uuid references public.staff_users(id);
alter table public.tasks add column if not exists parent_task_id uuid references public.tasks(id) on delete set null;
alter table public.tasks add column if not exists assignment_mode text not null default 'individual' check (assignment_mode in ('individual','multi_user','department','mixed'));

create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.staff_users(id),
  assignment_role text not null default 'assignee' check (assignment_role in ('owner','assignee','watcher')),
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  note text,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.staff_users(id),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_progress_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.staff_users(id),
  old_progress int,
  new_progress int not null,
  note text,
  created_at timestamptz not null default now()
);

-- RLS MVP
alter table public.departments enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_users enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_progress_logs enable row level security;
alter table public.task_assignees enable row level security;

-- Drop old policies
drop policy if exists "public read departments" on public.departments;
drop policy if exists "public write departments" on public.departments;
drop policy if exists "public read roles" on public.roles;
drop policy if exists "public write roles" on public.roles;
drop policy if exists "public read role_permissions" on public.role_permissions;
drop policy if exists "public write role_permissions" on public.role_permissions;
drop policy if exists "public read staff_users" on public.staff_users;
drop policy if exists "public write staff_users" on public.staff_users;
drop policy if exists "public read tasks" on public.tasks;
drop policy if exists "public write tasks" on public.tasks;
drop policy if exists "public read task_comments" on public.task_comments;
drop policy if exists "public write task_comments" on public.task_comments;
drop policy if exists "public read task_progress_logs" on public.task_progress_logs;
drop policy if exists "public write task_progress_logs" on public.task_progress_logs;
drop policy if exists "public read task_assignees" on public.task_assignees;
drop policy if exists "public write task_assignees" on public.task_assignees;

create policy "public read departments" on public.departments for select to anon using (true);
create policy "public write departments" on public.departments for all to anon using (true) with check (true);

create policy "public read roles" on public.roles for select to anon using (true);
create policy "public write roles" on public.roles for all to anon using (true) with check (true);

create policy "public read role_permissions" on public.role_permissions for select to anon using (true);
create policy "public write role_permissions" on public.role_permissions for all to anon using (true) with check (true);

create policy "public read staff_users" on public.staff_users for select to anon using (true);
create policy "public write staff_users" on public.staff_users for all to anon using (true) with check (true);

create policy "public read tasks" on public.tasks for select to anon using (true);
create policy "public write tasks" on public.tasks for all to anon using (true) with check (true);

create policy "public read task_comments" on public.task_comments for select to anon using (true);
create policy "public write task_comments" on public.task_comments for all to anon using (true) with check (true);

create policy "public read task_progress_logs" on public.task_progress_logs for select to anon using (true);
create policy "public write task_progress_logs" on public.task_progress_logs for all to anon using (true) with check (true);

create policy "public read task_assignees" on public.task_assignees for select to anon using (true);
create policy "public write task_assignees" on public.task_assignees for all to anon using (true) with check (true);

-- Storage for task attachments
insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', true)
on conflict (id) do nothing;

drop policy if exists "public read task-files" on storage.objects;
create policy "public read task-files"
on storage.objects for select
to anon
using (bucket_id = 'task-files');

drop policy if exists "public write task-files" on storage.objects;
create policy "public write task-files"
on storage.objects for insert
to anon
with check (bucket_id = 'task-files');

-- Seed
delete from public.departments where code in ('editorial','admin','reporter');
insert into public.departments (code, name) values
('leadership', 'Ban lãnh đạo'),
('operations', 'Phòng Trị sự'),
('content', 'Phòng Phóng viên')
on conflict (code) do update set name = excluded.name;

insert into public.roles (code, name, level) values
('tong_bien_tap', 'Tổng biên tập', 4),
('pho_tong_bien_tap', 'Phó tổng biên tập', 3),
('tri_su', 'Nhân sự Trị sự', 2),
('phong_vien', 'Phóng viên', 1)
on conflict (code) do update set name = excluded.name, level = excluded.level;

insert into public.role_permissions (role_id, can_manage_users, can_manage_permissions, can_create_task, can_edit_all_tasks, can_comment)
select id,
  case when code in ('tong_bien_tap','pho_tong_bien_tap') then true else false end,
  case when code = 'tong_bien_tap' then true else false end,
  true,
  case when code in ('tong_bien_tap','pho_tong_bien_tap','tri_su') then true else false end,
  true
from public.roles
on conflict (role_id) do update set
  can_manage_users = excluded.can_manage_users,
  can_manage_permissions = excluded.can_manage_permissions,
  can_create_task = excluded.can_create_task,
  can_edit_all_tasks = excluded.can_edit_all_tasks,
  can_comment = excluded.can_comment,
  updated_at = now();

insert into public.staff_users (full_name, email, phone, password, role_id, department_id, active)
select 'Nguyễn Hải', 'hai@example.com', '0900000001', 'admin123', r.id, d.id, true
from public.roles r, public.departments d
where r.code = 'tong_bien_tap' and d.code = 'leadership'
on conflict do nothing;

insert into public.staff_users (full_name, email, phone, password, role_id, department_id, active)
select * from (
  select 'Trần Minh', 'minh@example.com', '0900000002', 'manager123', (select id from public.roles where code='pho_tong_bien_tap'), (select id from public.departments where code='leadership'), true
  union all
  select 'Lê Hoa', 'hoa@example.com', '0900000003', 'ops123', (select id from public.roles where code='tri_su'), (select id from public.departments where code='operations'), true
  union all
  select 'Phạm Nam', 'nam@example.com', '0900000004', 'reporter123', (select id from public.roles where code='phong_vien'), (select id from public.departments where code='content'), true
) v(full_name,email,phone,password,role_id,department_id,active)
where not exists (select 1 from public.staff_users u where u.email = v.email);

-- Demo tasks/comments/progress logs
insert into public.tasks (title, description, priority, status, progress_percent, assignee_id, department_id, due_date)
select * from (
  select
    'Hoàn thiện kế hoạch nội dung tuần',
    'Tổng hợp đề tài và timeline triển khai',
    'high',
    'in_progress',
    45,
    (select id from public.staff_users where email='nam@example.com' limit 1),
    (select id from public.departments where code='content' limit 1),
    current_date + 3
  union all
  select
    'Rà soát ngân sách hoạt động tháng',
    'Kiểm tra line-item và đề xuất điều chỉnh',
    'normal',
    'pending_review',
    80,
    (select id from public.staff_users where email='hoa@example.com' limit 1),
    (select id from public.departments where code='operations' limit 1),
    current_date + 2
  union all
  select
    'Chuẩn hóa quy trình giao việc nội bộ',
    'Viết guideline và biểu mẫu chuẩn',
    'urgent',
    'new',
    10,
    (select id from public.staff_users where email='minh@example.com' limit 1),
    (select id from public.departments where code='leadership' limit 1),
    current_date + 5
) v(title, description, priority, status, progress_percent, assignee_id, department_id, due_date)
where v.assignee_id is not null
  and not exists (select 1 from public.tasks t where t.title = v.title);

update public.tasks set owner_id = coalesce(owner_id, assignee_id), assignment_mode = coalesce(assignment_mode, 'individual');

insert into public.task_assignees (task_id, user_id, assignment_role, status)
select t.id, t.assignee_id, 'owner',
  case when t.progress_percent >= 100 or t.status = 'done' then 'done'
       when t.progress_percent > 0 then 'in_progress'
       else 'todo' end
from public.tasks t
where t.assignee_id is not null
on conflict (task_id, user_id) do update set assignment_role = excluded.assignment_role;

insert into public.task_comments (task_id, user_id, content)
select
  t.id,
  (select id from public.staff_users where email='hai@example.com' limit 1),
  'Demo comment: ưu tiên xử lý trước 2 hạng mục đầu.'
from public.tasks t
where t.title = 'Hoàn thiện kế hoạch nội dung tuần'
  and not exists (
    select 1 from public.task_comments c where c.task_id = t.id and c.content like 'Demo comment:%'
  );

insert into public.task_progress_logs (task_id, user_id, old_progress, new_progress, note)
select
  t.id,
  (select id from public.staff_users where email='nam@example.com' limit 1),
  30,
  45,
  'Demo log: cập nhật tiến độ đầu tuần'
from public.tasks t
where t.title = 'Hoàn thiện kế hoạch nội dung tuần'
  and not exists (
    select 1 from public.task_progress_logs l where l.task_id = t.id and l.note like 'Demo log:%'
  );
