begin;

alter table public.db_record_types add column if not exists sort_order integer;

with type_order(code, sort_order) as (values
  ('dang_van_ban_dinh_ky', 10),
  ('dang_dai_hoi', 20),
  ('dang_tong_ket_nam', 30),
  ('dang_bien_ban_sinh_hoat', 40),
  ('dang_sinh_hoat_chuyen_de', 50),
  ('dang_bao_cao_cong_van', 60),
  ('nha_bao_van_ban_den', 70),
  ('nha_bao_van_ban_di', 80),
  ('nha_bao_hoi_vien', 90),
  ('nha_bao_dai_hoi', 100),
  ('nha_bao_van_ban_khac', 110),
  ('doan_tn_van_ban', 120),
  ('cuc_bc_giay_phep_dai_han', 130),
  ('cuc_bc_giay_phep_ngan_han', 140),
  ('cuc_bc_bao_cao', 150),
  ('cuc_bc_the_nha_bao', 160)
)
update public.db_record_types as record_type
set sort_order = type_order.sort_order, updated_at = now()
from type_order
where record_type.code = type_order.code;

commit;
