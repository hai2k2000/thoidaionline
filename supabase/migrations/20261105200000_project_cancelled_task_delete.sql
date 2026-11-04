-- Permanently delete cancelled project tasks after recording a compact audit trail.
begin;
-- The two existing plan guards permit only a link-only detach, by postgres
-- inside the audited delete transaction. All historical plan fields survive.
create or replace function public.project_task_delete_detach_allowed(p_old public.department_plan_items,p_new public.department_plan_items) returns boolean
language sql stable set search_path=public,pg_temp as $$
 select current_user='postgres'
 and p_old.linked_task_id is not null and p_new.linked_task_id is null
 and (to_jsonb(p_old)-'linked_task_id')=(to_jsonb(p_new)-'linked_task_id')
 and exists(select 1 from public.tasks t join public.audit_logs a on a.entity_id=t.id
   where t.id=p_old.linked_task_id and t.status='cancelled'
   and t.project_id::text=current_setting('thoidai.project_task_delete',true)
   and a.action='hard_delete' and a.module='project');
$$;
revoke all on function public.project_task_delete_detach_allowed(public.department_plan_items,public.department_plan_items) from public,anon,authenticated;
grant execute on function public.project_task_delete_detach_allowed(public.department_plan_items,public.department_plan_items) to service_role;
alter function public.project_task_delete_detach_allowed(public.department_plan_items,public.department_plan_items) owner to postgres;

create or replace function public.guard_closed_department_plan_v2()
returns trigger language plpgsql set search_path=public,pg_temp as $function$
declare v_plan_id uuid:=case when tg_op='DELETE' then old.department_plan_id else new.department_plan_id end;
begin
  if tg_op='UPDATE' and public.project_task_delete_detach_allowed(old,new) then return new; end if;
  if exists(select 1 from public.department_plans where id=v_plan_id and status='closed') then
    raise exception 'Closed department plan is read-only.' using errcode='22023';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$function$;
create or replace function public.guard_department_plan_assignment_claim()
returns trigger language plpgsql set search_path=public,pg_temp as $function$
begin
  if tg_op='UPDATE' and public.project_task_delete_detach_allowed(old,new) then return new; end if;
  if new.linked_task_id is not null and new.assignment_state is distinct from 'assigned' then
    raise exception 'Linked Department Plan items must remain assigned.' using errcode='23514';
  end if;
  if new.assignment_state='assigned' and new.linked_task_id is null then
    if tg_op='UPDATE' and old.assignment_state='assigned' and old.linked_task_id is null and new.assignee_id is not distinct from old.assignee_id then return new; end if;
    raise exception 'Assigned Department Plan items require a linked Task.' using errcode='23514';
  end if;
  return new;
end;
$function$;
create or replace function public.api_delete_cancelled_project_tasks(p_actor_id uuid, p_project_id uuid, p_task_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_count integer; v_paths text[]; v_status text; v_ids uuid[];
 v_previous_context text:=current_setting('thoidai.project_task_delete',true);
begin
  if not exists (select 1 from public.staff_users where id=p_actor_id and active) then raise exception 'Actor inactive.' using errcode='42501'; end if;
  if cardinality(coalesce(p_task_ids,'{}')) < 1 or cardinality(p_task_ids) > 100 or exists(select 1 from unnest(p_task_ids) x where x is null) then raise exception 'Invalid task ids.' using errcode='22023'; end if;
  select status into v_status from public.projects where id=p_project_id for update;
  if not public.api_project_is_lead(p_actor_id,p_project_id) then raise exception 'Project task deletion forbidden.' using errcode='42501'; end if;
  if v_status is null then raise exception 'Invalid project.' using errcode='22023'; end if;
  if v_status<>'active' and not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active and r.code='admin') then raise exception 'Project closed.' using errcode='55000'; end if;
  select array_agg(distinct x) into v_ids from unnest(p_task_ids) x;
  perform 1 from public.tasks where id=any(v_ids) order by id for update;
  if exists (select 1 from unnest(v_ids) x where not exists(select 1 from public.tasks t where t.id=x and t.project_id=p_project_id and t.status='cancelled')) then raise exception 'Every task must be a cancelled task in this project.' using errcode='22023'; end if;
  p_task_ids:=v_ids;
  select coalesce(array_agg(distinct storage_path),'{}') into v_paths from (
    select storage_path from public.task_attachments where task_id=any(v_ids)
    union select storage_path from public.project_library_items where source_task_id=any(v_ids)
    union select evidence_path from public.duty_task_reviews where task_id=any(v_ids)
  ) paths where storage_path is not null;
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data)
    select p_actor_id,'project','tasks',t.id,'hard_delete',jsonb_build_object('title',t.title,'status',t.status,'assignee_id',t.assignee_id,'created_by',t.created_by,'due_date',t.due_date,'project_id',t.project_id,'cancelled_at',t.cancelled_at,'updated_at',t.updated_at,'comments',(select count(*) from public.task_comments where task_id=t.id),'attachments',(select count(*) from public.task_attachments where task_id=t.id)) from public.tasks t where t.id=any(v_ids);
  delete from public.project_library_items where source_task_id=any(p_task_ids) or source_attachment_id in (select id from public.task_attachments where task_id=any(p_task_ids));
  perform set_config('thoidai.project_task_delete',p_project_id::text,true);
  update public.department_plan_items set linked_task_id=null where linked_task_id=any(p_task_ids);
  perform set_config('thoidai.project_task_delete',coalesce(v_previous_context,''),true);
  delete from public.task_deadline_history where task_id=any(p_task_ids);
  delete from public.task_progress_reports where task_id=any(p_task_ids);
  delete from public.task_status_events where task_id=any(p_task_ids);
  delete from public.task_attachments where task_id=any(p_task_ids);
  delete from public.task_recurrence_occurrences where task_id=any(p_task_ids);
  delete from public.task_completion_scores where task_id=any(p_task_ids);
  delete from public.task_evaluation_checkpoints where task_id=any(p_task_ids);
  delete from public.task_qualitative_evaluations where task_id=any(p_task_ids);
  delete from public.duty_task_reviews where task_id=any(p_task_ids);
  delete from public.journalism_task_details where task_id=any(p_task_ids);
  delete from public.tasks where id=any(p_task_ids) and project_id=p_project_id and status='cancelled';
  get diagnostics v_count = row_count;
  -- Retain bytes still referenced by any surviving library item or attachment.
  select coalesce(array_agg(path),'{}') into v_paths from unnest(v_paths) path where
    not exists(select 1 from public.project_library_items where storage_path=path)
    and not exists(select 1 from public.task_attachments where storage_path=path)
    and not exists(select 1 from public.duty_task_reviews where evidence_path=path);
  return jsonb_build_object('deleted',v_count,'storage_paths',to_jsonb(v_paths));
end $function$;
revoke all on function public.api_delete_cancelled_project_tasks(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.api_delete_cancelled_project_tasks(uuid,uuid,uuid[]) to service_role;
alter function public.api_delete_cancelled_project_tasks(uuid,uuid,uuid[]) owner to postgres;
commit;
