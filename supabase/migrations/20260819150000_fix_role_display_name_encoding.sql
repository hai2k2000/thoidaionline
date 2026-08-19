-- Normalize role display names that were previously stored as UTF-8 bytes
-- decoded as Latin-1. Keep role codes stable for existing authorization.
update public.roles
set name = case code
  when 'admin' then 'Quản trị viên'
  when 'tong_bien_tap' then 'Tổng biên tập (chỉ xem công việc và nhân sự)'
  else name
end
where code in ('admin', 'tong_bien_tap');
