begin;

create table if not exists public.asset_status_change_requests (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  requester_id uuid not null references public.staff_users(id) on delete restrict,
  requested_status text not null check (requested_status in ('maintenance', 'broken')),
  reason text not null check (char_length(btrim(reason)) between 3 and 2000),
  expected_assignment_id uuid references public.asset_assignments(id) on delete restrict,
  expected_current_status text not null default 'in_use' check (expected_current_status = 'in_use'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.staff_users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists asset_status_requests_one_pending_idx
  on public.asset_status_change_requests(asset_id) where status = 'pending';
create index if not exists asset_status_requests_requester_idx
  on public.asset_status_change_requests(requester_id, created_at desc);
create index if not exists asset_status_requests_status_idx
  on public.asset_status_change_requests(status, created_at desc);

alter table public.asset_status_change_requests enable row level security;
revoke all privileges on table public.asset_status_change_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.asset_status_change_requests to service_role;

create or replace function public.api_asset_status_request_create(
  p_actor_id uuid,
  p_asset_id uuid,
  p_requested_status text,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  v_asset public.assets%rowtype;
  v_assignment public.asset_assignments%rowtype;
  v_request public.asset_status_change_requests%rowtype;
begin
  if not exists (select 1 from public.staff_users where id = p_actor_id and active = true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_requested_status not in ('maintenance', 'broken') then raise exception 'invalid_requested_status' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'asset_not_found' using errcode = 'P0002'; end if;
  if v_asset.status <> 'in_use' then raise exception 'asset_status_conflict' using errcode = 'P0001'; end if;
  select * into v_assignment from public.asset_assignments
    where asset_id = p_asset_id and status = 'active' and returned_at is null for update;
  if not found or v_assignment.assignee_id is distinct from p_actor_id then raise exception 'asset_not_owned' using errcode = '42501'; end if;
  insert into public.asset_status_change_requests(asset_id, requester_id, requested_status, reason, expected_assignment_id, expected_current_status)
  values (p_asset_id, p_actor_id, p_requested_status, btrim(p_reason), v_assignment.id, v_asset.status)
  returning * into v_request;
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, new_data)
  values (p_actor_id, 'assets', 'asset_status_change_requests', v_request.id, 'status_change_request', to_jsonb(v_request));
  return to_jsonb(v_request);
exception when unique_violation then
  raise exception 'pending_request_exists' using errcode = '23505';
end;
$function$;

create or replace function public.api_asset_status_request_review(
  p_actor_id uuid,
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  v_request public.asset_status_change_requests%rowtype;
  v_old_request public.asset_status_change_requests%rowtype;
  v_asset public.assets%rowtype;
  v_assignment public.asset_assignments%rowtype;
  v_old_asset_status text;
begin
  if not public.asset_actor_can_manage(p_actor_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'reject') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  select * into v_request from public.asset_status_change_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' then raise exception 'request_already_reviewed' using errcode = 'P0001'; end if;
  v_old_request := v_request;
  if p_decision = 'approve' then
    select * into v_asset from public.assets where id = v_request.asset_id for update;
    v_old_asset_status := v_asset.status;
    select * into v_assignment from public.asset_assignments where id = v_request.expected_assignment_id and asset_id = v_request.asset_id and assignee_id = v_request.requester_id and status = 'active' and returned_at is null for update;
    if not found or v_asset.id is distinct from v_request.asset_id or v_asset.status <> v_request.expected_current_status then raise exception 'asset_status_or_assignment_conflict' using errcode = '40001'; end if;
    update public.assets set status = v_request.requested_status, updated_at = now() where id = v_asset.id returning * into v_asset;
  end if;
  update public.asset_status_change_requests
    set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
        reviewed_by = p_actor_id, reviewed_at = now(), review_note = nullif(btrim(p_review_note), ''), updated_at = now()
    where id = v_request.id returning * into v_request;
  insert into public.audit_logs(actor_id, module, entity_type, entity_id, action, old_data, new_data)
  values (p_actor_id, 'assets', 'asset_status_change_requests', v_request.id,
    case when p_decision = 'approve' then 'status_change_approved' else 'status_change_rejected' end,
    jsonb_build_object('request', to_jsonb(v_old_request), 'asset_status', v_old_asset_status, 'expected_assignment_id', v_old_request.expected_assignment_id),
    jsonb_build_object('request', to_jsonb(v_request), 'asset_status', case when p_decision = 'approve' then v_request.requested_status else v_old_asset_status end, 'reviewer', p_actor_id, 'reviewed_at', v_request.reviewed_at));
  return jsonb_build_object('request', to_jsonb(v_request), 'asset', case when p_decision = 'approve' then to_jsonb(v_asset) else null end);
end;
$function$;

revoke all on function public.api_asset_status_request_create(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.api_asset_status_request_review(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.api_asset_status_request_create(uuid, uuid, text, text) to service_role;
grant execute on function public.api_asset_status_request_review(uuid, uuid, text, text) to service_role;

commit;
