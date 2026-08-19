-- Durable staff list ordering.  Zero keeps the existing hierarchy; positive
-- values pin rows below all normal rows and define their order among pins.
alter table public.staff_users
  add column if not exists list_order integer not null default 0;

do $$
declare
  target record;
  staff_row record;
  old_metadata jsonb;
  new_metadata jsonb;
begin
  -- Full names are business identifiers for this optional one-time seed.
  -- Skip absent or ambiguous tenant rows rather than blocking the schema.
  for target in
    select * from (values
      ('Đoàn Thanh Hải'::text, 1),
      ('Hoàng Quỳnh Trang'::text, 2),
      ('Vũ Mai Anh'::text, 3)
    ) as requested(full_name, desired_order)
  loop
    select id, list_order, role_id, job_title_id, department_id, active
      into staff_row
      from public.staff_users
      where full_name = target.full_name
        and (select count(*) from public.staff_users where full_name = target.full_name) = 1;

    if not found then
      continue;
    end if;

    old_metadata := jsonb_build_object(
      'full_name', target.full_name,
      'list_order', staff_row.list_order,
      'role_id', staff_row.role_id,
      'job_title_id', staff_row.job_title_id,
      'department_id', staff_row.department_id,
      'active', staff_row.active
    );

    if staff_row.list_order is distinct from target.desired_order then
      update public.staff_users
         set list_order = target.desired_order
       where id = staff_row.id;

      new_metadata := jsonb_build_object(
        'full_name', target.full_name,
        'list_order', target.desired_order,
        'role_id', staff_row.role_id,
        'job_title_id', staff_row.job_title_id,
        'department_id', staff_row.department_id,
        'active', staff_row.active
      );

      if to_regclass('public.audit_logs') is not null then
        insert into public.audit_logs (actor_id, module, entity_type, entity_id, action, old_data, new_data)
        values (null, 'staff_users', 'staff_user', staff_row.id, 'pin_to_bottom', old_metadata, new_metadata);
      end if;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.staff_users'::regclass
       and conname = 'staff_users_list_order_nonnegative'
  ) then
    alter table public.staff_users
      add constraint staff_users_list_order_nonnegative check (list_order >= 0);
  end if;
end;
$$;

create index if not exists staff_users_list_order_idx on public.staff_users(list_order);
