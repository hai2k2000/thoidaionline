begin;

create or replace function public.api_asset_bulk_import(p_actor_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  r jsonb;
  i integer := 0;
  v_code text;
  v_codes text[] := '{}';
  v_reserved text[];
  v_asset_id uuid;
  v_department uuid;
  v_assignee uuid;
  v_location uuid;
  v_quantity integer;
  v_next numeric;
  v_tracking text;
  v_condition text;
begin
  if not public.asset_actor_can_manage(p_actor_id) then
    raise exception 'Forbidden.' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Dòng 1: dữ liệu phải là một danh sách.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) not between 1 and 1000 then
    raise exception 'Dòng 1: cần từ 1 đến 1000 dòng.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('api_asset_bulk_import'));
  -- Reserve explicit codes before allocating blanks, irrespective of row order.
  select array_agg(nullif(btrim(value->>'asset_code'), '')) into v_reserved
    from jsonb_array_elements(p_rows);
  select coalesce(max(substring(asset_code from 4)::numeric), 0) into v_next
    from public.assets where asset_code ~ '^TS-[0-9]{5,}$';

  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      if jsonb_typeof(r) <> 'object' then raise exception 'Dữ liệu không hợp lệ.'; end if;
      if nullif(btrim(r->>'asset_name'), '') is null or nullif(btrim(r->>'category'), '') is null then
        raise exception 'Thiếu tên hoặc loại tài sản.';
      end if;
      if exists (select 1 from jsonb_each(r) as field where field.key in
        ('asset_code','asset_name','category','tracking_mode','department_id','assignee_id','location_id','condition_status','serial_number','note')
        and jsonb_typeof(field.value) not in ('string','null')) then
        raise exception 'Giá trị văn bản không hợp lệ.';
      end if;
      v_tracking := coalesce(nullif(btrim(r->>'tracking_mode'), ''), 'individual');
      v_condition := coalesce(nullif(btrim(r->>'condition_status'), ''), 'normal');
      if v_tracking not in ('individual', 'lot') then raise exception 'Hình thức theo dõi không hợp lệ.'; end if;
      if coalesce(r->>'quantity', '1') !~ '^[0-9]+$' then raise exception 'Số lượng phải là số nguyên từ 1.'; end if;
      v_quantity := coalesce((r->>'quantity')::integer, 1);
      if v_quantity < 1 or (v_tracking = 'individual' and v_quantity <> 1) then
        raise exception 'Số lượng không hợp lệ; Cá thể phải bằng 1.';
      end if;
      if v_condition not in ('normal', 'needs_maintenance', 'under_service', 'broken') then
        raise exception 'Tình trạng không hợp lệ.';
      end if;
      v_department := nullif(btrim(r->>'department_id'), '')::uuid;
      v_assignee := nullif(btrim(r->>'assignee_id'), '')::uuid;
      v_location := nullif(btrim(r->>'location_id'), '')::uuid;
      if v_assignee is not null and v_department is null then raise exception 'Người sử dụng cần phòng quản lý.'; end if;
      if v_department is not null then
        if not exists(select 1 from public.departments where id = v_department and active = true) then raise exception 'Phòng quản lý không hoạt động.'; end if;
        perform public.asset_validate_destination(v_department, v_assignee);
      end if;
      if v_location is not null and not exists(select 1 from public.asset_locations where id = v_location and active = true) then
        raise exception 'Vị trí không hoạt động.';
      end if;
      v_code := nullif(btrim(r->>'asset_code'), '');
      if v_code is null then
        loop
          v_next := v_next + 1;
          v_code := 'TS-' || lpad(v_next::text, greatest(5, length(v_next::text)), '0');
          exit when not coalesce(v_code = any(v_reserved), false)
            and not (v_code = any(v_codes))
            and not exists(select 1 from public.assets where asset_code = v_code);
        end loop;
      end if;
      if v_code = any(v_codes) or exists(select 1 from public.assets where asset_code = v_code) then raise exception 'Mã tài sản % bị trùng.', v_code; end if;
      insert into public.assets (
        asset_code, asset_name, category, status, assigned_department_id, tracking_mode,
        quantity, condition_status, location_id, serial_number, note
      ) values (
        v_code, btrim(r->>'asset_name'), btrim(r->>'category'),
        case when v_department is null then 'available' else 'in_use' end,
        v_department, v_tracking, v_quantity, v_condition, v_location,
        nullif(btrim(r->>'serial_number'), ''), nullif(btrim(r->>'note'), '')
      ) returning id into v_asset_id;
      if v_department is not null then
        insert into public.asset_assignments(asset_id, assignee_id, department_id, status, created_by, handover_note)
          values (v_asset_id, v_assignee, v_department, 'active', p_actor_id, 'Nhập từ Excel');
      end if;
      v_codes := array_append(v_codes, v_code);
    exception
      when others then
        raise exception 'Dòng %: %', i, sqlerrm using errcode = '22023';
    end;
  end loop;
  return jsonb_build_object('imported', cardinality(v_codes), 'asset_codes', to_jsonb(v_codes));
end;
$function$;

revoke all on function public.api_asset_bulk_import(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.api_asset_bulk_import(uuid, jsonb) to service_role;
commit;