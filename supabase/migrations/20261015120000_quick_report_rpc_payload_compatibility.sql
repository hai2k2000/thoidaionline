begin;

-- The public application contract uses work_date/time fields while the
-- historical UX migration's legacy function still accepts date-only fields.
-- Normalize at the RBAC wrapper boundary without changing the historical
-- migration or the public function signature.
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
    'start_date', coalesce(item->>'start_date', item->>'work_date'),
    'completion_date', case
      when item ? 'completion_date' then item->'completion_date'
      when nullif(item->>'completed_time', '') is null then 'null'::jsonb
      else to_jsonb(item->>'work_date')
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
