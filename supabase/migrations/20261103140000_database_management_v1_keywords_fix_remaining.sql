begin;

create temporary table keyword_fix_targets (record_type_id uuid primary key, type_code text not null) on commit drop;
insert into keyword_fix_targets (record_type_id, type_code)
select record_type.id, record_type.code
from public.db_record_types record_type
join public.db_categories category on category.id = record_type.category_id
where record_type.active and category.code in ('chi_hoi_nha_bao', 'doan_thanh_nien', 'cuc_bao_chi');

do $migration$
declare
  target_item record;
  source_form public.db_form_definitions%rowtype;
  new_form_id uuid;
  next_form_version integer;
  processed_count integer := 0;
begin
  for target_item in select * from keyword_fix_targets loop
    select published_form.* into source_form
    from public.db_form_definitions published_form
    where published_form.record_type_id = target_item.record_type_id and published_form.status = 'published'
    order by published_form.version desc
    limit 1;
    if source_form.id is null then
      raise exception 'Published source form missing for %', target_item.type_code;
    end if;

    select coalesce(max(version),0)+1 into next_form_version
    from public.db_form_definitions where record_type_id = target_item.record_type_id;
    update public.db_form_definitions set status = 'retired'
    where record_type_id = target_item.record_type_id and status = 'published';
    insert into public.db_form_definitions (record_type_id, version, status, search_config, display_config)
    values (target_item.record_type_id, next_form_version, 'published', source_form.search_config, source_form.display_config)
    returning id into new_form_id;

    insert into public.db_form_fields (
      form_definition_id, field_key, label, data_type, required, searchable, options, validation, hidden, sort_order
    )
    select new_form_id, source_field.field_key, source_field.label, source_field.data_type, source_field.required,
      source_field.searchable, source_field.options, source_field.validation, source_field.hidden, source_field.sort_order
    from public.db_form_fields source_field where source_field.form_definition_id = source_form.id;

    update public.db_form_fields
    set data_type = 'text', options = '[]'::jsonb, validation = '{"maxLength":500}'::jsonb, hidden = false, required = false
    where form_definition_id = new_form_id and field_key = 'keywords';
    update public.db_form_fields set hidden = true, required = false
    where form_definition_id = new_form_id and field_key = 'record_code';
    update public.db_form_fields set hidden = false, required = false
    where form_definition_id = new_form_id and field_key = 'status';
    processed_count := processed_count + 1;
  end loop;
  if processed_count <> 10 then
    raise exception 'Expected exactly 10 processed types, got %', processed_count;
  end if;
end
$migration$;

do $assert$
declare
  published_item record;
begin
  if (select count(*) from keyword_fix_targets) <> 10 then
    raise exception 'Expected exactly 10 target types';
  end if;
  if exists (
    select target_type.record_type_id
    from keyword_fix_targets target_type
    left join public.db_form_definitions published_form
      on published_form.record_type_id = target_type.record_type_id and published_form.status = 'published'
    group by target_type.record_type_id
    having count(published_form.id) <> 1
  ) then
    raise exception 'Each target type must have exactly one published form';
  end if;

  for published_item in
    select published_form.id, target_type.type_code
    from keyword_fix_targets target_type
    join public.db_form_definitions published_form on published_form.record_type_id = target_type.record_type_id
    where published_form.status = 'published'
  loop
    if not exists (
      select 1 from public.db_form_fields form_field
      where form_field.form_definition_id = published_item.id and form_field.field_key = 'keywords'
        and form_field.data_type = 'text' and form_field.options = '[]'::jsonb
        and form_field.validation = '{"maxLength":500}'::jsonb and not form_field.hidden and not form_field.required
    ) then
      raise exception 'Keywords field invalid for %', published_item.type_code;
    end if;
    if not exists (
      select 1 from public.db_form_fields form_field
      where form_field.form_definition_id = published_item.id and form_field.field_key = 'record_code'
        and form_field.hidden and not form_field.required
    ) then
      raise exception 'Record code field invalid for %', published_item.type_code;
    end if;
    if not exists (
      select 1 from public.db_form_fields form_field
      where form_field.form_definition_id = published_item.id and form_field.field_key = 'status'
        and not form_field.hidden and not form_field.required
    ) then
      raise exception 'Status field invalid for %', published_item.type_code;
    end if;
    if not exists (
      select 1 from public.db_form_fields form_field
      where form_field.form_definition_id = published_item.id and form_field.field_key = 'title' and form_field.required
    ) or exists (
      select 1 from public.db_form_fields form_field
      where form_field.form_definition_id = published_item.id and form_field.field_key <> 'title' and form_field.required
    ) then
      raise exception 'Only title must be required for %', published_item.type_code;
    end if;
  end loop;

  if exists (
    select 1 from public.db_form_fields form_field
    join public.db_form_definitions published_form on published_form.id = form_field.form_definition_id
    join public.db_record_types record_type on record_type.id = published_form.record_type_id
    where record_type.active and published_form.status = 'published' and not form_field.hidden
      and form_field.data_type = 'multi_select' and form_field.options = '[]'::jsonb
  ) then
    raise exception 'Visible empty multi_select remains in a published form for an active type';
  end if;
end
$assert$;

notify pgrst, 'reload schema';
commit;
