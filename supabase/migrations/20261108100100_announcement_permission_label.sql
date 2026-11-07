begin;

-- Name the permission for what it grants, so admins can find it on the permissions page.
update public.permissions
set name = 'Đăng thông báo toàn cơ quan',
    description = 'Đăng, sửa và gỡ thông báo toàn cơ quan và thông báo của mọi phòng ban'
where code = 'announcement.manage';

notify pgrst, 'reload schema';
commit;
