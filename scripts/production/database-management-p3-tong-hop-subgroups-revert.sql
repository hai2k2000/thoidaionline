-- Revert 20261103100000_database_management_v1_p3_tong_hop_subgroups.sql.
begin;

do $revert$
declare
  item record;
  current_form public.db_form_definitions%rowtype;
  previous_form public.db_form_definitions%rowtype;
begin
  if exists (
    select 1
    from public.db_records r
    join public.db_record_types t on t.id = r.record_type_id
    where t.code in ('tccb_tai_lieu_ho_so_nhan_su', 'tccb_hop_dong_lao_dong', 'tccb_bien_dong_nhan_su', 'tccb_danh_gia_khen_thuong_ky_luat')
  ) then
    raise exception 'cannot revert phase 3 with records of new types';
  end if;

  update public.db_form_definitions f
  set status = 'retired'
  from public.db_record_types t
  where t.id = f.record_type_id
    and t.code in ('tccb_tai_lieu_ho_so_nhan_su', 'tccb_hop_dong_lao_dong', 'tccb_bien_dong_nhan_su', 'tccb_danh_gia_khen_thuong_ky_luat')
    and f.status = 'published';

  update public.db_record_types
  set active = false, updated_at = now()
  where code in ('tccb_tai_lieu_ho_so_nhan_su', 'tccb_hop_dong_lao_dong', 'tccb_bien_dong_nhan_su', 'tccb_danh_gia_khen_thuong_ky_luat');

  for item in
    select t.*
    from public.db_record_types t
    where t.code in ('van_ban_den', 'van_ban_di', 'so_sach_van_thu_luu_tru', 'bieu_mau_hanh_chinh', 'bao_cao', 'bien_ban_ket_luan_hop',
    'ho_so_cong_viec_trong_tam', 'ke_hoach_cong_tac', 'phieu_giao_viec', 'van_ban_noi_bo', 'cho_phan_loai')
  loop
    current_form := null;
    previous_form := null;

    select f.* into current_form
    from public.db_form_definitions f
    where f.record_type_id = item.id
      and f.status = 'published'
    order by f.version desc
    limit 1;

    select f.* into previous_form
    from public.db_form_definitions f
    where f.record_type_id = item.id
      and f.version = current_form.version - 1
    limit 1;

    if previous_form.id is null then
      raise exception 'previous form missing for %', item.code;
    end if;

    update public.db_form_definitions
    set status = 'retired'
    where id = current_form.id;

    update public.db_form_definitions
    set status = 'published'
    where id = previous_form.id;

    update public.db_record_types
    set category_id = (select id from public.db_categories where code = 'tong_hop'),
        updated_at = now()
    where id = item.id;

    update public.db_records
    set category_id = (select id from public.db_categories where code = 'tong_hop'),
        updated_at = now()
    where record_type_id = item.id;
  end loop;

  update public.db_categories
  set active = false, updated_at = now()
  where code in ('tong_hop_van_thu_luu_tru', 'tong_hop_to_chuc_can_bo', 'tong_hop_chung');
end
$revert$;

notify pgrst, 'reload schema';
commit;
