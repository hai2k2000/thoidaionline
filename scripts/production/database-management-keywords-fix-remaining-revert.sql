-- Only use after applying 20261103140000_database_management_v1_keywords_fix_remaining.sql.
begin;

create temporary table keyword_revert_targets (record_type_id uuid primary key, type_code text not null) on commit drop;
insert into keyword_revert_targets (record_type_id, type_code)
select record_type.id, record_type.code
from public.db_record_types record_type
join public.db_categories category on category.id = record_type.category_id
where record_type.active and category.code in ('chi_hoi_nha_bao', 'doan_thanh_nien', 'cuc_bao_chi');

do $revert$
declare
  target_item record;
  current_form public.db_form_definitions%rowtype;
  previous_form_id uuid;
  processed_count integer := 0;
begin
  for target_item in select * from keyword_revert_targets loop
    select published_form.* into current_form
    from public.db_form_definitions published_form
    where published_form.record_type_id = target_item.record_type_id and published_form.status = 'published'
    order by published_form.version desc
    limit 1;
    if current_form.id is null then
      raise exception 'Published form missing for %', target_item.type_code;
    end if;
    select candidate_form.id into previous_form_id
    from public.db_form_definitions candidate_form
    where candidate_form.record_type_id = target_item.record_type_id and candidate_form.version < current_form.version
    order by candidate_form.version desc
    limit 1;
    if previous_form_id is null then
      raise exception 'Previous form missing for %', target_item.type_code;
    end if;
    update public.db_form_definitions set status = 'retired'
    where record_type_id = target_item.record_type_id and status = 'published';
    update public.db_form_definitions set status = 'published' where id = previous_form_id;
    processed_count := processed_count + 1;
  end loop;
  if processed_count <> 10 then
    raise exception 'Expected exactly 10 reverted types, got %', processed_count;
  end if;
end
$revert$;

do $assert$
begin
  if exists (
    select target_type.record_type_id
    from keyword_revert_targets target_type
    left join public.db_form_definitions published_form
      on published_form.record_type_id = target_type.record_type_id and published_form.status = 'published'
    group by target_type.record_type_id
    having count(published_form.id) <> 1
  ) then
    raise exception 'Each reverted type must have exactly one published form';
  end if;
end
$assert$;

notify pgrst, 'reload schema';
commit;
