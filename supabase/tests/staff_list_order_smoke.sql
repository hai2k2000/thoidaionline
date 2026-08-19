-- Read-only smoke checks for the durable staff ordering migration.
do $$
declare
  target record;
  matched_count integer;
  ordered_names text[];
  staff_row record;
begin
  for target in
    select * from (values
      ('Đoàn Thanh Hải'::text, 1),
      ('Hoàng Quỳnh Trang'::text, 2),
      ('Vũ Mai Anh'::text, 3)
    ) as requested(full_name, desired_order)
  loop
    select count(*) into matched_count from public.staff_users where full_name = target.full_name;
    if matched_count <> 1 then
      raise exception 'Expected one exact staff user for %, found %', target.full_name, matched_count;
    end if;
    select list_order, role_id, job_title_id, department_id, active into staff_row
      from public.staff_users where full_name = target.full_name;
    if staff_row.list_order <> target.desired_order then
      raise exception 'Unexpected list_order for %', target.full_name;
    end if;
  end loop;

  select array_agg(full_name order by case when list_order > 0 then 1 else 0 end, list_order, full_name)
    into ordered_names from public.staff_users;
  if ordered_names[array_length(ordered_names, 1) - 2] <> 'Đoàn Thanh Hải'
     or ordered_names[array_length(ordered_names, 1) - 1] <> 'Hoàng Quỳnh Trang'
     or ordered_names[array_length(ordered_names, 1)] <> 'Vũ Mai Anh' then
    raise exception 'Pinned staff are not the final three rows in order';
  end if;

  if to_regclass('public.audit_logs') is not null and exists (
    select 1 from public.audit_logs
     where module = 'staff_users' and action = 'pin_to_bottom'
       and (
         old_data->>'role_id' is distinct from new_data->>'role_id'
         or old_data->>'job_title_id' is distinct from new_data->>'job_title_id'
         or old_data->>'department_id' is distinct from new_data->>'department_id'
         or old_data->>'active' is distinct from new_data->>'active'
       )
  ) then
    raise exception 'Pin migration changed role, job title, department, or active metadata';
  end if;
end;
$$;

select 'staff_list_order_smoke ok' as result;
