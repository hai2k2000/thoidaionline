-- Phase 3: additive task schema and compatibility adapter.
-- This migration is intentionally idempotent and preserves every legacy row.

alter table public.tasks
  add column if not exists task_type text,
  add column if not exists start_date date,
  add column if not exists completion_submitted_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancel_reason text,
  add column if not exists evaluation_criteria text,
  add column if not exists recurrence_rule_id uuid;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.tasks'::regclass
      and conname='tasks_task_type_check'
  ) then
    alter table public.tasks
      add constraint tasks_task_type_check
      check (task_type is null or task_type in ('assigned','personal'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.tasks'::regclass
      and conname='tasks_cancelled_by_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_cancelled_by_fkey
      foreign key (cancelled_by) references public.staff_users(id);
  end if;
end
$migration$;

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks
  add constraint tasks_status_check
  check (status in (
    'new','in_progress','blocked','waiting',
    'pending_review','done','rejected','cancelled'
  ));

alter table public.tasks drop constraint if exists tasks_plan_period_check;
alter table public.tasks
  add constraint tasks_plan_period_check
  check (plan_period in ('ad_hoc','daily','weekly','monthly'));

create table if not exists public.task_deadline_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id),
  old_due_date date,
  new_due_date date,
  reason text not null check (length(btrim(reason)) > 0),
  changed_by uuid not null references public.staff_users(id),
  changed_at timestamptz not null default now()
);

create table if not exists public.task_progress_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id),
  reported_by uuid not null references public.staff_users(id),
  reported_on date not null,
  report_status text not null
    check (report_status in ('in_progress','blocked','waiting','nearly_done')),
  progress_text text not null check (length(btrim(progress_text)) > 0),
  blockers text,
  created_at timestamptz not null default now(),
  constraint task_progress_reports_blockers_check
    check (
      report_status <> 'blocked'
      or (blockers is not null and length(btrim(blockers)) > 0)
    )
);

create table if not exists public.task_status_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id),
  from_status text,
  to_status text not null,
  reason text,
  actor_id uuid not null references public.staff_users(id),
  created_at timestamptz not null default now(),
  constraint task_status_events_from_status_check
    check (
      from_status is null or from_status in (
        'new','in_progress','blocked','waiting',
        'pending_review','done','rejected','cancelled'
      )
    ),
  constraint task_status_events_to_status_check
    check (
      to_status in (
        'new','in_progress','blocked','waiting',
        'pending_review','done','rejected','cancelled'
      )
    ),
  constraint task_status_events_reason_check
    check (
      to_status not in ('rejected','cancelled')
      or (reason is not null and length(btrim(reason)) > 0)
    )
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id),
  storage_path text not null check (length(btrim(storage_path)) > 0),
  file_name text not null check (length(btrim(file_name)) > 0),
  mime_type text not null check (length(btrim(mime_type)) > 0),
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid not null references public.staff_users(id),
  created_at timestamptz not null default now(),
  unique (storage_path)
);

create table if not exists public.task_recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  description text,
  department_id uuid references public.departments(id),
  assignee_id uuid not null references public.staff_users(id),
  evaluation_criteria text,
  frequency text not null check (frequency in ('weekly','monthly')),
  weekday smallint check (weekday between 1 and 7),
  day_of_month smallint check (day_of_month between 1 and 31),
  timezone text not null default 'Asia/Ho_Chi_Minh'
    check (timezone='Asia/Ho_Chi_Minh'),
  starts_on date not null,
  ends_on date,
  next_scheduled_for date not null,
  active boolean not null default true,
  created_by uuid not null references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_recurrence_rules_schedule_check
    check (
      (frequency='weekly' and weekday is not null and day_of_month is null)
      or
      (frequency='monthly' and day_of_month is not null and weekday is null)
    ),
  constraint task_recurrence_rules_dates_check
    check (ends_on is null or ends_on >= starts_on)
);

create table if not exists public.task_recurrence_occurrences (
  rule_id uuid not null references public.task_recurrence_rules(id),
  scheduled_for date not null,
  task_id uuid not null references public.tasks(id),
  created_at timestamptz not null default now(),
  primary key (rule_id, scheduled_for),
  unique (task_id)
);

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.tasks'::regclass
      and conname='tasks_recurrence_rule_id_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_recurrence_rule_id_fkey
      foreign key (recurrence_rule_id)
      references public.task_recurrence_rules(id);
  end if;
end
$migration$;

create table if not exists public.evaluation_rubric_versions (
  id uuid primary key default gen_random_uuid(),
  version_no integer not null unique check (version_no > 0),
  status text not null check (status in ('draft','published','retired')),
  effective_from date,
  created_by uuid references public.staff_users(id),
  published_by uuid references public.staff_users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evaluation_rubric_factors (
  rubric_version_id uuid not null
    references public.evaluation_rubric_versions(id),
  position smallint not null check (position between 1 and 5),
  factor_code text not null check (length(btrim(factor_code)) > 0),
  label text not null check (length(btrim(label)) > 0),
  description text not null check (length(btrim(description)) > 0),
  max_score integer not null check (max_score > 0),
  band_definitions jsonb not null,
  primary key (rubric_version_id, factor_code),
  unique (rubric_version_id, position)
);

create or replace function public.guard_evaluation_rubric_version()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_count integer;
  v_total integer;
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then
      raise exception 'published rubric versions are immutable';
    end if;
    return old;
  end if;

  if tg_op='UPDATE' and old.status in ('published','retired') then
    if old.status='published'
       and new.status='retired'
       and new.version_no=old.version_no
       and new.effective_from is not distinct from old.effective_from
       and new.created_by is not distinct from old.created_by
       and new.published_by is not distinct from old.published_by
       and new.published_at is not distinct from old.published_at then
      new.updated_at := now();
      return new;
    end if;
    raise exception 'published rubric versions are immutable';
  end if;

  if new.status='published' and old.status is distinct from 'published' then
    select count(*), coalesce(sum(max_score),0)
      into v_count, v_total
    from public.evaluation_rubric_factors
    where rubric_version_id=new.id;
    if v_count <> 5 or v_total <> 100 then
      raise exception 'published rubric requires five factors totaling 100';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  new.updated_at := now();
  return new;
end
$function$;

create or replace function public.guard_evaluation_rubric_factor()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_status text;
  v_version uuid;
begin
  v_version := case when tg_op='DELETE'
    then old.rubric_version_id else new.rubric_version_id end;
  select status into v_status
  from public.evaluation_rubric_versions
  where id=v_version;
  if v_status is distinct from 'draft' then
    raise exception 'published rubric factors are immutable';
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$function$;

drop trigger if exists guard_evaluation_rubric_version
  on public.evaluation_rubric_versions;
create trigger guard_evaluation_rubric_version
before update or delete on public.evaluation_rubric_versions
for each row execute function public.guard_evaluation_rubric_version();

drop trigger if exists guard_evaluation_rubric_factor
  on public.evaluation_rubric_factors;
create trigger guard_evaluation_rubric_factor
before insert or update or delete on public.evaluation_rubric_factors
for each row execute function public.guard_evaluation_rubric_factor();

alter table public.performance_reviews
  add column if not exists rubric_version_id uuid,
  add column if not exists rubric_snapshot jsonb,
  add column if not exists workflow_type text,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid,
  add column if not exists supersedes_review_id uuid,
  add column if not exists revision_no integer not null default 1;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.performance_reviews'::regclass
      and conname='performance_reviews_rubric_version_id_fkey'
  ) then
    alter table public.performance_reviews
      add constraint performance_reviews_rubric_version_id_fkey
      foreign key (rubric_version_id)
      references public.evaluation_rubric_versions(id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.performance_reviews'::regclass
      and conname='performance_reviews_published_by_fkey'
  ) then
    alter table public.performance_reviews
      add constraint performance_reviews_published_by_fkey
      foreign key (published_by) references public.staff_users(id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.performance_reviews'::regclass
      and conname='performance_reviews_supersedes_review_id_fkey'
  ) then
    alter table public.performance_reviews
      add constraint performance_reviews_supersedes_review_id_fkey
      foreign key (supersedes_review_id)
      references public.performance_reviews(id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.performance_reviews'::regclass
      and conname='performance_reviews_workflow_type_check'
  ) then
    alter table public.performance_reviews
      add constraint performance_reviews_workflow_type_check
      check (workflow_type is null or workflow_type in ('employee','manager'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.performance_reviews'::regclass
      and conname='performance_reviews_revision_no_check'
  ) then
    alter table public.performance_reviews
      add constraint performance_reviews_revision_no_check
      check (revision_no > 0);
  end if;
end
$migration$;

alter table public.performance_reviews
  drop constraint if exists performance_reviews_status_check;
alter table public.performance_reviews
  add constraint performance_reviews_status_check
  check (status in (
    'draft','submitted','reviewed','approved',
    'self_draft','awaiting_manager','awaiting_tbt','published'
  ));

alter table public.performance_reviews
  drop constraint if exists performance_reviews_cycle_id_employee_id_key;
do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.performance_reviews'::regclass
      and conname='performance_reviews_cycle_employee_revision_key'
  ) then
    alter table public.performance_reviews
      add constraint performance_reviews_cycle_employee_revision_key
      unique (cycle_id,employee_id,revision_no);
  end if;
end
$migration$;

create table if not exists public.performance_review_scores (
  review_id uuid not null references public.performance_reviews(id),
  stage text not null check (stage in ('self','manager','tbt')),
  factor_code text not null,
  score numeric(6,2) not null check (score >= 0),
  comment text,
  actor_id uuid not null references public.staff_users(id),
  created_at timestamptz not null default now(),
  primary key (review_id,stage,factor_code)
);

create or replace function public.guard_published_performance_review()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if old.status='published' then
    raise exception 'published performance reviews are immutable';
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$function$;

drop trigger if exists guard_published_performance_review
  on public.performance_reviews;
create trigger guard_published_performance_review
before update or delete on public.performance_reviews
for each row execute function public.guard_published_performance_review();

insert into public.evaluation_rubric_versions (
  version_no,status,effective_from
)
values (1,'draft',date '2026-08-17')
on conflict (version_no) do nothing;

insert into public.evaluation_rubric_factors (
  rubric_version_id,position,factor_code,label,description,max_score,band_definitions
)
select v.id, seed.position, seed.factor_code, seed.label,
       seed.description, seed.max_score, seed.band_definitions
from public.evaluation_rubric_versions v
cross join (
  values
    (1,'work_effectiveness','Hiệu quả công việc, chất lượng đầu ra và phối hợp',
     'Đánh giá chất lượng, tiến độ, kết quả và phối hợp dựa trên bằng chứng.',40,
     '[{"min":35,"max":40},{"min":30,"max":34},{"min":20,"max":29},{"min":0,"max":19}]'::jsonb),
    (2,'responsibility','Trách nhiệm, chủ động tiếp nhận và xử lý công việc',
     'Đánh giá trách nhiệm, chủ động, phản hồi và theo việc đến cùng.',25,
     '[{"min":20,"max":25},{"min":15,"max":19},{"min":10,"max":14},{"min":0,"max":9}]'::jsonb),
    (3,'compliance','Chấp hành nội quy, kỷ luật và quy trình',
     'Đánh giá việc tuân thủ nội quy, hồ sơ, quy trình và chế độ báo cáo.',15,
     '[{"min":15,"max":15},{"min":10,"max":14},{"min":5,"max":9},{"min":0,"max":4}]'::jsonb),
    (4,'learning_challenge','Học tập và sẵn sàng nhận nhiệm vụ khó, phức tạp',
     'Đánh giá tinh thần học tập và mức độ sẵn sàng nhận việc khó.',10,
     '[{"min":8,"max":10},{"min":6,"max":7},{"min":4,"max":5},{"min":0,"max":3}]'::jsonb),
    (5,'innovation_technology','Sáng kiến, cải tiến và ứng dụng công nghệ hiệu quả',
     'Đánh giá sáng kiến, cải tiến và ứng dụng công nghệ có bằng chứng.',10,
     '[{"min":8,"max":10},{"min":6,"max":7},{"min":4,"max":5},{"min":0,"max":3}]'::jsonb)
) as seed(position,factor_code,label,description,max_score,band_definitions)
where v.version_no=1 and v.status='draft'
on conflict (rubric_version_id,factor_code) do nothing;

update public.evaluation_rubric_versions
set status='published'
where version_no=1 and status='draft';

update public.tasks
set task_type='assigned'
where task_type is null
  and plan_period='ad_hoc'
  and self_claimable=false;

update public.tasks t
set task_type='personal'
where t.task_type is null
  and t.plan_period in ('daily','weekly','monthly')
  and (
    t.owner_id is not null
    or t.assignee_id is not null
    or exists (
      select 1 from public.task_assignees a
      where a.task_id=t.id
        and a.assignment_role in ('owner','assignee')
    )
  );

update public.tasks
set start_date=(created_at at time zone 'Asia/Ho_Chi_Minh')::date
where task_type is not null and start_date is null;

do $migration$
begin
  if exists (
    select 1 from public.tasks
    where task_type is not null
      and (start_date is null or due_date is null)
  ) then
    raise exception 'mapped tasks require start_date and due_date';
  end if;
end
$migration$;

create or replace view public.task_compatibility_v1
with (security_invoker=true)
as
select
  t.*,
  (t.task_type is null) as legacy_read_only,
  coalesce(
    t.task_type,
    case
      when t.plan_period='ad_hoc' and not t.self_claimable then 'assigned'
      when t.plan_period in ('daily','weekly','monthly')
           and (
             t.owner_id is not null
             or t.assignee_id is not null
             or exists (
               select 1 from public.task_assignees a
               where a.task_id=t.id
                 and a.assignment_role in ('owner','assignee')
             )
           )
        then 'personal'
      else null
    end
  ) as compatibility_task_type
from public.tasks t;

create index if not exists tasks_type_status_due_created_idx
  on public.tasks(task_type,status,due_date,created_at desc);
create index if not exists tasks_assignee_status_due_idx
  on public.tasks(assignee_id,status,due_date);
create index if not exists tasks_department_status_due_idx
  on public.tasks(department_id,status,due_date);
create index if not exists tasks_created_by_created_idx
  on public.tasks(created_by,created_at desc);
create index if not exists task_assignees_user_role_task_idx
  on public.task_assignees(user_id,assignment_role,task_id);
create index if not exists task_comments_task_created_idx
  on public.task_comments(task_id,created_at desc);
create index if not exists task_progress_reports_task_reported_idx
  on public.task_progress_reports(task_id,reported_on desc,created_at desc);
create index if not exists task_deadline_history_task_changed_idx
  on public.task_deadline_history(task_id,changed_at desc);
create index if not exists task_status_events_task_created_idx
  on public.task_status_events(task_id,created_at desc);
create index if not exists task_attachments_task_created_idx
  on public.task_attachments(task_id,created_at desc);
create index if not exists performance_reviews_employee_cycle_status_idx
  on public.performance_reviews(employee_id,cycle_id,status);
create index if not exists performance_review_scores_review_stage_factor_idx
  on public.performance_review_scores(review_id,stage,factor_code);

revoke all on table
  public.task_deadline_history,
  public.task_progress_reports,
  public.task_status_events,
  public.task_attachments,
  public.task_recurrence_rules,
  public.task_recurrence_occurrences,
  public.evaluation_rubric_versions,
  public.evaluation_rubric_factors,
  public.performance_review_scores,
  public.task_compatibility_v1
from public, anon, authenticated;

grant select,insert,update,delete on table
  public.task_deadline_history,
  public.task_progress_reports,
  public.task_status_events,
  public.task_attachments,
  public.task_recurrence_rules,
  public.task_recurrence_occurrences,
  public.evaluation_rubric_versions,
  public.evaluation_rubric_factors,
  public.performance_review_scores
to service_role;

grant select on table public.task_compatibility_v1 to service_role;

revoke all on function
  public.guard_evaluation_rubric_version(),
  public.guard_evaluation_rubric_factor(),
  public.guard_published_performance_review()
from public, anon, authenticated;
