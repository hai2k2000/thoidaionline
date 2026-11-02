-- Chi dung sau khi da ap migration 20261103120000_database_management_v1_doan_the_parent.sql.
begin;

update public.db_categories
set parent_id = null, updated_at = now()
where code in ('cong_tac_dang', 'chi_hoi_nha_bao', 'cong_doan', 'doan_thanh_nien', 'cuc_bao_chi', 'lien_hiep', 'phap_ly_dieu_hanh');
update public.db_categories set active = false, updated_at = now() where code = 'doan_the_quan_ly';

do $assert$
declare
  child_count integer;
  parent_active boolean;
begin
  select category.active into parent_active from public.db_categories category where category.code = 'doan_the_quan_ly';
  select count(*) into child_count
  from public.db_categories child_category
  join public.db_categories parent_category on parent_category.id = child_category.parent_id
  where parent_category.code = 'doan_the_quan_ly';
  if parent_active or child_count <> 0 then raise exception 'Doan the parent revert failed'; end if;
end
$assert$;

notify pgrst, 'reload schema';
commit;
