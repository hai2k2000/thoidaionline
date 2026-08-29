begin;

-- A returned task starts a new completion attempt.  Do not let a score from
-- the previous attempt remain attached to it or satisfy a later approval.
create or replace function public.require_task_score_before_done()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
begin
  if new.status='done'
     and old.status is distinct from 'done'
     and new.task_type='assigned'
     and coalesce(new.task_category,'regular')<>'duty'
     and not exists (
       select 1 from public.task_completion_scores s
       where s.task_id=new.id
         and (new.completion_submitted_at is null
           or s.updated_at>=new.completion_submitted_at)
     ) then
    raise exception 'Công việc phải được chấm điểm cho lần gửi hiện tại trước khi hoàn thành.' using errcode='22023';
  end if;
  if new.status='rejected' and old.status is distinct from 'rejected' then
    delete from public.task_completion_scores where task_id=new.id;
  end if;
  return new;
end
$function$;

drop trigger if exists require_task_score_before_done on public.tasks;
create trigger require_task_score_before_done
before update of status on public.tasks
for each row execute function public.require_task_score_before_done();

create or replace function public.api_review_assigned_task_completion(
  p_actor_id uuid,p_task_id uuid,p_decision text,p_reason text default null
)
returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks; v_status text; v_now timestamptz:=now();
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'review');
  select * into v_before from public.tasks where id=p_task_id for update;
  if v_before.task_type<>'assigned' or v_before.status<>'pending_review'
     or p_decision not in ('approve','return')
     or (p_decision='return' and nullif(btrim(p_reason),'') is null)
     or length(coalesce(p_reason,''))>2000 then
    raise exception 'Invalid assigned review.' using errcode='22023';
  end if;
  if p_decision='approve' and v_before.task_category is distinct from 'duty'
     and not exists (
       select 1 from public.task_completion_scores s
       where s.task_id=p_task_id
         and (v_before.completion_submitted_at is null
           or s.updated_at>=v_before.completion_submitted_at)
     ) then
    raise exception 'Công việc phải được chấm điểm cho lần gửi hiện tại trước khi hoàn thành.' using errcode='22023';
  end if;
  v_status:=case when p_decision='approve' then 'done' else 'rejected' end;
  update public.tasks set status=v_status,
    completed_at=case when p_decision='approve' then v_now else null end,
    updated_at=v_now where id=p_task_id returning * into v_after;
  if p_decision='return' then
    delete from public.task_completion_scores where task_id=p_task_id;
  end if;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
  values(p_task_id,'pending_review',v_status,nullif(btrim(p_reason),''),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,
    case when p_decision='approve' then 'approve' else 'return' end,
    jsonb_build_object('status','pending_review'),
    jsonb_build_object('status',v_status,'reason',nullif(btrim(p_reason),''),
      'completion_score_cleared',p_decision='return'));
  return v_after;
end
$function$;

revoke all on function public.api_review_assigned_task_completion(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.api_review_assigned_task_completion(uuid,uuid,text,text) to service_role;
alter function public.api_review_assigned_task_completion(uuid,uuid,text,text) owner to postgres;

commit;
