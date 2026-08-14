revoke truncate, references, trigger, maintain
  on table public.audit_logs
  from anon, authenticated;

drop policy if exists protect_password_reset_audit_insert on public.audit_logs;
create policy protect_password_reset_audit_insert
  on public.audit_logs
  as restrictive
  for insert
  to anon, authenticated
  with check (action <> 'password_reset');

drop policy if exists protect_password_reset_audit_update on public.audit_logs;
create policy protect_password_reset_audit_update
  on public.audit_logs
  as restrictive
  for update
  to anon, authenticated
  using (action <> 'password_reset')
  with check (action <> 'password_reset');

drop policy if exists protect_password_reset_audit_delete on public.audit_logs;
create policy protect_password_reset_audit_delete
  on public.audit_logs
  as restrictive
  for delete
  to anon, authenticated
  using (action <> 'password_reset');

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
  token_user_id uuid;
begin
  if p_status not in ('sent', 'failed') then
    raise exception using errcode = '22023', message = 'Invalid audit status';
  end if;

  select entity_id into target_user_id
    from public.audit_logs
   where id = p_audit_id
     and module = 'admin'
     and entity_type = 'staff_user'
     and action = 'password_reset'
     and new_data->>'status' = 'pending'
   for update;

  if target_user_id is null then return false; end if;

  select user_id into token_user_id
    from public.password_reset_tokens
   where id = p_token_id
     and used_at is null
   for update;

  if token_user_id is distinct from target_user_id then return false; end if;

  if p_status = 'failed' then
    update public.password_reset_tokens
       set used_at = now()
     where id = p_token_id
       and user_id = target_user_id
       and used_at is null;
    if not found then return false; end if;
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
     and new_data->>'status' = 'pending';

  if not found then return false; end if;
  return true;
end;
$$;

revoke all on function public.finalize_admin_password_reset(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.finalize_admin_password_reset(uuid, uuid, text)
  to service_role;
