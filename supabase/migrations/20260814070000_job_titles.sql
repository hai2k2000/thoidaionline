-- Job-title catalog is intentionally separate from roles.  roles.code remains
-- the authorization boundary and is not changed by this migration.
create table if not exists public.job_titles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  display_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_titles_code_format check (code ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  constraint job_titles_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint job_titles_display_order check (display_order between 0 and 100000)
);
create unique index if not exists job_titles_code_lower_uidx on public.job_titles (lower(code));
create unique index if not exists job_titles_name_lower_uidx on public.job_titles (lower(btrim(name)));
alter table public.job_titles enable row level security;
drop policy if exists "public read job_titles" on public.job_titles;
drop policy if exists "public write job_titles" on public.job_titles;
create policy "public read job_titles" on public.job_titles for select to anon using (true);
revoke insert, update, delete, truncate on public.job_titles from anon, authenticated;

alter table public.staff_users add column if not exists job_title_id uuid references public.job_titles(id);
create index if not exists staff_users_job_title_id_idx on public.staff_users(job_title_id);

insert into public.job_titles (code, name, display_order, active)
values
  ('tong_bien_tap', 'Tổng biên tập', 10, true),
  ('pho_tong_bien_tap', 'Phó tổng biên tập', 20, true),
  ('truong_phong', 'Trưởng phòng', 30, true),
  ('pho_truong_phong', 'Phó trưởng phòng', 40, true),
  ('ke_toan_truong', 'Kế toán trưởng', 50, true),
  ('phong_vien', 'Phóng viên', 60, true),
  ('nhan_vien', 'Nhân viên', 70, true)
on conflict do nothing;

-- Both TBT authorization roles intentionally map to the same display title.
update public.staff_users su
set job_title_id = jt.id
from public.roles r
join public.job_titles jt on jt.code = case when r.code = 'tbt_read_only' then 'tong_bien_tap' else r.code end
where su.role_id = r.id and su.job_title_id is null;

create or replace function public.touch_job_titles_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists job_titles_set_updated_at on public.job_titles;
create trigger job_titles_set_updated_at before update on public.job_titles
for each row execute function public.touch_job_titles_updated_at();

-- Existing staff_users policies predate this feature.  Preserve their role
-- semantics, but force this new field through the guarded server API.
create or replace function public.guard_staff_job_title_write()
returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') and
     (tg_op = 'INSERT' or new.job_title_id is distinct from old.job_title_id) then
    raise insufficient_privilege using message = 'job_title_id is server-managed';
  end if;
  return new;
end;
$$;
drop trigger if exists staff_users_guard_job_title_write on public.staff_users;
create trigger staff_users_guard_job_title_write before insert or update of job_title_id on public.staff_users
for each row execute function public.guard_staff_job_title_write();
