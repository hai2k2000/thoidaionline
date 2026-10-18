begin;

insert into public.asset_locations (code, name)
values
  ('kho', 'Kho'),
  ('kho_cho_xu_ly', 'Kho chờ xử lý')
on conflict (code) do update
set name = excluded.name, active = true, updated_at = now();

create or replace function public.api_asset_reclaim_unrepairable(
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
  v_asset public.assets%rowtype;
  v_assignment public.asset_assignments%rowtype;
  v_location_id uuid;
  v_old_asset jsonb;
begin
  if not public.asset_actor_can_manage(p_actor_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'asset_not_found' using errcode = 'P0002'; end if;
  v_old_asset := to_jsonb(v_asset);
  if v_asset.condition_status is distinct from 'broken' then
    raise exception 'asset_not_confirmed_unrepairable' using errcode = '22023';
  end if;

  select * into v_assignment
  from public.asset_assignments
  where asset_id = p_asset_id and status = 'active' and returned_at is null
  for update;
  if not found then raise exception 'active_assignment_not_found' using errcode = 'P0002'; end if;

  select id into v_location_id from public.asset_locations
  where code = 'kho_cho_xu_ly' and active = true;
  if v_location_id is null then raise exception 'warehouse_location_not_configured' using errcode = 'P0001'; end if;

  update public.asset_assignments
  set status = 'returned', returned_at = now(),
      return_note = coalesce(nullif(btrim(p_return_note), ''), 'Thu hồi do hỏng không sửa được; chuyển vào kho chờ xử lý.')
  where id = v_assignment.id
  returning * into v_assignment;

  update public.assets
  set status = 'broken', assigned_department_id = null, location_id = v_location_id, updated_at = now()
  where id = p_asset_id
  returning * into v_asset;

  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, old_data, new_data)
  values (
    p_actor_id, 'assets', 'assets', p_asset_id, 'reclaim_unrepairable',
    jsonb_build_object('asset', v_old_asset, 'assignment_id', v_assignment.id),
    jsonb_build_object('asset', to_jsonb(v_asset), 'assignment', to_jsonb(v_assignment), 'warehouse', 'kho_cho_xu_ly')
  );
  return jsonb_build_object('asset', to_jsonb(v_asset), 'assignment', to_jsonb(v_assignment));
end;
$function$;

create or replace function public.api_asset_liquidate(
  p_actor_id uuid,
  p_asset_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_asset public.assets%rowtype;
  v_assignment public.asset_assignments%rowtype;
  v_old_asset jsonb;
begin
  if not public.asset_actor_can_manage(p_actor_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'asset_not_found' using errcode = 'P0002'; end if;
  if v_asset.status = 'liquidated' then raise exception 'asset_already_liquidated' using errcode = 'P0001'; end if;
  v_old_asset := to_jsonb(v_asset);

  select * into v_assignment
  from public.asset_assignments
  where asset_id = p_asset_id and status = 'active' and returned_at is null
  for update;
  if found then raise exception 'active_assignment_requires_reclaim' using errcode = '22023'; end if;

  update public.assets
  set status = 'liquidated', assigned_department_id = null, location_id = null,
      note = coalesce(nullif(btrim(p_note), ''), note), updated_at = now()
  where id = p_asset_id
  returning * into v_asset;

  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, old_data, new_data)
  values (p_actor_id, 'assets', 'assets', p_asset_id, 'liquidate', v_old_asset, to_jsonb(v_asset));
  return jsonb_build_object('asset', to_jsonb(v_asset));
end;
$function$;

revoke all on function public.api_asset_reclaim_unrepairable(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.api_asset_liquidate(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.api_asset_reclaim_unrepairable(uuid, uuid, text) to service_role;
grant execute on function public.api_asset_liquidate(uuid, uuid, text) to service_role;

commit;
