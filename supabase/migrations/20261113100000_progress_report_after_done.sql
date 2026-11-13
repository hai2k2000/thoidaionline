begin;
-- Preserve the previous RPC except its acceptance and transition status gates.
create or replace function public.api_submit_task_progress_report(
  p_actor_id uuid,p_task_id uuid,p_reported_on date,p_report_status text,
  p_progress_text text,p_blockers text default null
)
returns public.task_progress_reports
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_before public.tasks;
  v_after_status text;
  v_report public.task_progress_reports;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'report');
  select * into v_before from public.tasks where id=p_task_id for update;
  if v_before.task_type is null or v_before.status='cancelled' then
    raise exception 'Task cannot accept progress reports.' using errcode='22023';
  end if;
  if p_reported_on is null
     or p_report_status not in ('in_progress','blocked','waiting','nearly_done')
     or nullif(btrim(p_progress_text),'') is null or length(p_progress_text)>10000
     or (p_report_status='blocked' and nullif(btrim(p_blockers),'') is null)
     or length(coalesce(p_blockers,''))>10000 then
    raise exception 'Invalid structured progress report.' using errcode='22023';
  end if;
  insert into public.task_progress_reports(task_id,reported_by,reported_on,report_status,progress_text,blockers)
  values(p_task_id,p_actor_id,p_reported_on,p_report_status,btrim(p_progress_text),nullif(btrim(p_blockers),''))
  returning * into v_report;
  v_after_status := case when v_before.status in ('pending_review','done') then v_before.status when p_report_status in ('blocked','waiting') then p_report_status else 'in_progress' end;
  if v_before.status is distinct from v_after_status then
    update public.tasks set status=v_after_status,updated_at=now() where id=p_task_id;
    insert into public.task_status_events(task_id,from_status,to_status,actor_id)
    values(p_task_id,v_before.status,v_after_status,p_actor_id);
  else
    update public.tasks set updated_at=now() where id=p_task_id;
  end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','task_progress_reports',v_report.id,'submit',
    jsonb_build_object('task_id',p_task_id,'report_status',p_report_status,'reported_on',p_reported_on));
  return v_report;
end
$function$;
revoke all on function public.api_submit_task_progress_report(uuid,uuid,date,text,text,text) from public,anon,authenticated;
grant execute on function public.api_submit_task_progress_report(uuid,uuid,date,text,text,text) to service_role;
alter function public.api_submit_task_progress_report(uuid,uuid,date,text,text,text) owner to postgres;
notify pgrst, 'reload schema';
commit;
