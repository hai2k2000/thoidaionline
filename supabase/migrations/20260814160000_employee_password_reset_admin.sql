alter table public.staff_users
  add column if not exists session_version bigint not null default 0;
alter table public.staff_users
  alter column session_version set default 0;
update public.staff_users set session_version = 0 where session_version is null;
alter table public.staff_users
  alter column session_version set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.staff_users'::regclass
       and conname = 'staff_users_session_version_nonnegative'
  ) then
    alter table public.staff_users
      add constraint staff_users_session_version_nonnegative
      check (session_version >= 0);
  end if;
end;
$$;

create or replace function public.prepare_admin_password_reset(
  p_actor_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns table(token_id uuid, audit_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_token_id uuid;
  created_audit_id uuid;
begin
  if not exists (
    select 1
      from public.staff_users actor
      join public.roles actor_role on actor_role.id = actor.role_id
     where actor.id = p_actor_id
       and actor.active = true
       and actor_role.code = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Admin required';
  end if;

  perform 1
    from public.staff_users target
   where target.id = p_user_id
     and target.active = true
     and nullif(btrim(target.email), '') is not null
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Target unavailable';
  end if;

  if p_token_hash !~ '^[0-9a-f]{64}$'
     or p_expires_at <= now()
     or p_expires_at > now() + interval '61 minutes' then
    raise exception using errcode = '22023', message = 'Invalid reset parameters';
  end if;

  update public.password_reset_tokens
     set used_at = coalesce(used_at, now())
   where user_id = p_user_id
     and used_at is null;

  insert into public.password_reset_tokens (user_id, token_hash, expires_at)
  values (p_user_id, p_token_hash, p_expires_at)
  returning id into created_token_id;

  insert into public.audit_logs (
    actor_id, module, entity_type, entity_id, action, old_data, new_data
  ) values (
    p_actor_id,
    'admin',
    'staff_user',
    p_user_id,
    'password_reset',
    null,
    jsonb_build_object(
      'event', 'employee_password_reset_email',
      'channel', 'email',
      'status', 'pending'
    )
  ) returning id into created_audit_id;

  return query select created_token_id, created_audit_id;
end;
$$;

create or replace function public.finalize_admin_password_reset(
  p_token_id uuid,
  p_audit_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  if p_status not in ('sent', 'failed') then
    raise exception using errcode = '22023', message = 'Invalid audit status';
  end if;

  update public.audit_logs
     set new_data = jsonb_set(
       coalesce(new_data, '{}'::jsonb),
       '{status}',
       to_jsonb(p_status),
       true
     ) || case
       when p_status = 'failed'
       then jsonb_build_object('failure_code', 'delivery_failed')
       else '{}'::jsonb
     end
   where id = p_audit_id
     and module = 'admin'
     and entity_type = 'staff_user'
     and action = 'password_reset'
     and new_data->>'status' = 'pending'
  returning entity_id into target_user_id;

  if target_user_id is null then return false; end if;

  if p_status = 'failed' then
    update public.password_reset_tokens
       set used_at = coalesce(used_at, now())
     where id = p_token_id
       and user_id = target_user_id;
  end if;

  return true;
end;
$$;

create or replace function public.consume_password_reset(
  p_token_hash text,
  p_password_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reset_user_id uuid;
begin
  update public.password_reset_tokens
     set used_at = now()
   where token_hash = p_token_hash
     and used_at is null
     and expires_at > now()
  returning user_id into reset_user_id;

  if reset_user_id is null then return false; end if;

  update public.staff_users
     set password_hash = p_password_hash,
         password = null,
         session_version = session_version + 1
   where id = reset_user_id
     and active = true;
  if not found then return false; end if;

  update public.password_reset_tokens
     set used_at = coalesce(used_at, now())
   where user_id = reset_user_id
     and used_at is null;

  return true;
end;
$$;

revoke all on function public.prepare_admin_password_reset(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.finalize_admin_password_reset(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.consume_password_reset(text, text)
  from public, anon, authenticated;

grant execute on function public.prepare_admin_password_reset(uuid, uuid, text, timestamptz)
  to service_role;
grant execute on function public.finalize_admin_password_reset(uuid, uuid, text)
  to service_role;
grant execute on function public.consume_password_reset(text, text)
  to service_role;
