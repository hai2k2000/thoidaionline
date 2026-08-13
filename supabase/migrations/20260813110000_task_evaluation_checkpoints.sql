begin;

alter table public.tasks
  add column if not exists effort_weight integer not null default 1;

alter table public.tasks
  drop constraint if exists tasks_effort_weight_check;

alter table public.tasks
  add constraint tasks_effort_weight_check
  check (effort_weight in (1, 2, 3, 5, 8));

create or replace function public.protect_task_effort_weight()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'anon' and new.effort_weight is distinct from old.effort_weight then
    raise exception 'Trọng số công việc chỉ được cập nhật qua chức năng đánh giá.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_task_effort_weight on public.tasks;
create trigger protect_task_effort_weight
before update of effort_weight on public.tasks
for each row execute function public.protect_task_effort_weight();

create table if not exists public.task_evaluation_checkpoints (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  employee_id uuid not null references public.staff_users(id),
  reviewer_id uuid not null references public.staff_users(id),
  rating integer not null check (rating between 1 and 10),
  effort_weight integer not null default 1 check (effort_weight in (1, 2, 3, 5, 8)),
  completion text not null default 'done' check (completion in ('not_done', 'done', 'excellent')),
  on_time boolean not null default true,
  opinion text,
  checkpoint_date date not null default current_date,
  is_final boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_evaluation_checkpoints_task_employee
  on public.task_evaluation_checkpoints(task_id, employee_id, checkpoint_date desc, created_at desc);

create index if not exists idx_task_evaluation_checkpoints_employee_final
  on public.task_evaluation_checkpoints(employee_id, is_final, checkpoint_date desc, created_at desc);

alter table public.task_evaluation_checkpoints enable row level security;

drop policy if exists "public read task_evaluation_checkpoints" on public.task_evaluation_checkpoints;
create policy "public read task_evaluation_checkpoints"
  on public.task_evaluation_checkpoints for select to anon using (true);

revoke insert, update, delete on public.task_evaluation_checkpoints from anon;
grant select on public.task_evaluation_checkpoints to anon;

create or replace function public.save_task_evaluation_checkpoint(
  p_actor_id uuid,
  p_task_id uuid,
  p_employee_id uuid,
  p_rating integer,
  p_effort_weight integer,
  p_completion text,
  p_on_time boolean,
  p_opinion text,
  p_checkpoint_date date,
  p_is_final boolean
)
returns public.task_evaluation_checkpoints
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkpoint public.task_evaluation_checkpoints;
  v_allowed boolean;
begin
  select exists (
    select 1
    from public.staff_users u
    join public.roles r on r.id = u.role_id
    left join public.role_permissions rp on rp.role_id = r.id
    where u.id = p_actor_id
      and u.active = true
      and (r.code = 'tong_bien_tap' or coalesce(rp.can_manage_users, false) = true)
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Bạn không có quyền lưu đánh giá công việc.' using errcode = '42501';
  end if;

  if p_rating not between 1 and 10 then
    raise exception 'Điểm đánh giá phải từ 1 đến 10.' using errcode = '22023';
  end if;

  if p_effort_weight not in (1, 2, 3, 5, 8) then
    raise exception 'Trọng số công việc không hợp lệ.' using errcode = '22023';
  end if;

  if p_completion not in ('not_done', 'done', 'excellent') then
    raise exception 'Mức hoàn thành không hợp lệ.' using errcode = '22023';
  end if;

  if p_checkpoint_date is null then
    raise exception 'Ngày đánh giá là bắt buộc.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and (
        t.assignee_id = p_employee_id
        or exists (
          select 1 from public.task_assignees ta
          where ta.task_id = t.id and ta.user_id = p_employee_id and ta.assignment_role <> 'watcher'
        )
      )
  ) then
    raise exception 'Nhân viên không được giao công việc này.' using errcode = '22023';
  end if;

  update public.tasks
  set effort_weight = p_effort_weight,
      updated_at = now()
  where id = p_task_id;

  insert into public.task_evaluation_checkpoints (
    task_id, employee_id, reviewer_id, rating, effort_weight,
    completion, on_time, opinion, checkpoint_date, is_final
  ) values (
    p_task_id, p_employee_id, p_actor_id, p_rating, p_effort_weight,
    p_completion, p_on_time, nullif(btrim(p_opinion), ''), p_checkpoint_date, p_is_final
  )
  returning * into v_checkpoint;

  return v_checkpoint;
end;
$$;

revoke all on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) from public;
grant execute on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) to anon;

commit;