alter table public.asset_import_records
  drop constraint if exists asset_import_records_proposed_action_check;

alter table public.asset_import_records
  add constraint asset_import_records_proposed_action_check
  check (proposed_action in ('IMPORT_ASSIGNED', 'IMPORT_UNASSIGNED', 'READY_LOT_SPLIT', 'READY_INDIVIDUAL', 'READY_LOT', 'REVIEW_DEPARTMENT', 'REVIEW_CUSTODIAN', 'INVENTORY_DISCREPANCY', 'REVIEW_REQUIRED', 'REVIEW_QUANTITY'));

create or replace function public.api_import_asset_batch(p_actor_id uuid, p_batch_id uuid, p_source_file_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch public.asset_import_batches;
  v_record public.asset_import_records;
  v_asset public.assets;
  v_assignment public.asset_assignments;
  v_count integer := 0;
  v_unassigned_warning text := 'Chưa thuộc sở hữu phòng nào; cần xác định và bổ sung sau.';
begin
  if not public.asset_actor_can_manage(p_actor_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_batch from public.asset_import_batches where id = p_batch_id for update;
  if not found then raise exception 'asset_import_batch_not_found'; end if;
  if coalesce(v_batch.source_file_hash, '') <> coalesce(p_source_file_hash, '') then raise exception 'asset_import_source_hash_mismatch'; end if;
  if v_batch.status = 'imported' then
    select count(*) into v_count from public.asset_import_records where import_batch_id = p_batch_id and validation_status = 'imported';
    return jsonb_build_object('batch_id', p_batch_id, 'imported_records', v_count, 'already_imported', true);
  end if;
  if v_batch.status <> 'approved' then raise exception 'asset_import_batch_not_approved'; end if;

  for v_record in select * from public.asset_import_records where import_batch_id = p_batch_id order by source_sheet, source_row, split_part for update loop
    if v_record.asset_id is not null then
      if v_record.validation_status <> 'imported' then raise exception 'asset_import_record_linked_but_not_imported'; end if;
      continue;
    end if;
    if v_record.validation_status <> 'approved' or v_record.owner_decision_required then raise exception 'asset_import_record_not_approved'; end if;
    if v_record.tracking_mode = 'individual' and v_record.proposed_quantity <> 1 then raise exception 'asset_import_individual_quantity_invalid'; end if;
    if v_record.proposed_quantity < 1 then raise exception 'asset_import_quantity_invalid'; end if;
    if v_record.proposed_action not in ('IMPORT_ASSIGNED', 'IMPORT_UNASSIGNED') then raise exception 'asset_import_action_invalid'; end if;
    if v_record.proposed_action = 'IMPORT_UNASSIGNED' then
      if v_record.proposed_department_id is not null or v_record.proposed_assignee_id is not null then raise exception 'asset_import_unassigned_destination_forbidden'; end if;
    else
      if v_record.proposed_department_id is null then raise exception 'asset_import_department_required'; end if;
      if v_record.proposed_assignee_id is not null and v_record.proposed_department_id is null then raise exception 'asset_import_assignee_department_required'; end if;
      perform public.asset_validate_destination(v_record.proposed_department_id, v_record.proposed_assignee_id);
    end if;

    insert into public.assets(asset_code, asset_name, category, status, assigned_department_id, tracking_mode, quantity, note)
    values (
      v_record.proposed_asset_code,
      v_record.raw_asset_name,
      v_record.raw_category,
      case when v_record.proposed_action = 'IMPORT_ASSIGNED' then 'in_use' else 'available' end,
      case when v_record.proposed_action = 'IMPORT_ASSIGNED' then v_record.proposed_department_id else null end,
      v_record.tracking_mode,
      v_record.proposed_quantity,
      case when v_record.proposed_action = 'IMPORT_UNASSIGNED' then concat_ws(' ', v_record.warning, v_unassigned_warning) else v_record.warning end
    )
    returning * into v_asset;

    if v_record.proposed_action = 'IMPORT_ASSIGNED' then
      insert into public.asset_assignments(asset_id, assignee_id, department_id, status, created_by, handover_note)
      values (v_asset.id, v_record.proposed_assignee_id, v_record.proposed_department_id, 'active', p_actor_id, 'Imported from approved asset import batch') returning * into v_assignment;
    end if;

    update public.asset_import_records set asset_id = v_asset.id, validation_status = 'imported', updated_at = now() where id = v_record.id;
    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
    values (
      p_actor_id,
      'assets',
      'assets',
      v_asset.id,
      'import',
      to_jsonb(v_asset) || jsonb_build_object('import_batch_id', p_batch_id, 'import_action', v_record.proposed_action, 'source_sheet', v_record.source_sheet, 'source_row', v_record.source_row, 'split_part', v_record.split_part)
    );
    v_count := v_count + 1;
  end loop;

  update public.asset_import_batches set status = 'imported', imported_at = now(), updated_at = now() where id = p_batch_id;
  return jsonb_build_object('batch_id', p_batch_id, 'imported_records', v_count, 'already_imported', false);
end;
$$;

revoke execute on function public.api_import_asset_batch(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.api_import_asset_batch(uuid, uuid, text) to service_role;
