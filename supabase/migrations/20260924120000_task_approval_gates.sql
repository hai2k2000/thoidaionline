begin;

alter table public.tasks
  add column if not exists approval_required boolean not null default false;

create or replace function public.api_create_personal_task_v2(
  p_actor_id uuid,p_title text,p_description text,p_start_date date,p_due_date date,
  p_evaluation_criteria text default null,p_recurrence_frequency text default null,
  p_recurrence_ends_on date default null
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks; v_rule public.task_recurrence_rules; v_department uuid;
  v_manager uuid; v_month_end boolean;
begin
  select department_id into v_department from public.staff_users where id=p_actor_id and active=true;
  if not found then raise exception 'Invalid task actor.' using errcode='42501'; end if;
  select manager_id into v_manager from public.departments where id=v_department and active=true;
  if v_manager is null then
    raise exception 'Department requires a primary manager.' using errcode='22023';
  end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500
     or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or p_start_date is null or p_due_date is null or p_start_date>p_due_date
     or length(coalesce(p_evaluation_criteria,''))>10000
     or (p_recurrence_frequency is not null and p_recurrence_frequency not in ('daily','weekly','monthly'))
     or (p_recurrence_frequency is null and p_recurrence_ends_on is not null)
     or (p_recurrence_ends_on is not null and p_recurrence_ends_on<p_due_date) then
    raise exception 'Invalid personal task input.' using errcode='22023';
  end if;
  insert into public.tasks(title,description,status,progress_percent,assignee_id,owner_id,reviewer_id,
    assignment_mode,created_by,department_id,due_date,plan_period,self_claimable,task_type,
    start_date,evaluation_criteria,approval_required)
  values(btrim(p_title),btrim(p_description),'waiting',0,p_actor_id,p_actor_id,v_manager,'individual',
    p_actor_id,v_department,p_due_date,'ad_hoc',false,'personal',p_start_date,
    nullif(btrim(p_evaluation_criteria),''),true) returning * into v_task;
  insert into public.task_assignees(task_id,user_id,assignment_role,status)
  values(v_task.id,p_actor_id,'owner','todo') on conflict(task_id,user_id) do update set assignment_role='owner',status='todo';
  if p_recurrence_frequency is not null then
    v_month_end := p_recurrence_frequency='monthly'
      and p_due_date=(date_trunc('month',p_due_date)::date + interval '1 month - 1 day')::date;
    insert into public.task_recurrence_rules(
      title,description,department_id,assignee_id,reviewer_id,evaluation_criteria,
      collaborator_ids,watcher_ids,frequency,weekday,day_of_month,month_end,
      starts_on,ends_on,next_scheduled_for,created_by,task_type,start_offset_days
    ) values(
      btrim(p_title),btrim(p_description),v_department,p_actor_id,v_manager,
      nullif(btrim(p_evaluation_criteria),''),'{}'::uuid[],'{}'::uuid[],p_recurrence_frequency,
      case when p_recurrence_frequency='weekly' then extract(isodow from p_due_date)::smallint end,
      case when p_recurrence_frequency='monthly' then extract(day from p_due_date)::smallint end,
      v_month_end,p_due_date,p_recurrence_ends_on,
      public.task_recurrence_next_date(p_recurrence_frequency,extract(isodow from p_due_date)::smallint,
        extract(day from p_due_date)::smallint,v_month_end,p_due_date),p_actor_id,'personal',p_due_date-p_start_date
    ) returning * into v_rule;
    update public.tasks set recurrence_rule_id=v_rule.id where id=v_task.id returning * into v_task;
    insert into public.task_recurrence_occurrences(rule_id,scheduled_for,task_id)
    values(v_rule.id,p_due_date,v_task.id);
  end if;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
  values(v_task.id,null,'waiting','Chờ duyệt giao việc',p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',v_task.id,'create',jsonb_build_object('task_type','personal','status','waiting','approval_required',true));
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',v_task.id,'submit_assignment_approval',jsonb_build_object('status','waiting','approval_required',true,'reviewer_id',v_manager));
  return v_task;
end
$function$;

create or replace function public.api_approve_task_claim(
  p_actor_id uuid,p_task_id uuid,p_decision text,p_reason text default null
) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v public.tasks; v_allowed boolean := false; v_role text; v_department uuid; v_status text;
begin
  select * into v from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Không tìm thấy công việc.' using errcode='P0002'; end if;
  select r.code,u.department_id into v_role,v_department
  from public.staff_users u join public.roles r on r.id=u.role_id
  where u.id=p_actor_id and u.active=true;
  if v.approval_required then
    select coalesce(
      v_role in ('admin','tong_bien_tap','pho_tong_bien_tap')
      or (v_department=v.department_id and exists(select 1 from public.departments d where d.id=v.department_id and d.manager_id=p_actor_id)),
      false
    ) into v_allowed;
    if p_actor_id=v.created_by then v_allowed:=false; end if;
    if not v_allowed then raise exception 'Không có quyền duyệt giao việc.' using errcode='42501'; end if;
    if v.status<>'waiting' or p_decision not in ('approve','reject')
       or (p_decision='reject' and nullif(btrim(p_reason),'') is null) then
      raise exception 'Quyết định hoặc trạng thái không hợp lệ.' using errcode='22023';
    end if;
    v_status:=case when p_decision='approve' then 'in_progress' else 'rejected' end;
    update public.tasks set status=v_status,updated_at=now() where id=p_task_id returning * into v;
    insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
    values(p_task_id,'waiting',v_status,nullif(btrim(p_reason),''),p_actor_id);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
    values(p_actor_id,'task','tasks',p_task_id,case when p_decision='approve' then 'approve_assignment' else 'reject_assignment' end,
      jsonb_build_object('status','waiting','approval_required',true),jsonb_build_object('status',v_status,'reason',nullif(btrim(p_reason),'')));
    return v;
  end if;
  if v.task_type<>'assigned' or coalesce(v.self_claimable,false) is not true then
    raise exception 'Chỉ công việc tự nhận mới cần duyệt nhận việc.' using errcode='22023';
  end if;
  select (p_actor_id=v.reviewer_id or exists(
    select 1 from public.staff_users u join public.roles r on r.id=u.role_id
    where u.id=p_actor_id and u.active=true and r.code='admin'
  )) into v_allowed;
  if not coalesce(v_allowed,false) then raise exception 'Không có quyền duyệt nhận việc.' using errcode='42501'; end if;
  if v.status<>'waiting' then raise exception 'Công việc không ở trạng thái chờ duyệt nhận việc.' using errcode='22023'; end if;
  if p_decision not in ('approve','reject') or (p_decision='reject' and nullif(btrim(p_reason),'') is null) then raise exception 'Quyết định hoặc lý do không hợp lệ.' using errcode='22023'; end if;
  v_status:=case when p_decision='approve' then 'in_progress' else 'rejected' end;
  update public.tasks set status=v_status,updated_at=now() where id=p_task_id returning * into v;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,'waiting',v_status,nullif(btrim(p_reason),''),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,case when p_decision='approve' then 'approve_claim' else 'reject_claim' end,jsonb_build_object('status','waiting'),jsonb_build_object('status',v_status,'reason',nullif(btrim(p_reason),'')));
  return v;
end
$function$;

create or replace function public.api_complete_personal_task(p_actor_id uuid,p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks; v_now timestamptz:=now(); v_to text;
begin
  v_before := public.api_assert_personal_task_owner(p_actor_id,p_task_id,false);
  if v_before.status not in ('new','in_progress','blocked','waiting','rejected') then raise exception 'Invalid personal completion transition.' using errcode='22023'; end if;
  if v_before.approval_required then
    if v_before.status not in ('in_progress','blocked','rejected') then
      raise exception 'Assignment approval is required before completion.' using errcode='22023';
    end if;
    v_to:='pending_review';
    update public.tasks set status=v_to,completion_submitted_at=v_now,updated_at=v_now where id=p_task_id returning * into v_after;
    insert into public.task_status_events(task_id,from_status,to_status,actor_id) values(p_task_id,v_before.status,v_to,p_actor_id);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
    values(p_actor_id,'task','tasks',p_task_id,'submit_completion',jsonb_build_object('status',v_before.status),jsonb_build_object('status',v_to));
    return v_after;
  end if;
  update public.tasks set status='done',completion_submitted_at=v_now,completed_at=v_now,updated_at=v_now where id=p_task_id returning * into v_after;
  insert into public.task_status_events(task_id,from_status,to_status,actor_id) values(p_task_id,v_before.status,'done',p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'complete',jsonb_build_object('status',v_before.status),jsonb_build_object('status','done','completed_at',v_now));
  return v_after;
end
$function$;

create or replace function public.api_review_assigned_task_completion(
  p_actor_id uuid,p_task_id uuid,p_decision text,p_reason text default null
) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_before public.tasks; v_after public.tasks; v_status text; v_now timestamptz:=now(); v_action text;
  v_role text; v_actor_department uuid; v_allowed boolean := false;
begin
  select * into v_before from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if v_before.approval_required then
    select r.code,u.department_id into v_role,v_actor_department
    from public.staff_users u join public.roles r on r.id=u.role_id
    where u.id=p_actor_id and u.active=true;
    select coalesce(
      v_role in ('admin','tong_bien_tap','pho_tong_bien_tap')
      or (v_actor_department=v_before.department_id and exists(
        select 1 from public.departments d where d.id=v_before.department_id and d.manager_id=p_actor_id
      )),false
    ) into v_allowed;
    if p_actor_id=v_before.created_by or p_actor_id=v_before.owner_id then v_allowed:=false; end if;
    if not v_allowed then raise exception 'Task action forbidden.' using errcode='42501'; end if;
    if v_before.status<>'pending_review' or p_decision not in ('approve','return')
       or (p_decision='return' and nullif(btrim(p_reason),'') is null)
       or length(coalesce(p_reason,''))>2000 then raise exception 'Invalid completion review.' using errcode='22023'; end if;
    v_status:=case when p_decision='approve' then 'done' else 'in_progress' end;
    update public.tasks set status=v_status,progress_percent=case when p_decision='approve' then 100 else progress_percent end,
      completed_at=case when p_decision='approve' then v_now else null end,
      completion_submitted_at=case when p_decision='approve' then completion_submitted_at else null end,updated_at=v_now
      where id=p_task_id returning * into v_after;
    v_action:=case when p_decision='approve' then 'approve_completion' else 'request_rework' end;
    insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,'pending_review',v_status,nullif(btrim(p_reason),''),p_actor_id);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
    values(p_actor_id,'task','tasks',p_task_id,v_action,jsonb_build_object('status','pending_review'),jsonb_build_object('status',v_status,'reason',nullif(btrim(p_reason),'')));
    return v_after;
  end if;
  perform public.api_assert_task_action(p_actor_id,p_task_id,'review');
  if v_before.task_type<>'assigned' or v_before.status<>'pending_review' or p_decision not in ('approve','return')
     or (p_decision='return' and nullif(btrim(p_reason),'') is null) then raise exception 'Invalid assigned review.' using errcode='22023'; end if;
  v_status:=case when p_decision='approve' then 'done' else 'rejected' end;
  update public.tasks set status=v_status,progress_percent=case when p_decision='approve' then 100 else progress_percent end,
    completed_at=case when p_decision='approve' then v_now else null end,updated_at=v_now where id=p_task_id returning * into v_after;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,'pending_review',v_status,nullif(btrim(p_reason),''),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,case when p_decision='approve' then 'approve' else 'return' end,jsonb_build_object('status','pending_review'),jsonb_build_object('status',v_status,'reason',nullif(btrim(p_reason),'')));
  return v_after;
end
$function$;

-- Recurring personal plans use the same assignment approval gate as one-off
-- self-created plans. Existing assigned recurrence behavior remains unchanged.
create or replace function public.api_run_task_recurrence(p_run_on date default null)
returns integer
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_run_on date := coalesce(p_run_on,timezone('Asia/Ho_Chi_Minh',now())::date);
  v_rule public.task_recurrence_rules;
  v_scheduled date;
  v_task public.tasks;
  v_manager uuid;
  v_user uuid;
  v_created integer := 0;
  v_status text;
begin
  for v_rule in
    select * from public.task_recurrence_rules
    where active=true and next_scheduled_for<=v_run_on
    order by next_scheduled_for,id for update skip locked
  loop
    select manager_id into v_manager
    from public.departments where id=v_rule.department_id and active=true;

    if v_manager is null
       or not exists (select 1 from public.staff_users a where a.id=v_rule.assignee_id and a.active=true
         and (a.department_id=v_rule.department_id or exists (
           select 1 from public.departments ld
           join public.roles rr on rr.id=a.role_id
           left join public.job_titles jt on jt.id=a.job_title_id
           where ld.id=v_rule.department_id and ld.code='leadership' and ld.active=true
             and (lower(rr.code)='pho_tong_bien_tap' or lower(jt.code)='truong_phong')
         )))
       or (v_rule.task_type <> 'personal' and not exists (select 1 from public.staff_users u
         left join public.job_titles jt on jt.id=u.job_title_id
         left join public.roles rr on rr.id=u.role_id
         where u.id=v_rule.reviewer_id and u.active=true
           and ((u.department_id=v_rule.department_id and
                 (u.id=v_manager or (jt.active=true and lower(jt.code) in ('truong_phong','pho_truong_phong'))))
                or lower(rr.code) in ('tong_bien_tap','pho_tong_bien_tap')))) then
      update public.task_recurrence_rules set active=false,updated_at=now() where id=v_rule.id;
      insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
      values(v_rule.created_by,'task','task_recurrence_rules',v_rule.id,
        'deactivate_invalid_participants',jsonb_build_object('reason','department, assignee or reviewer is no longer active/eligible'));
      continue;
    end if;

    v_scheduled := v_rule.next_scheduled_for;
    while v_scheduled<=v_run_on and (v_rule.ends_on is null or v_scheduled<=v_rule.ends_on) loop
      if not exists(select 1 from public.task_recurrence_occurrences where rule_id=v_rule.id and scheduled_for=v_scheduled) then
        v_status := case when v_rule.task_type='personal' then 'waiting' else 'new' end;
        insert into public.tasks(
          title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,
          assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,
          task_type,start_date,evaluation_criteria,recurrence_rule_id,priority,approval_required
        ) values(
          v_rule.title,v_rule.description,v_rule.department_id,v_rule.assignee_id,
          v_rule.assignee_id,case when v_rule.task_type='personal' then v_manager else v_rule.reviewer_id end,v_rule.created_by,
          case when cardinality(v_rule.collaborator_ids)>0 then 'multi_user' else 'individual' end,
          v_scheduled,v_rule.due_time,v_status,0,'ad_hoc',false,v_rule.task_type,
          case when v_rule.task_type='personal' then v_scheduled-v_rule.start_offset_days else v_scheduled end,
          v_rule.evaluation_criteria,v_rule.id,v_rule.priority,v_rule.task_type='personal'
        ) returning * into v_task;
        insert into public.task_assignees(task_id,user_id,assignment_role,status)
        values(v_task.id,v_rule.assignee_id,'owner','todo');
        if v_rule.task_type='assigned' then
          foreach v_user in array coalesce(v_rule.collaborator_ids,'{}'::uuid[]) loop
            if v_user<>v_rule.assignee_id and exists(select 1 from public.staff_users where id=v_user and active=true) then
              insert into public.task_assignees(task_id,user_id,assignment_role,status)
              values(v_task.id,v_user,'assignee','todo') on conflict(task_id,user_id) do nothing;
            end if;
          end loop;
          if v_manager<>v_rule.assignee_id and not (v_manager=any(v_rule.collaborator_ids)) then
            insert into public.task_assignees(task_id,user_id,assignment_role,status)
            values(v_task.id,v_manager,'watcher','todo') on conflict(task_id,user_id) do nothing;
          end if;
          foreach v_user in array coalesce(v_rule.watcher_ids,'{}'::uuid[]) loop
            if v_user<>v_rule.assignee_id and not (v_user=any(v_rule.collaborator_ids))
               and exists(select 1 from public.staff_users where id=v_user and active=true) then
              insert into public.task_assignees(task_id,user_id,assignment_role,status)
              values(v_task.id,v_user,'watcher','todo') on conflict(task_id,user_id) do nothing;
            end if;
          end loop;
        end if;
        insert into public.task_recurrence_occurrences(rule_id,scheduled_for,task_id)
        values(v_rule.id,v_scheduled,v_task.id);
        if v_rule.task_type='personal' then
          insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
          values(v_task.id,null,'waiting','Chờ duyệt giao việc',v_rule.created_by);
          insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
          values(v_rule.created_by,'task','tasks',v_task.id,'create',
            jsonb_build_object('recurrence_rule_id',v_rule.id,'scheduled_for',v_scheduled,'task_type','personal','status','waiting','approval_required',true));
          insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
          values(v_rule.created_by,'task','tasks',v_task.id,'submit_assignment_approval',
            jsonb_build_object('recurrence_rule_id',v_rule.id,'scheduled_for',v_scheduled,'task_type','personal','approval_required',true,'reviewer_id',v_manager));
        else
          insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
          values(v_rule.created_by,'task','tasks',v_task.id,'create',
            jsonb_build_object('recurrence_rule_id',v_rule.id,'scheduled_for',v_scheduled,'due_time',v_rule.due_time));
        end if;
        v_created := v_created+1;
      end if;
      v_scheduled := public.task_recurrence_next_date(v_rule.frequency,v_rule.weekday,v_rule.day_of_month,v_rule.month_end,v_scheduled);
    end loop;
    update public.task_recurrence_rules set
      next_scheduled_for=v_scheduled,
      active=case when ends_on is not null and v_scheduled>ends_on then false else active end,
      updated_at=now()
    where id=v_rule.id;
  end loop;
  return v_created;
end
$function$;

revoke all on function public.api_create_personal_task_v2(uuid,text,text,date,date,text,text,date) from public,anon,authenticated;
revoke all on function public.api_approve_task_claim(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.api_complete_personal_task(uuid,uuid) from public,anon,authenticated;
revoke all on function public.api_review_assigned_task_completion(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.api_run_task_recurrence(date) from public,anon,authenticated;
grant execute on function public.api_create_personal_task_v2(uuid,text,text,date,date,text,text,date) to service_role;
grant execute on function public.api_approve_task_claim(uuid,uuid,text,text) to service_role;
grant execute on function public.api_complete_personal_task(uuid,uuid) to service_role;
grant execute on function public.api_review_assigned_task_completion(uuid,uuid,text,text) to service_role;
grant execute on function public.api_run_task_recurrence(date) to service_role;
alter function public.api_create_personal_task_v2(uuid,text,text,date,date,text,text,date) owner to postgres;
alter function public.api_approve_task_claim(uuid,uuid,text,text) owner to postgres;
alter function public.api_complete_personal_task(uuid,uuid) owner to postgres;
alter function public.api_review_assigned_task_completion(uuid,uuid,text,text) owner to postgres;
alter function public.api_run_task_recurrence(date) owner to postgres;
notify pgrst,'reload schema';
commit;
