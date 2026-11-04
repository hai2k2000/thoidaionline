begin;


create or replace function public.api_admin_edit_task_unchecked(
  p_actor_id uuid,p_task_id uuid,p_title text,p_description text,
  p_start_date date,p_due_date date,p_due_time time,p_priority text,
  p_status text,p_evaluation_criteria text,p_reason text
) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks;
begin
  if not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active and r.active and r.code='admin') then raise exception 'Admin task edit forbidden.' using errcode='42501'; end if;
  select * into v_before from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500 or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or p_start_date is null or (p_due_date is not null and p_start_date>p_due_date)
     or (p_due_date is null and p_due_time is not null) or p_priority is null or p_priority not in ('low','normal','high','urgent')
     or p_status is null or p_status not in ('new','in_progress','blocked','waiting','pending_review','done','rejected','cancelled')
     or length(coalesce(p_evaluation_criteria,''))>10000 or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
    raise exception 'Invalid admin task edit.' using errcode='22023';
  end if;
  if v_before.task_type='assigned' and coalesce(v_before.task_category,'regular')<>'duty' and p_status='pending_review' and v_before.status is distinct from 'pending_review' then raise exception 'Assigned completion must be submitted by the assignee.' using errcode='22023'; end if;
  if v_before.task_type='assigned' and coalesce(v_before.task_category,'regular')<>'duty' and p_status='done' and v_before.status is distinct from 'done' and (v_before.status<>'pending_review' or v_before.completion_submitted_at is null or not exists(select 1 from public.task_completion_scores s where s.task_id=p_task_id and s.updated_at>=v_before.completion_submitted_at)) then raise exception 'Công việc phải được gửi và chấm điểm cho lần hiện tại trước khi hoàn thành.' using errcode='22023'; end if;
  update public.tasks set title=btrim(p_title),description=btrim(p_description),start_date=p_start_date,due_date=p_due_date,due_time=case when p_due_date is null then null else p_due_time end,priority=p_priority,status=p_status,progress_percent=case when p_status='done' then 100 else progress_percent end,evaluation_criteria=nullif(btrim(p_evaluation_criteria),''),completion_submitted_at=case when p_status='done' then coalesce(completion_submitted_at,now()) when v_before.task_type='assigned' and coalesce(v_before.task_category,'regular')<>'duty' then null else completion_submitted_at end,completed_at=case when p_status='done' then coalesce(completed_at,now()) else null end,cancelled_at=case when p_status='cancelled' then coalesce(cancelled_at,now()) else null end,cancelled_by=case when p_status='cancelled' then p_actor_id else null end,cancel_reason=case when p_status='cancelled' then btrim(p_reason) else null end,updated_at=now() where id=p_task_id returning * into v_after;
  if v_before.status='done' and p_status<>'done' and v_before.task_type='assigned' and coalesce(v_before.task_category,'regular')<>'duty' then delete from public.task_completion_scores where task_id=p_task_id; end if;
  if v_before.due_date is distinct from p_due_date then insert into public.task_deadline_history(task_id,old_due_date,new_due_date,reason,changed_by) values(p_task_id,v_before.due_date,p_due_date,btrim(p_reason),p_actor_id); end if;
  if v_before.status is distinct from p_status then insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,v_before.status,p_status,btrim(p_reason),p_actor_id); end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','tasks',p_task_id,'admin_edit',to_jsonb(v_before),to_jsonb(v_after)||jsonb_build_object('reason',btrim(p_reason)));
  return v_after;
end $function$;
revoke all on function public.api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text) from public,anon,authenticated,service_role;
alter function public.api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text) owner to postgres;

create or replace function public.api_admin_set_task_participants(p_actor_id uuid,p_task_id uuid,p_assignee_id uuid,p_collaborator_ids uuid[],p_watcher_ids uuid[],p_reviewer_id uuid,p_reason text) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_task public.tasks; v_after public.tasks; v_before jsonb;
begin
  if not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active and r.active and r.code='admin') then raise exception 'Admin participant edit forbidden.' using errcode='42501'; end if;
  v_task := public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'edit');
  if v_task.task_type is distinct from 'assigned' then raise exception 'Only assigned tasks support participant edits.' using errcode='22023'; end if;
  if p_assignee_id is null or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 or array_position(coalesce(p_collaborator_ids,'{}')||coalesce(p_watcher_ids,'{}'),null) is not null or exists(select 1 from unnest(coalesce(p_collaborator_ids,'{}')||coalesce(p_watcher_ids,'{}')) x(id) where x.id=p_assignee_id) or exists(select 1 from unnest(coalesce(p_collaborator_ids,'{}')) x(id) join unnest(coalesce(p_watcher_ids,'{}')) y(id) on x.id=y.id) then raise exception 'Invalid participant roles.' using errcode='22023'; end if;
  if not exists(select 1 from public.staff_users u where u.id=p_assignee_id and u.active) or exists(select 1 from unnest(coalesce(p_collaborator_ids,'{}')||coalesce(p_watcher_ids,'{}')||coalesce(array[p_reviewer_id],'{}')) x(id) where x.id is not null and not exists(select 1 from public.staff_users u where u.id=x.id and u.active)) then raise exception 'Inactive participant.' using errcode='22023'; end if;
  if v_task.project_id is not null and (not exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=v_task.project_id and m.user_id=p_assignee_id and u.active) or exists(select 1 from unnest(coalesce(p_collaborator_ids,'{}')||coalesce(p_watcher_ids,'{}')) x(id) where not exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=v_task.project_id and m.user_id=x.id and u.active)) or p_reviewer_id is null or not (exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=v_task.project_id and m.user_id=p_reviewer_id and m.role='lead' and u.active) or (p_reviewer_id=p_actor_id))) then raise exception 'Project participant or reviewer is invalid.' using errcode='22023'; end if;
  v_before := jsonb_build_object('assignee_id',v_task.assignee_id,'reviewer_id',v_task.reviewer_id,'collaborator_ids',(select coalesce(jsonb_agg(user_id order by user_id),'[]') from public.task_assignees where task_id=p_task_id and assignment_role='assignee'),'watcher_ids',(select coalesce(jsonb_agg(user_id order by user_id),'[]') from public.task_assignees where task_id=p_task_id and assignment_role='watcher'));
  -- Keep the existing manager trigger, including sibling-branch role semantics.
  -- Flush older events, then defer only the new role inserts until watcher edits finish.
  set constraints trg_assignee_manager_watcher immediate;
  set constraints trg_assignee_manager_watcher deferred;
  delete from public.task_assignees a where a.task_id=p_task_id and (
    (a.assignment_role='owner' and a.user_id<>p_assignee_id)
    or (a.assignment_role='assignee' and not (a.user_id=any(coalesce(p_collaborator_ids,'{}'))))
    or (a.assignment_role<>'owner' and a.user_id=p_assignee_id)
    or (a.assignment_role<>'assignee' and a.user_id=any(coalesce(p_collaborator_ids,'{}')))
  );
  insert into public.task_assignees(task_id,user_id,assignment_role,status)
  select p_task_id,x.id,x.role,'todo' from (
    select p_assignee_id id,'owner'::text role
    union select unnest(coalesce(p_collaborator_ids,'{}')),'assignee'
  ) x where not exists(select 1 from public.task_assignees a
    where a.task_id=p_task_id and a.user_id=x.id and a.assignment_role=x.role);
  -- Explicit watcher removals stick unless a NEW owner/assignee trigger re-adds them.
  delete from public.task_assignees where task_id=p_task_id and assignment_role='watcher'
    and not (user_id=any(coalesce(p_watcher_ids,'{}')));
  insert into public.task_assignees(task_id,user_id,assignment_role,status)
  select p_task_id,x.id,'watcher','todo' from (select distinct unnest(coalesce(p_watcher_ids,'{}')) id) x
  where not exists(select 1 from public.task_assignees a where a.task_id=p_task_id and a.user_id=x.id);
  set constraints trg_assignee_manager_watcher immediate;
  set constraints trg_assignee_manager_watcher deferred;
  update public.tasks set assignee_id=p_assignee_id,owner_id=p_assignee_id,reviewer_id=p_reviewer_id,
    assignment_mode=case when cardinality(coalesce(p_collaborator_ids,'{}'))>0 then 'multi_user' else 'individual' end,
    updated_at=now() where id=p_task_id returning * into v_after;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','task_assignees',p_task_id,'admin_participants',v_before,jsonb_build_object('assignee_id',p_assignee_id,'reviewer_id',p_reviewer_id,'collaborator_ids',coalesce(p_collaborator_ids,'{}'),'watcher_ids',(select coalesce(jsonb_agg(user_id order by user_id),'[]') from public.task_assignees where task_id=p_task_id and assignment_role='watcher'),'reason',btrim(p_reason)));
  return v_after;
end $function$;
revoke all on function public.api_admin_set_task_participants(uuid,uuid,uuid,uuid[],uuid[],uuid,text) from public,anon,authenticated;
grant execute on function public.api_admin_set_task_participants(uuid,uuid,uuid,uuid[],uuid[],uuid,text) to service_role;
alter function public.api_admin_set_task_participants(uuid,uuid,uuid,uuid[],uuid[],uuid,text) owner to postgres;
notify pgrst,'reload schema';
commit;
