begin;

-- Vietnamese seed labels are kept apart so the structural migration stays ASCII-only.
insert into public.permissions(code,name,module,description) values
 ('announcement.manage','Quản lý bảng tin','announcements','Đăng, sửa và gỡ tin trên Bảng tin cơ quan'),
 ('library.manage','Quản lý thư viện chung','shared_library','Tải lên, sửa và gỡ tài liệu trong Thư viện chung')
on conflict (code) do nothing;

insert into public.role_permission_grants(role_id,permission_id,scope)
select r.id,p.id,'all'
from public.roles r
cross join public.permissions p
where r.code in ('admin','tong_bien_tap','pho_tong_bien_tap')
  and p.code in ('announcement.manage','library.manage')
on conflict (role_id,permission_id,scope) do nothing;

insert into public.shared_library_folders(name,system_key) values
 ('Biểu mẫu','forms'),
 ('Quy định','regulations'),
 ('Hướng dẫn','guides'),
 ('Thương hiệu','brand')
on conflict (system_key) do nothing;

notify pgrst, 'reload schema';
commit;
