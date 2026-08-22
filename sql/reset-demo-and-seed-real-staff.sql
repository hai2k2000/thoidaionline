-- Xóa dữ liệu demo và nạp danh sách nhân sự thực tế (Báo Thời Đại)
-- Chạy file này trong Supabase SQL Editor (production/staging tùy môi trường)

begin;

-- 0) Bổ sung cột username để đăng nhập theo tài khoản không dấu
alter table public.staff_users add column if not exists username text;
create unique index if not exists idx_staff_users_username_unique on public.staff_users (lower(username));

-- 1) Dọn dữ liệu phát sinh từ demo
update public.tasks set assignee_id = null where assignee_id in (
  select id from public.staff_users where email in ('hai@example.com','minh@example.com','hoa@example.com','nam@example.com')
);

update public.tasks set created_by = null where created_by in (
  select id from public.staff_users where email in ('hai@example.com','minh@example.com','hoa@example.com','nam@example.com')
);

update public.tasks set reviewer_id = null where reviewer_id in (
  select id from public.staff_users where email in ('hai@example.com','minh@example.com','hoa@example.com','nam@example.com')
);

delete from public.task_comments where user_id in (
  select id from public.staff_users where email in ('hai@example.com','minh@example.com','hoa@example.com','nam@example.com')
);

delete from public.task_progress_logs where user_id in (
  select id from public.staff_users where email in ('hai@example.com','minh@example.com','hoa@example.com','nam@example.com')
);

-- Xóa task demo theo tiêu đề seed cũ
delete from public.tasks where title in (
  'Hoàn thiện kế hoạch nội dung tuần',
  'Rà soát ngân sách hoạt động tháng',
  'Chuẩn hóa quy trình giao việc nội bộ'
);

-- Xóa user demo
delete from public.staff_users where email in ('hai@example.com','minh@example.com','hoa@example.com','nam@example.com');

-- 2) Chuẩn hóa phòng ban
insert into public.departments (code, name) values
('leadership', 'Ban Biên tập'),
('editorial', 'Phòng Biên tập'),
('reporter', 'Phòng Phóng viên'),
('general', 'Phòng Tổng hợp'),
('admin', 'Phòng Trị sự')
on conflict (code) do update set name = excluded.name;

-- Gộp Phòng Kế toán + Phòng IT về Phòng Trị sự
update public.staff_users
set department_id = (select id from public.departments where code = 'admin' limit 1)
where department_id in (
  select id from public.departments where code in ('finance', 'it')
);

update public.tasks
set department_id = (select id from public.departments where code = 'admin' limit 1)
where department_id in (
  select id from public.departments where code in ('finance', 'it')
);

delete from public.departments where code in ('finance', 'it');

-- Gộp phòng ban trùng: bỏ "Bảo vệ", chuyển toàn bộ về "Phòng Trị sự"
update public.staff_users
set department_id = (select id from public.departments where code = 'admin' limit 1)
where department_id in (select id from public.departments where code = 'security');

update public.tasks
set department_id = (select id from public.departments where code = 'admin' limit 1)
where department_id in (select id from public.departments where code = 'security');

delete from public.departments where code = 'security';

-- 3) Bổ sung chức vụ mới theo yêu cầu
insert into public.roles (code, name, level) values
('phu_trach_phong_tri_su', 'Phụ trách phòng trị sự', 3),
('phu_trach_phong_phong_vien', 'Phụ trách phòng phóng viên', 3),
('phu_trach_phong_bien_tap', 'Phụ trách phòng biên tập', 3),
('bien_tap_vien', 'Biên tập viên', 2)
on conflict (code) do update set name = excluded.name, level = excluded.level;

insert into public.role_permissions (role_id, can_manage_users, can_manage_permissions, can_create_task, can_edit_all_tasks, can_comment)
select id,
  false,
  false,
  true,
  true,
  true
from public.roles
where code in ('phu_trach_phong_tri_su', 'phu_trach_phong_phong_vien', 'phu_trach_phong_bien_tap', 'bien_tap_vien')
on conflict (role_id) do update set
  can_manage_users = excluded.can_manage_users,
  can_manage_permissions = excluded.can_manage_permissions,
  can_create_task = excluded.can_create_task,
  can_edit_all_tasks = excluded.can_edit_all_tasks,
  can_comment = excluded.can_comment,
  updated_at = now();

-- 4) Danh sách nhân sự thật + username đăng nhập
with staff_seed(full_name, username, email, role_code, dept_code) as (
  values
    ('Lê Quang Thiện', 'quangthien', 'le.quang.thien@baothoidai.local', 'tong_bien_tap', 'leadership'),
    ('Phạm Đình Hải', 'dinhhai', 'pham.dinh.hai@baothoidai.local', 'pho_tong_bien_tap', 'leadership'),
    ('Ngô Trí Đường', 'triduong', 'ngo.tri.duong@baothoidai.local', 'phu_trach_phong_bien_tap', 'editorial'),
    ('Trần Lê Sơn', 'leson', 'tran.le.son@baothoidai.local', 'bien_tap_vien', 'editorial'),
    ('Hoàng Văn Mạnh', 'vanmanh', 'hoang.van.manh@baothoidai.local', 'bien_tap_vien', 'editorial'),
    ('Phạm Thị Hưng', 'thihung', 'pham.thi.hung@baothoidai.local', 'phu_trach_phong_phong_vien', 'reporter'),
    ('Nguyễn Duy Đông', 'duydong', 'nguyen.duy.dong@baothoidai.local', 'tri_su', 'general'),
    ('Lê Thị Bích Thuận', 'bichthuan', 'le.thi.bich.thuan@baothoidai.local', 'tri_su', 'admin'),
    ('Trần Thị Vân Anh', 'vananh', 'tran.thi.van.anh@baothoidai.local', 'tri_su', 'admin'),
    ('Hoàng Quỳnh Trang', 'quynhtrang', 'hoang.quynh.trang@baothoidai.local', 'tri_su', 'admin'),
    ('Ngô Tùng Dương', 'tungduong', 'ngo.tung.duong@baothoidai.local', 'phu_trach_phong_tri_su', 'admin'),
    ('Đoàn Thanh Hải', 'thanhhai', 'doan.thanh.hai@baothoidai.local', 'tri_su', 'general'),
    ('Phạm Thị Thu Hương', 'thuhuong', 'pham.thi.thu.huong@baothoidai.local', 'tri_su', 'admin'),
    ('Phạm Thị Lý', 'thily', 'pham.thi.ly@baothoidai.local', 'phong_vien', 'reporter'),
    ('Vũ Mai Anh', 'maianh', 'vu.mai.anh@baothoidai.local', 'phong_vien', 'reporter'),
    ('Đinh Xuân Hòa', 'xuanhoa', 'dinh.xuan.hoa@baothoidai.local', 'phong_vien', 'reporter'),
    ('Phan Thị Doan', 'thidoan', 'phan.thi.doan@baothoidai.local', 'phong_vien', 'reporter'),
    ('Đặng Ngọc Anh', 'ngocanh', 'dang.ngoc.anh@baothoidai.local', 'phong_vien', 'reporter'),
    ('Mai Thị Thùy', 'thithuy', 'mai.thi.thuy@baothoidai.local', 'phong_vien', 'reporter'),
    ('Nguyễn Thu Phượng', 'thuphuong', 'nguyen.thu.phuong@baothoidai.local', 'phong_vien', 'reporter'),
    ('Nguyễn Bạch Dương', 'bachduong', 'nguyen.bach.duong@baothoidai.local', 'phong_vien', 'reporter'),
    ('Dương Đức Anh', 'ducanh', 'duong.duc.anh@baothoidai.local', 'phong_vien', 'reporter'),
    ('Hoàng Minh Đức', 'minhduc', 'hoang.minh.duc@baothoidai.local', 'phong_vien', 'reporter'),
    ('Nguyễn Văn Linh', 'vanlinh', 'nguyen.van.linh@baothoidai.local', 'phong_vien', 'reporter'),
    ('Trần Thị Nhị', 'thinhi', 'tran.thi.nhi@baothoidai.local', 'phong_vien', 'reporter'),
    ('Đặng Quang Minh', 'quangminh', 'dang.quang.minh@baothoidai.local', 'phong_vien', 'reporter'),
    ('Nguyễn Hữu Bắc', 'huubac', 'nguyen.huu.bac@baothoidai.local', 'phong_vien', 'reporter'),
    ('Trương Thanh Tùng', 'thanhtung', 'truong.thanh.tung@baothoidai.local', 'phong_vien', 'reporter'),
    ('Nguyễn Hồng Khánh', 'hongkhanh', 'nguyen.hong.khanh@baothoidai.local', 'tri_su', 'admin')
)
-- update user đã có theo email
update public.staff_users u
set username = s.username,
    full_name = s.full_name
from staff_seed s
where lower(u.email) = lower(s.email);

-- insert user chưa có
insert into public.staff_users (full_name, username, email, phone, password, role_id, department_id, active)
select s.full_name, s.username, s.email, null, '123456', r.id, d.id, true
from (
  values
    ('Lê Quang Thiện', 'quangthien', 'le.quang.thien@baothoidai.local', 'tong_bien_tap', 'leadership'),
    ('Phạm Đình Hải', 'dinhhai', 'pham.dinh.hai@baothoidai.local', 'pho_tong_bien_tap', 'leadership'),
    ('Ngô Trí Đường', 'triduong', 'ngo.tri.duong@baothoidai.local', 'phu_trach_phong_bien_tap', 'editorial'),
    ('Trần Lê Sơn', 'leson', 'tran.le.son@baothoidai.local', 'bien_tap_vien', 'editorial'),
    ('Hoàng Văn Mạnh', 'vanmanh', 'hoang.van.manh@baothoidai.local', 'bien_tap_vien', 'editorial'),
    ('Phạm Thị Hưng', 'thihung', 'pham.thi.hung@baothoidai.local', 'phu_trach_phong_phong_vien', 'reporter'),
    ('Nguyễn Duy Đông', 'duydong', 'nguyen.duy.dong@baothoidai.local', 'tri_su', 'general'),
    ('Lê Thị Bích Thuận', 'bichthuan', 'le.thi.bich.thuan@baothoidai.local', 'tri_su', 'admin'),
    ('Trần Thị Vân Anh', 'vananh', 'tran.thi.van.anh@baothoidai.local', 'tri_su', 'admin'),
    ('Hoàng Quỳnh Trang', 'quynhtrang', 'hoang.quynh.trang@baothoidai.local', 'tri_su', 'admin'),
    ('Ngô Tùng Dương', 'tungduong', 'ngo.tung.duong@baothoidai.local', 'phu_trach_phong_tri_su', 'admin'),
    ('Đoàn Thanh Hải', 'thanhhai', 'doan.thanh.hai@baothoidai.local', 'tri_su', 'general'),
    ('Phạm Thị Thu Hương', 'thuhuong', 'pham.thi.thu.huong@baothoidai.local', 'tri_su', 'admin'),
    ('Phạm Thị Lý', 'thily', 'pham.thi.ly@baothoidai.local', 'phong_vien', 'reporter'),
    ('Vũ Mai Anh', 'maianh', 'vu.mai.anh@baothoidai.local', 'phong_vien', 'reporter'),
    ('Đinh Xuân Hòa', 'xuanhoa', 'dinh.xuan.hoa@baothoidai.local', 'phong_vien', 'reporter'),
    ('Phan Thị Doan', 'thidoan', 'phan.thi.doan@baothoidai.local', 'phong_vien', 'reporter'),
    ('Đặng Ngọc Anh', 'ngocanh', 'dang.ngoc.anh@baothoidai.local', 'phong_vien', 'reporter'),
    ('Mai Thị Thùy', 'thithuy', 'mai.thi.thuy@baothoidai.local', 'phong_vien', 'reporter'),
    ('Nguyễn Thu Phượng', 'thuphuong', 'nguyen.thu.phuong@baothoidai.local', 'phong_vien', 'reporter'),
    ('Nguyễn Bạch Dương', 'bachduong', 'nguyen.bach.duong@baothoidai.local', 'phong_vien', 'reporter'),
    ('Dương Đức Anh', 'ducanh', 'duong.duc.anh@baothoidai.local', 'phong_vien', 'reporter'),
    ('Hoàng Minh Đức', 'minhduc', 'hoang.minh.duc@baothoidai.local', 'phong_vien', 'reporter'),
    ('Nguyễn Văn Linh', 'vanlinh', 'nguyen.van.linh@baothoidai.local', 'phong_vien', 'reporter'),
    ('Trần Thị Nhị', 'thinhi', 'tran.thi.nhi@baothoidai.local', 'phong_vien', 'reporter'),
    ('Đặng Quang Minh', 'quangminh', 'dang.quang.minh@baothoidai.local', 'phong_vien', 'reporter'),
    ('Nguyễn Hữu Bắc', 'huubac', 'nguyen.huu.bac@baothoidai.local', 'phong_vien', 'reporter'),
    ('Trương Thanh Tùng', 'thanhtung', 'truong.thanh.tung@baothoidai.local', 'phong_vien', 'reporter'),
    ('Nguyễn Hồng Khánh', 'hongkhanh', 'nguyen.hong.khanh@baothoidai.local', 'tri_su', 'admin')
) as s(full_name, username, email, role_code, dept_code)
join public.roles r on r.code = s.role_code
join public.departments d on d.code = s.dept_code
where not exists (
  select 1 from public.staff_users u where lower(u.email) = lower(s.email)
);

commit;
