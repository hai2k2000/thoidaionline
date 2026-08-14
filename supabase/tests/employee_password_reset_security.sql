begin;

do $$
declare
  role_id_value uuid := '00000000-0000-4000-8000-000000000001';
  department_id_value uuid := '00000000-0000-4000-8000-000000000002';
  actor_id_value uuid := '00000000-0000-4000-8000-000000000003';
  version_before bigint;
  old_hash text := encode(digest('employee-reset-old-token-fixture', 'sha256'), 'hex');
  new_hash text := encode(digest('employee-reset-new-token-fixture', 'sha256'), 'hex');
  fixture_password_hash text := crypt(
    encode(digest('employee-reset-fixture-password', 'sha256'), 'hex'),
    '$2a$04$abcdefghijklmnopqrstuu'
  );
  prepared record;
  consumed boolean;
begin
  insert into public.roles (id, code, name, level)
  values (role_id_value, 'admin', 'Synthetic Admin', 1);

  insert into public.departments (id, code, name, active)
  values (department_id_value, 'fixture', 'Synthetic Department', true);

  insert into public.staff_users (
    id, full_name, email, phone, password, password_hash,
    role_id, department_id, active
  ) values (
    actor_id_value,
    'Synthetic Reset Admin',
    'reset-admin@example.invalid',
    null,
    null,
    fixture_password_hash,
    role_id_value,
    department_id_value,
    true
  );

  select session_version into version_before
    from public.staff_users
   where id = actor_id_value;

  insert into public.password_reset_tokens (user_id, token_hash, expires_at)
  values (actor_id_value, old_hash, now() + interval '60 minutes');

  select * into prepared
    from public.prepare_admin_password_reset(
      actor_id_value,
      actor_id_value,
      new_hash,
      now() + interval '60 minutes'
    );

  if prepared.token_id is null or prepared.audit_id is null then
    raise exception 'Prepare did not return token and audit ids';
  end if;

  if exists (
    select 1 from public.password_reset_tokens
     where token_hash = old_hash and used_at is null
  ) then
    raise exception 'Older reset token remains active';
  end if;

  if not exists (
    select 1 from public.audit_logs
     where id = prepared.audit_id
       and audit_logs.actor_id = actor_id_value
       and action = 'password_reset'
       and new_data->>'status' = 'pending'
  ) then
    raise exception 'Pending audit was not created';
  end if;

  if not public.finalize_admin_password_reset(
    prepared.token_id,
    prepared.audit_id,
    'sent'
  ) then
    raise exception 'Audit finalization failed';
  end if;

  select public.consume_password_reset(
    new_hash,
    fixture_password_hash
  ) into consumed;

  if consumed is not true then
    raise exception 'Prepared token was not consumed';
  end if;

  if (select session_version from public.staff_users where id = actor_id_value)
     <> version_before + 1 then
    raise exception 'Session version was not incremented exactly once';
  end if;

  if public.consume_password_reset(
    new_hash,
    fixture_password_hash
  ) then
    raise exception 'Token was consumed twice';
  end if;
end;
$$;

rollback;
select 'employee_password_reset_security ok' as result;
