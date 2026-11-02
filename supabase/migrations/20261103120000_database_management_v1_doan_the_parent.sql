begin;

update public.db_categories
set active = true, restricted = false, name = 'Các tổ chức đoàn thể', parent_id = null, updated_at = now()
where code = 'doan_the_quan_ly';
update public.db_categories
set parent_id = (
  select parent_category.id from public.db_categories parent_category where parent_category.code = 'doan_the_quan_ly'
), updated_at = now()
where code in ('cong_tac_dang', 'chi_hoi_nha_bao', 'cong_doan', 'doan_thanh_nien', 'cuc_bao_chi', 'lien_hiep', 'phap_ly_dieu_hanh');

do $assert$
declare
  parent_category public.db_categories%rowtype;
  child_count integer;
  active_type_count integer;
  record_item record;
begin
  select category.* into parent_category from public.db_categories category where category.code = 'doan_the_quan_ly';
  if parent_category.id is null or not parent_category.active or parent_category.restricted or parent_category.parent_id is not null then
    raise exception 'Doan the parent state invalid';
  end if;
  select count(*) into active_type_count
  from public.db_record_types type_item
  where type_item.category_id = parent_category.id and type_item.active;
  if active_type_count <> 0 then raise exception 'Doan the parent must not have active types'; end if;
  select count(*) into child_count
  from public.db_categories child_category
  where child_category.parent_id = parent_category.id
    and child_category.code in ('cong_tac_dang', 'chi_hoi_nha_bao', 'cong_doan', 'doan_thanh_nien', 'cuc_bao_chi', 'lien_hiep', 'phap_ly_dieu_hanh');
  if child_count <> 7 then raise exception 'Expected exactly 7 Doan the children, got %', child_count; end if;
  if (select count(*) from public.db_categories child_category where child_category.parent_id = parent_category.id) <> 7 then
    raise exception 'Doan the parent has unexpected children';
  end if;
  if (select count(*)
      from public.db_categories child_category
      where child_category.parent_id in (select category.id from public.db_categories category where category.code in
        ('cong_tac_dang', 'chi_hoi_nha_bao', 'cong_doan', 'doan_thanh_nien', 'cuc_bao_chi', 'lien_hiep', 'phap_ly_dieu_hanh'))) <> 0 then
    raise exception 'Doan the children must remain leaf categories';
  end if;
  if (select count(*) from public.db_categories child_category
      where child_category.parent_id = parent_category.id and child_category.active) <> 7 then
    raise exception 'All Doan the children must remain active';
  end if;
  for record_item in
    select category.code, category.restricted, count(type_item.id) filter (where type_item.active) as active_type_count
    from public.db_categories category
    left join public.db_record_types type_item on type_item.category_id = category.id
    where category.code in
      ('cong_tac_dang', 'chi_hoi_nha_bao', 'cong_doan', 'doan_thanh_nien', 'cuc_bao_chi', 'lien_hiep', 'phap_ly_dieu_hanh')
    group by category.code, category.restricted
  loop
    if record_item.code in ('cong_tac_dang', 'chi_hoi_nha_bao', 'cong_doan', 'doan_thanh_nien', 'cuc_bao_chi', 'lien_hiep')
      and not record_item.restricted then
      raise exception 'Restricted flag changed for %', record_item.code;
    end if;
    if record_item.code = 'phap_ly_dieu_hanh' and record_item.restricted then
      raise exception 'Restricted flag changed for phap_ly_dieu_hanh';
    end if;
    if record_item.active_type_count <> (case record_item.code
      when 'cong_tac_dang' then 10 when 'chi_hoi_nha_bao' then 5 when 'cong_doan' then 5 when 'doan_thanh_nien' then 1
      when 'cuc_bao_chi' then 4 when 'lien_hiep' then 6 when 'phap_ly_dieu_hanh' then 3 end) then
      raise exception 'Active type count changed for %', record_item.code;
    end if;
  end loop;
end
$assert$;

notify pgrst, 'reload schema';
commit;
