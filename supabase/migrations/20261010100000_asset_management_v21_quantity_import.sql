begin;

alter table public.assets
  add column if not exists tracking_mode text not null default 'individual',
  add column if not exists quantity integer not null default 1;

alter table public.assets
  drop constraint if exists assets_tracking_mode_check,
  drop constraint if exists assets_quantity_check,
  drop constraint if exists assets_tracking_quantity_check;

alter table public.assets
  add constraint assets_tracking_mode_check check (tracking_mode in ('individual', 'lot')),
  add constraint assets_quantity_check check (quantity >= 1),
  add constraint assets_tracking_quantity_check check (tracking_mode = 'lot' or quantity = 1);

create table if not exists public.asset_import_batches (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null unique,
  source_file_name text not null,
  source_period text,
  source_file_hash text,
  preview_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'previewed', 'approved', 'imported', 'cancelled')),
  created_by uuid references public.staff_users(id),
  approved_by uuid references public.staff_users(id),
  approved_at timestamptz,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_import_records (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.asset_import_batches(id) on delete restrict,
  source_sheet text not null,
  source_row integer not null check (source_row > 0),
  split_part text not null default '',
  source_key text not null,
  source_hash text not null,
  source_asset_code text,
  proposed_asset_code text not null,
  raw_asset_name text not null,
  raw_category text not null,
  tracking_mode text not null check (tracking_mode in ('individual', 'lot')),
  book_quantity integer not null check (book_quantity >= 0),
  counted_quantity integer not null check (counted_quantity >= 0),
  quantity_difference integer not null,
  proposed_quantity integer not null check (proposed_quantity >= 1),
  raw_department_text text,
  proposed_department_id uuid references public.departments(id),
  raw_custodian_text text,
  proposed_assignee_id uuid references public.staff_users(id),
  validation_status text not null default 'review_required' check (validation_status in ('review_required', 'valid', 'approved', 'imported', 'blocked')),
  warning text,
  owner_decision_required boolean not null default true,
  proposed_action text not null,
  asset_id uuid references public.assets(id) on delete restrict,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_batch_id, source_sheet, source_row, split_part),
  constraint asset_import_records_quantity_difference_check check (quantity_difference = counted_quantity - book_quantity),
  constraint asset_import_records_tracking_quantity_check check (tracking_mode = 'lot' or proposed_quantity = 1)
);

create index if not exists idx_asset_import_records_batch on public.asset_import_records(import_batch_id);
create index if not exists idx_asset_import_records_asset on public.asset_import_records(asset_id);
create index if not exists idx_asset_import_records_source on public.asset_import_records(source_sheet, source_row);

create or replace function public.asset_import_batch_state_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status in ('imported', 'cancelled') and new.status <> old.status then
    raise exception 'asset_import_batch_terminal_state';
  end if;
  if old.status in ('approved', 'imported') and new.status in ('draft', 'previewed') then
    raise exception 'asset_import_batch_approval_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists asset_import_batch_state_guard on public.asset_import_batches;
create trigger asset_import_batch_state_guard
before update on public.asset_import_batches
for each row execute function public.asset_import_batch_state_guard();

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
    if v_record.raw_department_text is not null and v_record.proposed_department_id is null then raise exception 'asset_import_department_required'; end if;
    if v_record.proposed_assignee_id is not null and v_record.proposed_department_id is null then raise exception 'asset_import_assignee_department_required'; end if;
    if v_record.proposed_department_id is not null then perform public.asset_validate_destination(v_record.proposed_department_id, v_record.proposed_assignee_id); end if;

    insert into public.assets(asset_code, asset_name, category, status, assigned_department_id, tracking_mode, quantity, note)
    values (v_record.proposed_asset_code, v_record.raw_asset_name, v_record.raw_category, case when v_record.proposed_department_id is not null then 'in_use' else 'available' end, v_record.proposed_department_id, v_record.tracking_mode, v_record.proposed_quantity, v_record.warning)
    returning * into v_asset;
    if v_record.proposed_department_id is not null then
      insert into public.asset_assignments(asset_id, assignee_id, department_id, status, created_by, handover_note)
      values (v_asset.id, v_record.proposed_assignee_id, v_record.proposed_department_id, 'active', p_actor_id, 'Imported from approved asset import batch') returning * into v_assignment;
    end if;
    update public.asset_import_records set asset_id = v_asset.id, validation_status = 'imported', updated_at = now() where id = v_record.id;
    insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data) values (p_actor_id, 'assets', 'assets', v_asset.id, 'import', to_jsonb(v_asset));
    v_count := v_count + 1;
  end loop;

  update public.asset_import_batches set status = 'imported', imported_at = now(), updated_at = now() where id = p_batch_id;
  return jsonb_build_object('batch_id', p_batch_id, 'imported_records', v_count, 'already_imported', false);
end;
$$;

alter table public.asset_import_batches enable row level security;
alter table public.asset_import_records enable row level security;
revoke all privileges on table public.asset_import_batches from public, anon, authenticated;
revoke all privileges on table public.asset_import_records from public, anon, authenticated;
grant select, insert, update, delete on table public.asset_import_batches to service_role;
grant select, insert, update, delete on table public.asset_import_records to service_role;
revoke execute on function public.api_import_asset_batch(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.api_import_asset_batch(uuid, uuid, text) to service_role;

commit;
