begin;
create or replace function public.default_direct_assignment_status()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  if new.task_type='assigned' and coalesce(new.self_claimable,false)=false and new.status='new' then
    new.status='in_progress';
  end if;
  return new;
end $function$;
drop trigger if exists default_direct_assignment_status on public.tasks;
create trigger default_direct_assignment_status
before insert on public.tasks
for each row execute function public.default_direct_assignment_status();
commit;
