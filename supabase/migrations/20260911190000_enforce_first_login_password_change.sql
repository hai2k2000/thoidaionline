begin;

alter table public.staff_users
  add column if not exists must_change_password boolean not null default false;

update public.staff_users
set must_change_password = true,
    session_version = session_version + 1
where active = true
  and lower(coalesce(username, '')) <> 'admin'
  and password_hash is not null
  and extensions.crypt('Thoidai@123456', password_hash) = password_hash;

create or replace function public.ensure_staff_password_hash()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
begin
  if new.password_hash is null or new.password_hash = '' then
    new.password_hash := extensions.crypt('Thoidai@123456', extensions.gen_salt('bf', 12));
    new.must_change_password := true;
  end if;
  new.password := null;
  return new;
end;
$function$;

alter function public.ensure_staff_password_hash() owner to postgres;

create or replace function public.consume_password_reset(p_token_hash text, p_password_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare reset_user_id uuid;
begin
  update public.password_reset_tokens set used_at = now()
  where token_hash = p_token_hash and used_at is null and expires_at > now()
  returning user_id into reset_user_id;
  if reset_user_id is null then return false; end if;
  update public.staff_users set password_hash=p_password_hash,password=null,must_change_password=false,session_version=session_version+1
  where id=reset_user_id and active=true;
  if not found then return false; end if;
  update public.password_reset_tokens set used_at=coalesce(used_at,now()) where user_id=reset_user_id and used_at is null;
  return true;
end;
$$;

create or replace function public.admin_set_staff_password(p_actor_id uuid, p_user_id uuid, p_password_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare actor_is_admin boolean; target_is_active boolean;
begin
  if p_actor_id is null or p_user_id is null or p_actor_id = p_user_id then return false; end if;
  select exists(select 1 from public.staff_users actor join public.roles on roles.id=actor.role_id where actor.id=p_actor_id and actor.active=true and roles.code='admin') into actor_is_admin;
  if not actor_is_admin then return false; end if;
  select exists(select 1 from public.staff_users where id=p_user_id and active=true) into target_is_active;
  if not target_is_active or p_password_hash is null or p_password_hash !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$' then return false; end if;
  update public.staff_users set password_hash=p_password_hash,password=null,must_change_password=true,session_version=session_version+1 where id=p_user_id and active=true;
  if not found then return false; end if;
  update public.password_reset_tokens set used_at=coalesce(used_at,now()) where user_id=p_user_id and used_at is null;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'admin','staff_user',p_user_id,'admin_password_set',null,jsonb_build_object('status','completed','sessions_revoked',true,'reset_tokens_invalidated',true,'must_change_password',true));
  return true;
end;
$$;

commit;
