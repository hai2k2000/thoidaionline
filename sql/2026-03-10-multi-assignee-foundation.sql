-- Multi-assignee (no subtask split yet) + foundation for parent/child tasks

alter table public.tasks add column if not exists owner_id uuid references public.staff_users(id);
alter table public.tasks add column if not exists parent_task_id uuid references public.tasks(id) on delete set null;
alter table public.tasks add column if not exists assignment_mode text not null default 'individual'
  check (assignment_mode in ('individual','multi_user','department','mixed'));

create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.staff_users(id),
  assignment_role text not null default 'assignee' check (assignment_role in ('owner','assignee','watcher')),
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  note text,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table public.task_assignees enable row level security;

drop policy if exists "public read task_assignees" on public.task_assignees;
drop policy if exists "public write task_assignees" on public.task_assignees;

create policy "public read task_assignees" on public.task_assignees for select to anon using (true);
create policy "public write task_assignees" on public.task_assignees for all to anon using (true) with check (true);

-- backfill from current single-assignee model
update public.tasks
set owner_id = coalesce(owner_id, assignee_id),
    assignment_mode = case when assignment_mode is null then 'individual' else assignment_mode end;

insert into public.task_assignees (task_id, user_id, assignment_role, status)
select t.id, t.assignee_id, 'owner',
  case when t.progress_percent >= 100 or t.status = 'done' then 'done'
       when t.progress_percent > 0 then 'in_progress'
       else 'todo' end
from public.tasks t
where t.assignee_id is not null
on conflict (task_id, user_id) do update
set assignment_role = excluded.assignment_role;