begin;

create table public.editorial_topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  department_id uuid references public.departments(id) on delete restrict,
  is_active boolean not null default true,
  created_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editorial_topics_name_check check (
    name = btrim(name) and char_length(name) between 1 and 200
  ),
  constraint editorial_topics_description_length_check check (
    description is null or char_length(description) <= 5000
  )
);

create table public.editorial_series (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.editorial_topics(id) on delete restrict,
  name text not null,
  description text,
  department_id uuid references public.departments(id) on delete restrict,
  is_active boolean not null default true,
  created_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editorial_series_name_check check (
    name = btrim(name) and char_length(name) between 1 and 200
  ),
  constraint editorial_series_description_length_check check (
    description is null or char_length(description) <= 5000
  )
);

create table public.editorial_topic_tasks (
  topic_id uuid not null references public.editorial_topics(id) on delete restrict,
  task_id uuid not null references public.journalism_task_details(task_id) on delete cascade,
  created_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (topic_id, task_id)
);

create table public.editorial_series_items (
  series_id uuid not null references public.editorial_series(id) on delete restrict,
  task_id uuid not null references public.journalism_task_details(task_id) on delete cascade,
  position integer not null,
  created_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editorial_series_items_position_check check (position > 0),
  constraint editorial_series_items_series_position_unique unique (series_id, position),
  constraint editorial_series_items_task_unique unique (task_id)
);

create unique index editorial_topics_active_global_name_unique
  on public.editorial_topics ((lower(btrim(name))))
  where is_active and department_id is null;

create unique index editorial_topics_active_department_name_unique
  on public.editorial_topics (department_id, (lower(btrim(name))))
  where is_active and department_id is not null;

create unique index editorial_series_active_global_name_unique
  on public.editorial_series ((lower(btrim(name))))
  where is_active and department_id is null;

create unique index editorial_series_active_department_name_unique
  on public.editorial_series (department_id, (lower(btrim(name))))
  where is_active and department_id is not null;

create index editorial_topics_department_active_idx
  on public.editorial_topics(department_id, is_active);

create index editorial_series_topic_idx
  on public.editorial_series(topic_id);

create index editorial_series_department_active_idx
  on public.editorial_series(department_id, is_active);

create index editorial_topic_tasks_task_idx
  on public.editorial_topic_tasks(task_id);

create index editorial_series_items_series_position_idx
  on public.editorial_series_items(series_id, position);

create or replace function public.assert_journalism_structure_task()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if not exists (
    select 1 from public.journalism_task_details where task_id = new.task_id
  ) then
    raise exception 'journalism_structure_task_required';
  end if;
  return new;
end
$function$;

create or replace function public.assert_editorial_series_topic_compatibility()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_topic_department uuid;
begin
  if tg_table_name = 'editorial_topics' then
    if exists (
      select 1
      from public.editorial_series s
      where s.topic_id = new.id
        and new.department_id is not null
        and s.department_id is distinct from new.department_id
    ) then
      raise exception 'editorial_series_topic_department_mismatch';
    end if;
    return new;
  end if;

  if new.topic_id is null then
    return new;
  end if;

  select department_id into v_topic_department
  from public.editorial_topics
  where id = new.topic_id;

  if v_topic_department is not null
     and new.department_id is distinct from v_topic_department then
    raise exception 'editorial_series_topic_department_mismatch';
  end if;
  return new;
end
$function$;

create or replace function public.touch_editorial_structure_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  new.updated_at = now();
  return new;
end
$function$;

create constraint trigger editorial_topic_tasks_journalism_task_guard
after insert or update of task_id on public.editorial_topic_tasks
deferrable initially immediate
for each row execute function public.assert_journalism_structure_task();

create constraint trigger editorial_series_items_journalism_task_guard
after insert or update of task_id on public.editorial_series_items
deferrable initially immediate
for each row execute function public.assert_journalism_structure_task();

create constraint trigger editorial_series_topic_compatibility_guard
after insert or update of topic_id, department_id on public.editorial_series
deferrable initially immediate
for each row execute function public.assert_editorial_series_topic_compatibility();

create constraint trigger editorial_topic_series_compatibility_guard
after update of department_id on public.editorial_topics
deferrable initially immediate
for each row execute function public.assert_editorial_series_topic_compatibility();

create trigger editorial_topics_set_updated_at
before update on public.editorial_topics
for each row execute function public.touch_editorial_structure_updated_at();

create trigger editorial_series_set_updated_at
before update on public.editorial_series
for each row execute function public.touch_editorial_structure_updated_at();

create trigger editorial_series_items_set_updated_at
before update on public.editorial_series_items
for each row execute function public.touch_editorial_structure_updated_at();

alter table public.editorial_topics enable row level security;
alter table public.editorial_series enable row level security;
alter table public.editorial_topic_tasks enable row level security;
alter table public.editorial_series_items enable row level security;

revoke all on table public.editorial_topics from public, anon, authenticated;
revoke all on table public.editorial_series from public, anon, authenticated;
revoke all on table public.editorial_topic_tasks from public, anon, authenticated;
revoke all on table public.editorial_series_items from public, anon, authenticated;
grant select, insert, update, delete on table public.editorial_topics to service_role;
grant select, insert, update, delete on table public.editorial_series to service_role;
grant select, insert, update, delete on table public.editorial_topic_tasks to service_role;
grant select, insert, update, delete on table public.editorial_series_items to service_role;

revoke all on function public.assert_journalism_structure_task() from public, anon, authenticated;
revoke all on function public.assert_editorial_series_topic_compatibility() from public, anon, authenticated;
revoke all on function public.touch_editorial_structure_updated_at() from public, anon, authenticated;
grant execute on function public.assert_journalism_structure_task() to service_role;
grant execute on function public.assert_editorial_series_topic_compatibility() to service_role;
grant execute on function public.touch_editorial_structure_updated_at() to service_role;

commit;
