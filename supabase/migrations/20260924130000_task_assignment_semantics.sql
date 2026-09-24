begin;

alter table public.tasks
  add column if not exists assignment_source text not null default 'legacy_unknown',
  add column if not exists assignment_approved_by uuid references public.staff_users(id),
  add column if not exists assignment_approved_at timestamptz;

alter table public.tasks drop constraint if exists tasks_assignment_source_check;
alter table public.tasks add constraint tasks_assignment_source_check
  check (assignment_source in ('leadership_assigned','self_registered','legacy_unknown'));

create or replace function public.set_task_assignment_source()
returns trigger language plpgsql as $function$
begin
  if new.assignment_source is null or new.assignment_source='legacy_unknown' then
    new.assignment_source := case when coalesce(new.approval_required,false)
      then 'self_registered' else 'leadership_assigned' end;
  end if;
  return new;
end
$function$;

drop trigger if exists tasks_assignment_source_before_insert on public.tasks;
create trigger tasks_assignment_source_before_insert
before insert on public.tasks
for each row execute function public.set_task_assignment_source();

create or replace function public.capture_task_assignment_approval()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
begin
  if new.from_status='waiting' and new.to_status='in_progress' then
    update public.tasks
    set assignment_approved_by = new.actor_id,
        assignment_approved_at = new.created_at
    where id = new.task_id
      and assignment_source = 'self_registered'
      and assignment_approved_by is null;
  end if;
  return new;
end
$function$;

drop trigger if exists task_status_events_capture_assignment_approval on public.task_status_events;
create trigger task_status_events_capture_assignment_approval
after insert on public.task_status_events
for each row execute function public.capture_task_assignment_approval();

notify pgrst,'reload schema';
commit;
