-- Only use after migration 20261102190000_database_management_v1_gopy_dot1_forms.sql has been applied.
begin;
do $revert$
declare item record; current_form record; previous_form record; new_type_id uuid;
begin
  for item in select t.* from public.db_record_types t join public.db_categories c on c.id=t.category_id where (c.code='ngoai_ngu' and t.code<>'ngoai_ngu_ho_so_nhan_vat') or t.code in ('khach_hang_doi_tac','de_xuat_bao_gia_thuong_thao','hop_dong_nghiep_vu','san_pham_truyen_thong_hop_dong','nghiem_thu_ban_giao_thanh_ly','tham_chieu_thanh_toan_quyet_toan','tai_tro_quang_cao_hop_tac','kho_thiet_ke_nhan_dien','bao_cao_thong_ke_nghiep_vu') loop
    select * into current_form from public.db_form_definitions where record_type_id=item.id and status='published' order by version desc limit 1;
select * into previous_form from public.db_form_definitions where record_type_id=item.id and version=current_form.version-1 limit 1;
  if previous_form.id is null then raise exception 'previous form missing for %',item.code; end if;
  update public.db_form_definitions set status='retired' where id=current_form.id;
  update public.db_form_definitions set status='published' where id=previous_form.id;
  end loop;
select id into new_type_id from public.db_record_types where code='ngoai_ngu_ho_so_nhan_vat';
  if exists(select 1 from public.db_records where record_type_id=new_type_id) then raise exception 'cannot revert ngoai_ngu_ho_so_nhan_vat with records'; end if;
  update public.db_record_types set active=false where id=new_type_id;
  update public.db_form_definitions set status='retired' where record_type_id=new_type_id and status='published';
  update public.db_record_types set name='Nhân vật, đối tác, chuyên gia, cộng tác viên' where code='ngoai_ngu_danh_ba_doi_tac';
end
$revert$;
create or replace function public.enforce_danh_ba_department_visibility() returns trigger language plpgsql set search_path=public as $function$
begin if new.visibility='public' and exists(select 1 from public.db_record_types t where t.id=new.record_type_id and t.code='danh_ba_nghiep_vu') then raise exception 'danh_ba_nghiep_vu_department_only'; end if; return new; end
$function$;
do $assert$ declare bad int; begin select count(*) into bad from (select t.id from public.db_record_types t left join public.db_form_definitions f on f.record_type_id=t.id and f.status='published' where t.active and (t.code in ('khach_hang_doi_tac','de_xuat_bao_gia_thuong_thao','hop_dong_nghiep_vu','san_pham_truyen_thong_hop_dong','nghiem_thu_ban_giao_thanh_ly','tham_chieu_thanh_toan_quyet_toan','tai_tro_quang_cao_hop_tac','kho_thiet_ke_nhan_dien','bao_cao_thong_ke_nghiep_vu') or t.code in (select t2.code from public.db_record_types t2 join public.db_categories c on c.id=t2.category_id where c.code='ngoai_ngu')) group by t.id having count(f.id)<>1) x;
  if bad<>0 then raise exception 'active type published form count invalid'; end if; end $assert$;
notify pgrst, 'reload schema';
commit;
