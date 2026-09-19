begin;

create table public.journalism_publication_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.journalism_task_details(task_id) on delete cascade,
  publication_url text not null,
  published_title text,
  published_at timestamptz not null,
  note text,
  reported_by uuid not null references public.staff_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journalism_publication_reports_task_unique unique (task_id),
  constraint journalism_publication_reports_url_check check (
    publication_url = btrim(publication_url)
    and char_length(publication_url) between 1 and 2048
    and publication_url ~* '^https?://[^/@[:space:]]+([/:?][^[:space:]]*)?$'
  ),
  constraint journalism_publication_reports_title_check check (
    published_title is null
    or (
      published_title = btrim(published_title)
      and char_length(published_title) between 1 and 500
    )
  ),
  constraint journalism_publication_reports_note_check check (
    note is null
    or (
      note = btrim(note)
      and char_length(note) between 1 and 5000
    )
  )
);

create index journalism_publication_reports_published_at_idx
  on public.journalism_publication_reports(published_at desc);

create index journalism_publication_reports_reported_by_idx
  on public.journalism_publication_reports(reported_by);

create trigger journalism_publication_reports_set_updated_at
before update on public.journalism_publication_reports
for each row execute function public.touch_journalism_updated_at();

alter table public.journalism_publication_reports enable row level security;

revoke all on table public.journalism_publication_reports from public, anon, authenticated;
grant select, insert, update, delete on table public.journalism_publication_reports to service_role;

create or replace function public.api_upsert_journalism_publication_report_v1(
  p_actor_id uuid,
  p_task_id uuid,
  p_publication_url text,
  p_published_title text,
  p_published_at timestamptz,
  p_note text,
  p_expected_updated_at timestamptz
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

  select * into v_row
  from public.journalism_publication_reports
  where task_id = p_task_id
  for update;

  if found then
    if p_expected_updated_at is null
       or v_row.updated_at <> p_expected_updated_at then
      raise exception 'Concurrent publication report update.' using errcode = '40001';
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
  else
    if p_expected_updated_at is not null then
      raise exception 'Concurrent publication report update.' using errcode = '40001';
    end if;
    insert into public.journalism_publication_reports(
      task_id,
      publication_url,
      published_title,
      published_at,
      note,
      reported_by
    ) values (
      p_task_id,
      v_url,
      v_title,
      p_published_at,
      v_note,
      p_actor_id
    )
    returning * into v_row;
  end if;

  v_new := jsonb_build_object(
    'publication_url', v_row.publication_url,
    'published_title', v_row.published_title,
    'published_at', v_row.published_at,
    'note_length', coalesce(char_length(v_row.note), 0),
    'reported_by', v_row.reported_by
  );

  insert into public.audit_logs(
    actor_id,
    module,
    entity_type,
    entity_id,
    action,
    old_data,
    new_data
  ) values (
    p_actor_id,
    'task',
    'journalism_publication_report',
    p_task_id,
    case when v_old is null
      then 'create_manual_publication_report'
      else 'update_manual_publication_report'
    end,
    v_old,
    v_new
  );

  return v_row;
end
$function$;

revoke all on function public.api_upsert_journalism_publication_report_v1(
  uuid, uuid, text, text, timestamptz, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.api_upsert_journalism_publication_report_v1(
  uuid, uuid, text, text, timestamptz, text, timestamptz
) to service_role;
alter function public.api_upsert_journalism_publication_report_v1(
  uuid, uuid, text, text, timestamptz, text, timestamptz
) owner to postgres;

commit;
