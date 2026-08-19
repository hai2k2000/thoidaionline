-- Localize role display names without changing authorization codes or permission flags.
update public.roles set name = 'Quản trị viên' where code = 'admin';
update public.roles set name = 'Tổng biên tập' where code = 'tong_bien_tap';
update public.roles set name = 'Phó tổng biên tập' where code = 'pho_tong_bien_tap';
update public.roles set name = 'Phụ trách phòng biên tập' where code = 'phu_trach_phong_bien_tap';
update public.roles set name = 'Phụ trách phòng phóng viên' where code = 'phu_trach_phong_phong_vien';
update public.roles set name = 'Phụ trách phòng trị sự' where code = 'phu_trach_phong_tri_su';
update public.roles set name = 'Biên tập viên' where code = 'bien_tap_vien';
update public.roles set name = 'Nhân sự Trị sự' where code = 'tri_su';
update public.roles set name = 'Phóng viên' where code = 'phong_vien';
update public.roles set name = 'TBT - Chỉ xem Công việc và Nhân sự' where code = 'tbt_read_only';

-- Role display names are case-insensitively unique; this is idempotent.
create unique index if not exists roles_name_lower_key on public.roles ((lower(name)));
