begin;

insert into public.permissions(code, name, module, description)
values (
  'journalism.publication.verify',
  'Xác minh xuất bản báo chí',
  'journalism',
  'Xác minh độc lập báo cáo xuất bản thủ công theo Task scope.'
)
on conflict (code) do nothing;

with approved(role_code, permission_code, scope) as (values
  ('admin', 'journalism.publication.verify', 'all'),
  ('tong_bien_tap', 'journalism.publication.verify', 'all'),
  ('pho_tong_bien_tap', 'journalism.publication.verify', 'all'),
  ('truong_phong', 'journalism.publication.verify', 'department'),
  ('pho_truong_phong', 'journalism.publication.verify', 'department')
)
insert into public.role_permission_grants(role_id, permission_id, scope)
select r.id, p.id, a.scope
from approved a
join public.roles r on r.code = a.role_code and r.active = true
join public.permissions p on p.code = a.permission_code
on conflict (role_id, permission_id, scope) do nothing;

create table public.journalism_publication_verifications (
  id uuid primary key default gen_random_uuid(),
  publication_report_id uuid not null references public.journalism_publication_reports(id) on delete cascade,
  decision text not null,
  note text,
  verified_by uuid not null references public.staff_users(id) on delete restrict,
  publication_report_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint journalism_publication_verifications_decision_check
    check (decision in ('verified', 'rejected')),
  constraint journalism_publication_verifications_note_check
    check (
      note is null
      or (
        note = btrim(note)
        and char_length(note) between 1 and 5000
      )
    ),
  constraint journalism_publication_verifications_rejection_note_check
    check (decision = 'verified' or (note is not null and char_length(btrim(note)) > 0))
);

create index journalism_publication_verifications_report_created_idx
  on public.journalism_publication_verifications(publication_report_id, created_at desc);

create index journalism_publication_verifications_report_version_idx
  on public.journalism_publication_verifications(publication_report_id, publication_report_updated_at);

alter table public.journalism_publication_verifications enable row level security;

revoke all on table public.journalism_publication_verifications from public, anon, authenticated;
grant select, insert on table public.journalism_publication_verifications to service_role;

create or replace function public.api_record_journalism_publication_verification_v1(
  p_actor_id uuid,
  p_task_id uuid,
  p_decision text,
  p_note text,
  p_expected_report_updated_at timestamptz
) returns public.journalism_publication_verifications
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_report public.journalism_publication_reports;
  v_row public.journalism_publication_verifications;
  v_note text;
begin
  perform public.api_assert_journalism_access(
    p_actor_id,
    p_task_id,
    'journalism.publication.verify'
  );

  select * into v_report
  from public.journalism_publication_reports
  where task_id = p_task_id
  for update;
  if not found then
    raise exception 'Publication report not found.' using errcode = 'P0002';
  end if;

  if v_report.reported_by = p_actor_id then
    raise exception 'Reporter cannot verify own publication report.' using errcode = '42501';
  end if;
  if p_expected_report_updated_at is null
     or v_report.updated_at <> p_expected_report_updated_at then
    raise exception 'Publication report changed before verification.' using errcode = '40001';
  end if;
  if p_decision not in ('verified', 'rejected') then
    raise exception 'Invalid verification decision.' using errcode = '22023';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 5000 then
    raise exception 'Invalid verification note.' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and v_note is null then
    raise exception 'Rejection reason required.' using errcode = '22023';
  end if;

  insert into public.journalism_publication_verifications(
    publication_report_id,
    decision,
    note,
    verified_by,
    publication_report_updated_at
  ) values (
    v_report.id,
    p_decision,
    v_note,
    p_actor_id,
    v_report.updated_at
  ) returning * into v_row;

  insert into public.audit_logs(
    actor_id,
    module,
    entity_type,
    entity_id,
    action,
    new_data
  ) values (
    p_actor_id,
    'task',
    'journalism_publication_verification',
    v_report.id,
    case when p_decision = 'verified'
      then 'journalism_publication_verified'
      else 'journalism_publication_rejected'
    end,
    jsonb_build_object(
      'publication_report_id', v_report.id,
      'decision', p_decision,
      'publication_report_updated_at', v_report.updated_at,
      'note_length', coalesce(char_length(v_note), 0)
    )
  );

  return v_row;
end
$function$;

revoke all on function public.api_record_journalism_publication_verification_v1(
  uuid, uuid, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.api_record_journalism_publication_verification_v1(
  uuid, uuid, text, text, timestamptz
) to service_role;
alter function public.api_record_journalism_publication_verification_v1(
  uuid, uuid, text, text, timestamptz
) owner to postgres;

commit;
