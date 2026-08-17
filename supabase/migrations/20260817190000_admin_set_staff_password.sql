create or replace function public.admin_set_staff_password(
  p_actor_id uuid,
  p_user_id uuid,
  p_password_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_admin boolean;
  target_is_active boolean;
begin
  if p_actor_id is null or p_user_id is null or p_actor_id = p_user_id then
    return false;
  end if;

  select exists (
    select 1
      from public.staff_users actor
      join public.roles on roles.id = actor.role_id
     where actor.id = p_actor_id
       and actor.active = true
       and roles.code = 'admin'
  ) into actor_is_admin;
  if not actor_is_admin then return false; end if;

  select exists (
    select 1 from public.staff_users
     where id = p_user_id and active = true
  ) into target_is_active;
  if not target_is_active then return false; end if;

  if p_password_hash is null
     or p_password_hash !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$' then
    return false;
  end if;

  update public.staff_users
     set password_hash = p_password_hash,
         password = null,
         session_version = session_version + 1
   where id = p_user_id
     and active = true;
  if not found then return false; end if;

  update public.password_reset_tokens
     set used_at = coalesce(used_at, now())
   where user_id = p_user_id
     and used_at is null;

  insert into public.audit_logs (
    actor_id, module, entity_type, entity_id, action, old_data, new_data
  ) values (
    p_actor_id,
    'admin',
    'staff_user',
    p_user_id,
    'admin_password_set',
    null,
    jsonb_build_object(
      'status', 'completed',
      'sessions_revoked', true,
      'reset_tokens_invalidated', true
    )
  );

  return true;
end;
$$;

revoke all on function public.admin_set_staff_password(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_set_staff_password(uuid, uuid, text)
  to service_role;
