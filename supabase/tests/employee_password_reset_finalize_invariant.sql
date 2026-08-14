begin;

do $$
declare
  role_id_value uuid := gen_random_uuid();
  department_id_value uuid := gen_random_uuid();
  actor_id_value uuid := gen_random_uuid();
  first_target_id uuid := gen_random_uuid();
  second_target_id uuid := gen_random_uuid();
  first_hash text := encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
  second_hash text := encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
  prepared_first record;
  prepared_second record;
begin
  insert into public.roles (id, code, name, level)
  values (role_id_value, 'admin', 'Hardening Admin', 1);

  insert into public.departments (id, code, name, active)
  values (department_id_value, 'hardening_department', 'Hardening Department', true);

  insert into public.staff_users (
    id, full_name, email, phone, password, password_hash,
    role_id, department_id, active
  ) values
  (
    actor_id_value,
    'Hardening Actor',
    'hardening-actor@example.invalid',
    null,
    null,
    crypt(gen_random_uuid()::text, gen_salt('bf', 4)),
    role_id_value,
    department_id_value,
    true
  ),
  (
    first_target_id,
    'Hardening Target One',
    'hardening-target-one@example.invalid',
    null,
    null,
    crypt(gen_random_uuid()::text, gen_salt('bf', 4)),
    role_id_value,
    department_id_value,
    true
  ),
  (
    second_target_id,
    'Hardening Target Two',
    'hardening-target-two@example.invalid',
    null,
    null,
    crypt(gen_random_uuid()::text, gen_salt('bf', 4)),
    role_id_value,
    department_id_value,
    true
  );

  select * into prepared_first
    from public.prepare_admin_password_reset(
      actor_id_value,
      first_target_id,
      first_hash,
      now() + interval '60 minutes'
    );

  select * into prepared_second
    from public.prepare_admin_password_reset(
      actor_id_value,
      second_target_id,
      second_hash,
      now() + interval '60 minutes'
    );

  if public.finalize_admin_password_reset(
    prepared_second.token_id,
    prepared_first.audit_id,
    'failed'
  ) then
    raise exception 'finalize accepted a token owned by another audit target';
  end if;

  if not exists (
    select 1 from public.audit_logs
     where id = prepared_first.audit_id
       and new_data->>'status' = 'pending'
  ) then
    raise exception 'ownership mismatch changed the pending audit';
  end if;

  if not exists (
    select 1 from public.password_reset_tokens
     where id = prepared_first.token_id
       and used_at is null
  ) then
    raise exception 'ownership mismatch changed the matching token';
  end if;

  if not public.finalize_admin_password_reset(
    prepared_first.token_id,
    prepared_first.audit_id,
    'failed'
  ) then
    raise exception 'matching failed delivery did not finalize';
  end if;

  if exists (
    select 1 from public.password_reset_tokens
     where id = prepared_first.token_id
       and used_at is null
  ) then
    raise exception 'failed delivery left the matching token usable';
  end if;

  if not exists (
    select 1 from public.audit_logs
     where id = prepared_first.audit_id
       and new_data->>'status' = 'failed'
  ) then
    raise exception 'failed delivery did not update audit status';
  end if;
end;
$$;

rollback;
select 'employee_password_reset_finalize_invariant ok' as result;
