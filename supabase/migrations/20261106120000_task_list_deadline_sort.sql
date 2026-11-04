begin;

alter table public.tasks
  add column if not exists list_closed boolean generated always as (status in ('done', 'cancelled')) stored,
  add column if not exists list_due_at timestamp generated always as (
    case when due_date is null then null else due_date + coalesce(due_time, time '23:59') end
  ) stored,
  add column if not exists list_priority_rank smallint generated always as (
    case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end
  ) stored;

create index if not exists tasks_list_deadline_order_idx
  on public.tasks (list_closed, list_due_at, created_at desc, id);

commit;
