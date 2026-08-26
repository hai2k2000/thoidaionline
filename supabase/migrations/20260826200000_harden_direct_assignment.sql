begin;
create or replace function public.default_direct_assignment_status()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_from text;
begin
  if new.task_type='assigned' and coalesce(new.self_claimable,false)=false
     and coalesce(new.task_category,'')<>'duty' and new.status='new' then
    new.status='in_progress';
  end if;
  return new;
end $function$;

do $block$
declare v public.tasks;
begin
  for v in select * from public.tasks where task_type='assigned' and self_claimable=false and status='new' and coalesce(task_category,'')<>'duty' order by created_at,id for update loop
    update public.tasks set status='in_progress',updated_at=now() where id=v.id;
    insert into public.task_status_events(task_id,from_status,to_status,actor_id) values(v.id,'new','in_progress',v.created_by);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(v.created_by,'task','tasks',v.id,'start',jsonb_build_object('status','new'),jsonb_build_object('status','in_progress','reason','direct assignment default'));
  end loop;
end $block$;
commit;
