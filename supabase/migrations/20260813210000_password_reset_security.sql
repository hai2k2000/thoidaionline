create extension if not exists pgcrypto;

do $$
begin
  if (select count(*) from public.staff_users where lower(username) = 'thanhhai') <> 1 then
    raise exception 'Expected exactly one thanhhai account';
  end if;
  update public.staff_users set email = 'hai.baothoidai@gmail.com' where lower(username) = 'thanhhai';
end;
$$;

alter table public.staff_users add column if not exists password_hash text;
update public.staff_users
set password_hash = crypt(password, gen_salt('bf', 12))
where coalesce(password_hash, '') = ''
  and password is not null
  and password !~ '^\$2[aby]\$';
alter table public.staff_users alter column password drop not null;
update public.staff_users set password = null where password_hash is not null;
alter table public.staff_users alter column password drop default;

create or replace function public.ensure_staff_password_hash()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.password_hash is null or new.password_hash = '' then
    new.password_hash := crypt('123456', gen_salt('bf', 12));
  end if;
  new.password := null;
  return new;
end;
$$;
drop trigger if exists trg_staff_users_password_hash on public.staff_users;
create trigger trg_staff_users_password_hash before insert or update of password,password_hash on public.staff_users
for each row execute function public.ensure_staff_password_hash();

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_password_reset_tokens_user_created on public.password_reset_tokens(user_id, created_at desc);
create index if not exists idx_password_reset_tokens_expiry on public.password_reset_tokens(expires_at) where used_at is null;
alter table public.password_reset_tokens enable row level security;

create table if not exists public.password_reset_attempts (
  id bigserial primary key,
  fingerprint_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_password_reset_attempts_fingerprint_created on public.password_reset_attempts(fingerprint_hash, created_at desc);
alter table public.password_reset_attempts enable row level security;

create or replace function public.consume_password_reset(p_token_hash text, p_password_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id uuid;
begin
  update public.password_reset_tokens
     set used_at = now()
   where token_hash = p_token_hash
     and used_at is null
     and expires_at > now()
  returning user_id into v_user_id;
  if v_user_id is null then return false; end if;
  update public.staff_users set password_hash = p_password_hash, password = null where id = v_user_id and active = true;
  if not found then return false; end if;
  return true;
end;
$$;
revoke all on function public.consume_password_reset(text, text) from public;
