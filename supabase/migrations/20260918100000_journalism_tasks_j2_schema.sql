begin;

create table public.journalism_work_kinds (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journalism_work_kinds_code_unique unique (code),
  constraint journalism_work_kinds_code_format_check check (
    code = btrim(code)
    and code = lower(code)
    and code ~ '^[a-z][a-z0-9_]*$'
    and char_length(code) between 1 and 64
  ),
  constraint journalism_work_kinds_name_check check (
    name = btrim(name)
    and char_length(name) between 1 and 200
  ),
  constraint journalism_work_kinds_description_length_check check (
    description is null or char_length(description) <= 2000
  ),
  constraint journalism_work_kinds_sort_order_check check (sort_order >= 0)
);

create table public.journalism_task_details (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  work_kind_id uuid not null references public.journalism_work_kinds(id) on delete restrict,
  publication_status text not null default 'not_published',
  planned_publication_at timestamptz,
  published_at timestamptz,
  location text,
  article_url text,
  editorial_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journalism_task_details_publication_status_check check (
    publication_status in ('not_published', 'scheduled', 'published', 'withdrawn')
  ),
  constraint journalism_task_details_publication_consistency_check check (
    (publication_status = 'not_published' and published_at is null)
    or (
      publication_status = 'scheduled'
      and planned_publication_at is not null
      and published_at is null
    )
    or (publication_status = 'published' and published_at is not null)
    or (publication_status = 'withdrawn' and published_at is not null)
  ),
  constraint journalism_task_details_location_length_check check (
    location is null or char_length(location) <= 500
  ),
  constraint journalism_task_details_article_url_length_check check (
    article_url is null or char_length(article_url) <= 2048
  ),
  constraint journalism_task_details_article_url_check check (
    article_url is null
    or (
      publication_status in ('published', 'withdrawn')
      and article_url = btrim(article_url)
      and (
        lower(article_url) like 'http://%'
        or lower(article_url) like 'https://%'
      )
    )
  ),
  constraint journalism_task_details_editorial_notes_length_check check (
    editorial_notes is null or char_length(editorial_notes) <= 10000
  )
);

create index journalism_task_details_work_kind_idx
  on public.journalism_task_details(work_kind_id);

create index journalism_task_details_publication_status_idx
  on public.journalism_task_details(publication_status);

create index journalism_task_details_planned_publication_idx
  on public.journalism_task_details(planned_publication_at)
  where planned_publication_at is not null;

create or replace function public.touch_journalism_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  new.updated_at = now();
  return new;
end
$function$;

create trigger journalism_work_kinds_set_updated_at
before update on public.journalism_work_kinds
for each row execute function public.touch_journalism_updated_at();

create trigger journalism_task_details_set_updated_at
before update on public.journalism_task_details
for each row execute function public.touch_journalism_updated_at();

insert into public.journalism_work_kinds(code, name, sort_order)
values
  ('news', 'Tin', 10),
  ('article', 'Bài viết', 20),
  ('interview', 'Phỏng vấn', 30),
  ('reportage', 'Phóng sự', 40),
  ('photo', 'Ảnh', 50),
  ('video', 'Video', 60),
  ('event_coverage', 'Tác nghiệp sự kiện', 70),
  ('editing', 'Biên tập', 80),
  ('translation', 'Biên dịch', 90),
  ('other', 'Khác', 100);

alter table public.journalism_work_kinds enable row level security;
alter table public.journalism_task_details enable row level security;

revoke all on table public.journalism_work_kinds from public, anon, authenticated;
revoke all on table public.journalism_task_details from public, anon, authenticated;
grant select, insert, update, delete on table public.journalism_work_kinds to service_role;
grant select, insert, update, delete on table public.journalism_task_details to service_role;

revoke all on function public.touch_journalism_updated_at() from public, anon, authenticated;
grant execute on function public.touch_journalism_updated_at() to service_role;

commit;
