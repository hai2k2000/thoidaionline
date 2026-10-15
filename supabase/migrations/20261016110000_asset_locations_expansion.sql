begin;

insert into public.asset_locations (code, name)
values
  ('phong_truyen_thong', 'Phòng Truyền thông'),
  ('phong_noi_dung', 'Phòng Nội dung'),
  ('phong_tong_hop_1', 'Phòng Tổng hợp 1'),
  ('phong_tong_hop_2', 'Phòng Tổng hợp 2'),
  ('phong_bao_ve', 'Phòng Bảo vệ'),
  ('phong_ky_thuat', 'Phòng Kỹ thuật')
on conflict (code) do update
set name = excluded.name, active = true, updated_at = now();

commit;
