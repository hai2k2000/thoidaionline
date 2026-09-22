begin;

create or replace function public.api_reconcile_journalism_publication_report_v1(
  p_actor_id uuid,
  p_task_id uuid,
  p_publication_url text,
  p_published_title text,
  p_published_at timestamptz,
  p_note text,
  p_expected_updated_at timestamptz,
  p_reason text
) returns public.journalism_publication_reports
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_row public.journalism_publication_reports;
  v_url text;
  v_title text;
  v_note text;
  v_reason text;
  v_old jsonb;
  v_new jsonb;
begin
  perform public.api_assert_journalism_access(
    p_actor_id,
    p_task_id,
    'journalism.publication.manage'
  );

  v_url := btrim(coalesce(p_publication_url, ''));
  v_title := nullif(btrim(coalesce(p_published_title, '')), '');
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if v_url = ''
     or char_length(v_url) > 2048
     or v_url !~* '^https?://[^/@[:space:]]+([/:?][^[:space:]]*)?$' then
    raise exception 'Invalid publication URL.' using errcode = '22023';
  end if;
  if p_published_at is null then
    raise exception 'Published time is required.' using errcode = '22023';
  end if;
  if v_title is not null and char_length(v_title) > 500 then
    raise exception 'Invalid published title.' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 5000 then
    raise exception 'Invalid publication note.' using errcode = '22023';
  end if;
  if v_reason is null or char_length(v_reason) > 2000 then
    raise exception 'Reconciliation reason is required.' using errcode = '22023';
  end if;

  select * into v_row
  from public.journalism_publication_reports
  where task_id = p_task_id
  for update;

  if not found then
    raise exception 'Publication report not found.' using errcode = 'P0002';
  end if;
  if p_expected_updated_at is null
     or v_row.updated_at <> p_expected_updated_at then
    raise exception 'Concurrent publication report update.' using errcode = '40001';
  end if;
  if v_row.publication_url = v_url
     and v_row.published_title is not distinct from v_title
     and v_row.published_at = p_published_at
     and v_row.note is not distinct from v_note then
    raise exception 'Reconciliation did not change the publication report.' using errcode = '22023';
  end if;

  v_old := jsonb_build_object(
    'publication_url', v_row.publication_url,
    'published_title', v_row.published_title,
    'published_at', v_row.published_at,
    'note_length', coalesce(char_length(v_row.note), 0),
    'reported_by', v_row.reported_by
  );

  update public.journalism_publication_reports
  set publication_url = v_url,
      published_title = v_title,
      published_at = p_published_at,
      note = v_note
  where task_id = p_task_id
  returning * into v_row;

  v_new := jsonb_build_object(
    'publication_url', v_row.publication_url,
    'published_title', v_row.published_title,
    'published_at', v_row.published_at,
    'note_length', coalesce(char_length(v_row.note), 0),
    'reported_by', v_row.reported_by,
    'reconciliation_reason_length', char_length(v_reason)
  );

  insert into public.audit_logs(
    actor_id, module, entity_type, entity_id, action, old_data, new_data
  ) values (
    p_actor_id, 'task', 'journalism_publication_report', p_task_id,
    'reconcile_manual_publication_report', v_old, v_new
  );

  return v_row;
end
$function$;

revoke all on function public.api_reconcile_journalism_publication_report_v1(
  uuid, uuid, text, text, timestamptz, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.api_reconcile_journalism_publication_report_v1(
  uuid, uuid, text, text, timestamptz, text, timestamptz, text
) to service_role;
alter function public.api_reconcile_journalism_publication_report_v1(
  uuid, uuid, text, text, timestamptz, text, timestamptz, text
) owner to postgres;

commit;
