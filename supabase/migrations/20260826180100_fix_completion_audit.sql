begin;
create or replace function public.api_submit_assigned_task_completion(p_actor_id uuid,p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.tasks; v_from_status text; v_now timestamptz:=now();
begin
 select * into v from public.tasks where id=p_task_id for update;
 if not found or v.assignee_id<>p_actor_id or v.task_type<>'assigned' or v.status not in ('in_progress','blocked','waiting','rejected') then raise exception 'Task action forbidden.' using errcode='42501'; end if;
 v_from_status:=v.status;
 update public.tasks set status='pending_review',completion_submitted_at=v_now,updated_at=v_now where id=p_task_id returning * into v;
 insert into public.task_status_events(task_id,from_status,to_status,actor_id) values(p_task_id,v_from_status,'pending_review',p_actor_id);
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','tasks',p_task_id,'submit',jsonb_build_object('status',v_from_status),jsonb_build_object('status','pending_review','completion_submitted_at',v_now));
 return v;
end $function$;
commit;
