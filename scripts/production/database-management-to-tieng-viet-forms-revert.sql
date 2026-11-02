begin;

drop trigger if exists db_records_danh_ba_visibility on public.db_records;
drop function if exists public.enforce_danh_ba_department_visibility();

do $revert$
declare item record;
begin
  for item in select t.id, max(f.version) version from public.db_record_types t join public.db_form_definitions f on f.record_type_id=t.id where t.code in ('danh_ba_nghiep_vu','du_lieu_nen_linh_vuc','ho_so_de_tai_tuyen_bai_chuyen_de','giai_bao_chi_san_pham_tieu_bieu','ho_so_nhan_vat','ho_so_phong_van','ho_so_su_kien','ho_so_to_chuc_doi_tac','kho_anh_video','van_kien_tai_lieu_chi_dao_tu_lieu') group by t.id loop
    update public.db_form_definitions set status='retired' where record_type_id=item.id and version=item.version;
    update public.db_form_definitions set status='published' where record_type_id=item.id and version=item.version-1;
  end loop;
end
$revert$;

commit;
