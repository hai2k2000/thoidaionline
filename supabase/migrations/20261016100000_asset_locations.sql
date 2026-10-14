begin;

create table if not exists public.asset_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.asset_locations (code, name)
values
  ('phong_tong_bien_tap', 'Phòng Tổng biên tập'),
  ('phong_pho_tong_bien_tap', 'Phòng Phó Tổng biên tập'),
  ('phong_hop', 'Phòng họp')
on conflict (code) do update set name = excluded.name, active = true, updated_at = now();

alter table public.assets add column if not exists location_id uuid references public.asset_locations(id);
create index if not exists assets_location_id_idx on public.assets(location_id);

alter table public.asset_locations enable row level security;
revoke all privileges on table public.asset_locations from public, anon, authenticated;
grant select on table public.asset_locations to service_role;

commit;
