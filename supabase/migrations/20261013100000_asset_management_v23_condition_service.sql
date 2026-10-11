begin;

alter table public.assets add column if not exists condition_status text not null default 'normal';
update public.assets
set condition_status = case status when 'maintenance' then 'needs_maintenance' when 'broken' then 'broken' else 'normal' end
where condition_status = 'normal' and status in ('maintenance', 'broken');
update public.assets a
set status = case when exists (select 1 from public.asset_assignments aa where aa.asset_id = a.id and aa.status = 'active' and aa.returned_at is null) then 'in_use' else 'available' end,
    updated_at = now()
where a.status in ('maintenance', 'broken');
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'assets_condition_status_check') then
    alter table public.assets add constraint assets_condition_status_check check (condition_status in ('normal', 'needs_maintenance', 'under_service', 'broken'));
  end if;
end $$;
create index if not exists assets_condition_status_idx on public.assets(condition_status);

alter table public.asset_status_change_requests add column if not exists expected_condition_status text not null default 'normal';
update public.asset_status_change_requests set expected_condition_status = case requested_status when 'maintenance' then 'needs_maintenance' when 'broken' then 'broken' else 'normal' end where expected_condition_status = 'normal' and requested_status in ('maintenance', 'broken');

create table if not exists public.asset_service_records (
  id uuid primary key default gen_random_uuid(), asset_id uuid not null references public.assets(id) on delete restrict,
  service_type text not null check (service_type in ('maintenance', 'repair', 'replacement')),
  service_status text not null default 'planned' check (service_status in ('planned', 'in_progress', 'completed', 'cancelled')),
  description text not null check (char_length(btrim(description)) between 3 and 4000), service_provider text,
  cost numeric(14,2) check (cost is null or cost >= 0), started_at timestamptz, completed_at timestamptz,
  condition_before text check (condition_before is null or condition_before in ('normal', 'needs_maintenance', 'under_service', 'broken')),
  condition_after text check (condition_after is null or condition_after in ('normal', 'needs_maintenance', 'under_service', 'broken')),
  result_note text, created_by uuid not null references public.staff_users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);
create index if not exists asset_service_records_asset_idx on public.asset_service_records(asset_id, created_at desc);
alter table public.asset_service_records enable row level security;
revoke all privileges on table public.asset_service_records from public, anon, authenticated;
grant select, insert, update on table public.asset_service_records to service_role;

create or replace function public.api_asset_status_request_create(p_actor_id uuid, p_asset_id uuid, p_requested_status text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
declare v_asset public.assets%rowtype; v_assignment public.asset_assignments%rowtype; v_request public.asset_status_change_requests%rowtype;
begin
  if not exists (select 1 from public.staff_users where id = p_actor_id and active = true) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_requested_status not in ('maintenance', 'broken') then raise exception 'invalid_requested_status' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'asset_not_found' using errcode = 'P0002'; end if;
  select * into v_assignment from public.asset_assignments where asset_id = p_asset_id and status = 'active' and returned_at is null for update;
  if not found or v_assignment.assignee_id is distinct from p_actor_id then raise exception 'asset_not_owned' using errcode = '42501'; end if;
  insert into public.asset_status_change_requests(asset_id, requester_id, requested_status, reason, expected_assignment_id, expected_current_status, expected_condition_status)
  values (p_asset_id, p_actor_id, p_requested_status, btrim(p_reason), v_assignment.id, v_asset.status, v_asset.condition_status) returning * into v_request;
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data) values (p_actor_id, 'assets', 'asset_status_change_requests', v_request.id, 'condition_change_request', to_jsonb(v_request));
  return to_jsonb(v_request);
exception when unique_violation then raise exception 'pending_request_exists' using errcode = '23505';
end;
$function$;

create or replace function public.api_asset_status_request_review(p_actor_id uuid, p_request_id uuid, p_decision text, p_review_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
declare v_request public.asset_status_change_requests%rowtype; v_asset public.assets%rowtype; v_assignment public.asset_assignments%rowtype; v_new_condition text;
begin
  if not public.asset_actor_can_manage(p_actor_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'reject') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  select * into v_request from public.asset_status_change_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' then raise exception 'request_already_reviewed' using errcode = 'P0001'; end if;
  if p_decision = 'approve' then
    select * into v_asset from public.assets where id = v_request.asset_id for update;
    select * into v_assignment from public.asset_assignments where id = v_request.expected_assignment_id and asset_id = v_request.asset_id and assignee_id = v_request.requester_id and status = 'active' and returned_at is null for update;
    if not found or v_asset.status is distinct from v_request.expected_current_status or v_asset.condition_status is distinct from v_request.expected_condition_status then raise exception 'asset_condition_or_assignment_conflict' using errcode = '40001'; end if;
    v_new_condition := case v_request.requested_status when 'maintenance' then 'needs_maintenance' else 'broken' end;
    update public.assets set condition_status = v_new_condition, updated_at = now() where id = v_asset.id returning * into v_asset;
  end if;
  update public.asset_status_change_requests set status = case when p_decision = 'approve' then 'approved' else 'rejected' end, reviewed_by = p_actor_id, reviewed_at = now(), review_note = nullif(btrim(p_review_note), ''), updated_at = now() where id = v_request.id returning * into v_request;
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data) values (p_actor_id, 'assets', 'asset_status_change_requests', v_request.id, case when p_decision = 'approve' then 'condition_change_approved' else 'condition_change_rejected' end, jsonb_build_object('request', to_jsonb(v_request), 'condition_status', v_new_condition));
  return jsonb_build_object('request', to_jsonb(v_request), 'asset', case when p_decision = 'approve' then to_jsonb(v_asset) else null end);
end;
$function$;

create or replace function public.api_asset_service_record_create(p_actor_id uuid, p_asset_id uuid, p_service_type text, p_service_status text, p_description text, p_service_provider text default null, p_cost numeric default null, p_started_at timestamptz default null, p_completed_at timestamptz default null, p_condition_after text default null, p_result_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
declare v_asset public.assets%rowtype; v_record public.asset_service_records%rowtype;
begin
  if not public.asset_actor_can_manage(p_actor_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'asset_not_found' using errcode = 'P0002'; end if;
  insert into public.asset_service_records(asset_id, service_type, service_status, description, service_provider, cost, started_at, completed_at, condition_before, condition_after, result_note, created_by)
  values (p_asset_id, p_service_type, p_service_status, btrim(p_description), nullif(btrim(p_service_provider), ''), p_cost, p_started_at, p_completed_at, v_asset.condition_status, p_condition_after, nullif(btrim(p_result_note), ''), p_actor_id) returning * into v_record;
  if p_service_status = 'completed' and p_condition_after is not null then update public.assets set condition_status = p_condition_after, updated_at = now() where id = p_asset_id; end if;
  return jsonb_build_object('record', to_jsonb(v_record));
end;
$function$;

revoke all on function public.api_asset_service_record_create(uuid,uuid,text,text,text,text,numeric,timestamptz,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.api_asset_service_record_create(uuid,uuid,text,text,text,text,numeric,timestamptz,timestamptz,text,text) to service_role;

create or replace function public.api_asset_service_record_update(p_actor_id uuid, p_record_id uuid, p_service_type text, p_service_status text, p_description text, p_service_provider text default null, p_cost numeric default null, p_started_at timestamptz default null, p_completed_at timestamptz default null, p_condition_after text default null, p_result_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
declare v_record public.asset_service_records%rowtype; v_asset public.assets%rowtype;
begin
  if not public.asset_actor_can_manage(p_actor_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_record from public.asset_service_records where id = p_record_id for update;
  if not found then raise exception 'service_record_not_found' using errcode = 'P0002'; end if;
  select * into v_asset from public.assets where id = v_record.asset_id for update;
  update public.asset_service_records
  set service_type = p_service_type, service_status = p_service_status, description = btrim(p_description),
      service_provider = nullif(btrim(p_service_provider), ''), cost = p_cost, started_at = p_started_at,
      completed_at = p_completed_at, condition_after = p_condition_after,
      result_note = nullif(btrim(p_result_note), ''), updated_at = now()
  where id = p_record_id returning * into v_record;
  if p_service_status = 'completed' and p_condition_after is not null then
    update public.assets set condition_status = p_condition_after, updated_at = now() where id = v_asset.id;
  end if;
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
  values (p_actor_id, 'assets', 'asset_service_records', p_record_id, 'service_record_update', to_jsonb(v_record));
  return jsonb_build_object('record', to_jsonb(v_record));
end;
$function$;
revoke all on function public.api_asset_service_record_update(uuid,uuid,text,text,text,text,numeric,timestamptz,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.api_asset_service_record_update(uuid,uuid,text,text,text,text,numeric,timestamptz,timestamptz,text,text) to service_role;

commit;
