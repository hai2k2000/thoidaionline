begin;

-- The active legacy RPC consumes work_date/started_time/completed_time.
-- The previous compatibility wrapper inadvertently converted them into
-- start_date/completion_date, which caused valid quick reports to fail.
-- Keep the same public signature and RBAC V2 check; only fix the payload bridge.
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
  if not public.rbac_v2_has_effective_scope(
    p_actor_id, 'task.quick_report.create', array['self', 'all']::text[]
  ) then
    raise exception 'Quick report permission denied.' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'title', item->>'title',
        'category', item->>'category',
        'work_date', coalesce(item->>'work_date', item->>'start_date'),
        'started_time', coalesce(nullif(item->>'started_time', ''), '00:00'),
        'completed_time', case
          when item ? 'completed_time' then item->'completed_time'
          when nullif(item->>'completion_date', '') is not null then to_jsonb('00:00'::text)
          else 'null'::jsonb
        end,
        'status', item->>'status',
        'notes', item->>'notes'
      ) order by ordinal
    ),
    '[]'::jsonb
  )
  into v_rows
  from jsonb_array_elements(p_rows) with ordinality as expanded(item, ordinal);

  return public.api_create_quick_report_v1_legacy(p_actor_id, p_request_id, v_rows);
end
$function$;

alter function public.api_create_quick_report_v1(uuid, uuid, jsonb) owner to postgres;
revoke all on function public.api_create_quick_report_v1(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.api_create_quick_report_v1(uuid, uuid, jsonb) to service_role;
notify pgrst, 'reload schema';

commit;
