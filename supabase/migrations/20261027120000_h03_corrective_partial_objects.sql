begin;

drop trigger if exists journalism_work_kinds_set_updated_at on public.journalism_work_kinds;
create trigger journalism_work_kinds_set_updated_at
before update on public.journalism_work_kinds
for each row execute function public.touch_journalism_updated_at();

drop trigger if exists journalism_task_details_set_updated_at on public.journalism_task_details;
create trigger journalism_task_details_set_updated_at
before update on public.journalism_task_details
for each row execute function public.touch_journalism_updated_at();

create or replace function public.audit_direct_assignment_start()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
begin
  if new.task_type='assigned'
     and coalesce(new.self_claimable,false)=false
     and coalesce(new.task_category,'')<>'duty'
     and new.status='in_progress' then
    insert into public.task_status_events(task_id,from_status,to_status,actor_id)
    values(new.id,'new','in_progress',new.created_by);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
    values(new.created_by,'task','tasks',new.id,'start',
      jsonb_build_object('status','new'),
      jsonb_build_object('status','in_progress','reason','direct assignment default'));
  end if;
  return new;
end
$function$;

revoke all on function public.audit_direct_assignment_start() from public, anon, authenticated;
grant execute on function public.audit_direct_assignment_start() to service_role;

drop trigger if exists audit_direct_assignment_start on public.tasks;
create trigger audit_direct_assignment_start
after insert on public.tasks
for each row execute function public.audit_direct_assignment_start();

commit;
