begin;

alter table public.work_schedules
  add column if not exists end_date date;

alter table public.work_schedules
  add column if not exists plan_type text not null default 'work';

update public.work_schedules
set end_date = work_date
where end_date is null;

alter table public.work_schedules
  alter column end_date set not null;

alter table public.work_schedules
  drop constraint if exists work_schedules_plan_type_check;

alter table public.work_schedules
  add constraint work_schedules_plan_type_check
  check (plan_type in ('work', 'business', 'event'));

alter table public.work_schedules
  drop constraint if exists work_schedules_date_range_check;

alter table public.work_schedules
  add constraint work_schedules_date_range_check
  check (end_date >= work_date);

create index if not exists work_schedules_date_range_idx
  on public.work_schedules(work_date, end_date);

commit;
