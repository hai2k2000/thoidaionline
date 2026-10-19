begin;

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
  v_location_id uuid;
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

  select id into v_location_id
  from public.asset_locations
  where code = 'kho' and active = true;
  if v_location_id is null then
    raise exception 'warehouse_location_not_configured' using errcode = 'P0001';
  end if;

  update public.asset_assignments
  set status = 'returned', returned_at = now(), return_note = p_return_note
  where id = v_current.id;

  select * into v_current from public.asset_assignments where id = v_current.id;

  update public.assets
  set status = 'available', assigned_department_id = null, location_id = v_location_id, updated_at = now()
  where id = p_asset_id;

  select * into v_asset from public.assets where id = p_asset_id;
  return jsonb_build_object('asset', to_jsonb(v_asset), 'assignment', to_jsonb(v_current));
end;
$function$;

revoke all on function public.api_asset_return(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.api_asset_return(uuid, uuid, text) to service_role;

commit;
