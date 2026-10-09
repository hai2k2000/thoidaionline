begin;

-- Asset V2 keeps custody/history in asset_assignments. The legacy department
-- column on assets is maintained only as a compatibility projection.
insert into public.permissions (code, name, module, description)
values
  ('asset.view', 'Xem tài sản', 'assets', 'Xem tài sản theo phạm vi cá nhân/phòng ban.'),
  ('asset.manage', 'Quản lý tài sản', 'assets', 'Tạo, sửa và quản lý vòng đời tài sản toàn cơ quan.')
on conflict (code) do update set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description,
  updated_at = now();

with compatibility_grants (role_code, permission_code, scope) as (
  values
    ('admin', 'asset.view', 'all'),
    ('admin', 'asset.manage', 'all'),
    ('tong_bien_tap', 'asset.view', 'all'),
    ('pho_tong_bien_tap', 'asset.view', 'all'),
    ('truong_phong', 'asset.view', 'department'),
    ('pho_truong_phong', 'asset.view', 'department'),
    ('phong_vien', 'asset.view', 'assigned'),
    ('nhan_vien', 'asset.view', 'assigned'),
    ('bien_tap_vien', 'asset.view', 'assigned'),
    ('tri_su', 'asset.view', 'assigned')
)
insert into public.role_permission_grants (role_id, permission_id, scope)
select r.id, p.id, c.scope
from compatibility_grants c
join public.roles r on r.code = c.role_code and r.active = true
join public.permissions p on p.code = c.permission_code
on conflict (role_id, permission_id, scope) do nothing;

create unique index if not exists asset_assignments_one_current_idx
  on public.asset_assignments (asset_id)
  where status = 'active' and returned_at is null;

do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'asset_assignments_current_department_required'
      and conrelid = 'public.asset_assignments'::regclass
  ) then
    alter table public.asset_assignments
      add constraint asset_assignments_current_department_required
      check (status <> 'active' or returned_at is not null or department_id is not null);
  end if;
end
$constraint$;

create or replace function public.asset_assignment_history_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Asset assignment history cannot be deleted.' using errcode = '42501';
  end if;
  if old.returned_at is not null or old.status <> 'active' then
    raise exception 'Closed asset assignment history is immutable.' using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists asset_assignment_history_guard on public.asset_assignments;
create trigger asset_assignment_history_guard
before update or delete on public.asset_assignments
for each row execute function public.asset_assignment_history_guard();

create or replace function public.asset_actor_can_manage(p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.staff_users u
    join public.roles r on r.id = u.role_id and r.active = true
    join public.role_permission_grants g on g.role_id = r.id
    join public.permissions p on p.id = g.permission_id and p.code = 'asset.manage'
    where u.id = p_actor_id and u.active = true
  ) or exists (
    select 1
    from public.staff_users u
    join public.user_permission_grants g on g.user_id = u.id
    join public.permissions p on p.id = g.permission_id and p.code = 'asset.manage'
    where u.id = p_actor_id and u.active = true
  );
$function$;

create or replace function public.asset_validate_destination(
  p_department_id uuid,
  p_assignee_id uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if p_department_id is null or not exists (
    select 1 from public.departments d where d.id = p_department_id and d.active = true
  ) then
    raise exception 'Active department is required.' using errcode = '22023';
  end if;
  if p_assignee_id is not null and not exists (
    select 1
    from public.staff_users u
    where u.id = p_assignee_id and u.active = true and u.department_id = p_department_id
  ) then
    raise exception 'Assignee must be an active employee in the selected department.' using errcode = '22023';
  end if;
end;
$function$;

create or replace function public.api_asset_assign(
  p_actor_id uuid,
  p_asset_id uuid,
  p_department_id uuid,
  p_assignee_id uuid default null,
  p_expected_return_at timestamptz default null,
  p_handover_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_asset public.assets%rowtype;
  v_assignment public.asset_assignments%rowtype;
begin
  if not public.asset_actor_can_manage(p_actor_id) then
    raise exception 'Forbidden.' using errcode = '42501';
  end if;
  perform public.asset_validate_destination(p_department_id, p_assignee_id);
  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'Asset not found.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.asset_assignments where asset_id = p_asset_id and status = 'active' and returned_at is null) then
    raise exception 'Asset already has an active assignment.' using errcode = '23505';
  end if;
  insert into public.asset_assignments(asset_id, assignee_id, department_id, expected_return_at, handover_note, status, created_by)
  values (p_asset_id, p_assignee_id, p_department_id, p_expected_return_at, p_handover_note, 'active', p_actor_id)
  returning * into v_assignment;
  update public.assets
  set status = 'in_use', assigned_department_id = p_department_id, updated_at = now()
  where id = p_asset_id;
  select * into v_asset from public.assets where id = p_asset_id;
  return jsonb_build_object('asset', to_jsonb(v_asset), 'assignment', to_jsonb(v_assignment));
end;
$function$;

create or replace function public.api_asset_transfer(
  p_actor_id uuid,
  p_asset_id uuid,
  p_department_id uuid,
  p_assignee_id uuid default null,
  p_expected_return_at timestamptz default null,
  p_handover_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_current public.asset_assignments%rowtype;
  v_assignment public.asset_assignments%rowtype;
  v_asset public.assets%rowtype;
begin
  if not public.asset_actor_can_manage(p_actor_id) then
    raise exception 'Forbidden.' using errcode = '42501';
  end if;
  perform public.asset_validate_destination(p_department_id, p_assignee_id);
  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'Asset not found.' using errcode = 'P0002'; end if;
  select * into v_current from public.asset_assignments
  where asset_id = p_asset_id and status = 'active' and returned_at is null
  for update;
  if not found then raise exception 'Active assignment not found.' using errcode = 'P0002'; end if;
  update public.asset_assignments
  set status = 'returned', returned_at = now(), return_note = 'Transferred by asset lifecycle.'
  where id = v_current.id;
  select * into v_current from public.asset_assignments where id = v_current.id;
  insert into public.asset_assignments(asset_id, assignee_id, department_id, expected_return_at, handover_note, status, created_by)
  values (p_asset_id, p_assignee_id, p_department_id, p_expected_return_at, p_handover_note, 'active', p_actor_id)
  returning * into v_assignment;
  update public.assets
  set status = 'in_use', assigned_department_id = p_department_id, updated_at = now()
  where id = p_asset_id;
  select * into v_asset from public.assets where id = p_asset_id;
  return jsonb_build_object('asset', to_jsonb(v_asset), 'previousAssignment', to_jsonb(v_current), 'assignment', to_jsonb(v_assignment));
end;
$function$;

create or replace function public.api_asset_return(
  p_actor_id uuid,
  p_asset_id uuid,
  p_return_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_current public.asset_assignments%rowtype;
  v_asset public.assets%rowtype;
begin
  if not public.asset_actor_can_manage(p_actor_id) then
    raise exception 'Forbidden.' using errcode = '42501';
  end if;
  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'Asset not found.' using errcode = 'P0002'; end if;
  select * into v_current from public.asset_assignments
  where asset_id = p_asset_id and status = 'active' and returned_at is null
  for update;
  if not found then raise exception 'Active assignment not found.' using errcode = 'P0002'; end if;
  update public.asset_assignments
  set status = 'returned', returned_at = now(), return_note = p_return_note
  where id = v_current.id;
  select * into v_current from public.asset_assignments where id = v_current.id;
  update public.assets
  set status = 'available', assigned_department_id = null, updated_at = now()
  where id = p_asset_id;
  select * into v_asset from public.assets where id = p_asset_id;
  return jsonb_build_object('asset', to_jsonb(v_asset), 'assignment', to_jsonb(v_current));
end;
$function$;

do $acl$
declare
  policy_name text;
begin
  foreach policy_name in array array['public read assets', 'public write assets', 'public read asset_assignments', 'public write asset_assignments'] loop
    execute format('drop policy if exists %I on public.%I', policy_name, case when policy_name like '%asset_assignments%' then 'asset_assignments' else 'assets' end);
  end loop;
end
$acl$;

alter table public.assets enable row level security;
alter table public.asset_assignments enable row level security;
revoke all privileges on table public.assets from public, anon, authenticated;
revoke all privileges on table public.asset_assignments from public, anon, authenticated;
grant select, insert, update, delete on table public.assets to service_role;
grant select, insert, update, delete on table public.asset_assignments to service_role;

revoke all on function public.asset_actor_can_manage(uuid) from public, anon, authenticated;
revoke all on function public.asset_validate_destination(uuid, uuid) from public, anon, authenticated;
revoke all on function public.api_asset_assign(uuid, uuid, uuid, uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function public.api_asset_transfer(uuid, uuid, uuid, uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function public.api_asset_return(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.asset_actor_can_manage(uuid) to service_role;
grant execute on function public.asset_validate_destination(uuid, uuid) to service_role;
grant execute on function public.api_asset_assign(uuid, uuid, uuid, uuid, timestamptz, text) to service_role;
grant execute on function public.api_asset_transfer(uuid, uuid, uuid, uuid, timestamptz, text) to service_role;
grant execute on function public.api_asset_return(uuid, uuid, text) to service_role;

commit;
