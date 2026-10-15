begin;

-- Keep the hardened public wrapper aligned with the historical RPC's row shape.
-- The wrapper accepts work_date/time fields from the repository and forwards
-- those exact names to the legacy implementation without changing its contract.
create or replace function public.api_create_quick_report_v1(
  p_actor_id uuid,
  p_request_id uuid,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_rows jsonb;
begin
  if not public.rbac_v2_has_effective_scope(p_actor_id, 'task.quick_report.create', array['self', 'all']::text[]) then
    raise exception 'Quick report permission denied.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'title', item->>'title',
    'category', item->>'category',
    'work_date', coalesce(item->>'work_date', item->>'start_date'),
    'started_time', coalesce(item->>'started_time', '00:00'),
    'completed_time', case
      when item ? 'completed_time' then item->'completed_time'
      when item ? 'completion_date' then '00:00'::jsonb
      else null
    end,
    'status', item->>'status',
    'notes', item->>'notes'
  )), '[]'::jsonb)
  into v_rows
  from jsonb_array_elements(p_rows) as expanded(item);

  return public.api_create_quick_report_v1_legacy(p_actor_id, p_request_id, v_rows);
end
$function$;

alter function public.api_create_quick_report_v1(uuid, uuid, jsonb) owner to postgres;
revoke all on function public.api_create_quick_report_v1(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.api_create_quick_report_v1(uuid, uuid, jsonb) to service_role;

commit;
