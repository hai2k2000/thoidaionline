-- Extend the fail-closed personnel evaluation read model with read-only task
-- popup fields. The employee/date/task scope remains server-derived below.
-- Reuses the versioned 100-point rubric and existing two-step state machine.

create or replace function public.phase9_can_view_personnel_evaluation(
  p_actor uuid,
  p_employee uuid
)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with actor as (
    select u.id,r.code,
      coalesce(rp.can_evaluate_step1,false) as step1,
      coalesce(rp.can_evaluate_step2,false) as step2
    from public.staff_users u
    join public.roles r on r.id=u.role_id
    left join public.role_permissions rp on rp.role_id=r.id
    where u.id=p_actor and u.active=true
  ),
  employee as (
    select u.id,u.department_id
    from public.staff_users u
    where u.id=p_employee and u.active=true
  )
  select coalesce(bool_or(
    (actor.code='tong_bien_tap' and actor.step2 and employee.id<>actor.id)
    or
    (actor.step1 and employee.id<>actor.id and exists(
      select 1
      from public.departments d
      where d.id=employee.department_id
        and d.active=true
        and d.manager_id=p_actor
    ))
  ),false)
  from actor cross join employee
$function$;

create or replace function public.api_list_personnel_evaluation_subjects(
  p_actor uuid,
  p_from date,
  p_to date
)
returns table(
  employee_id uuid,
  employee_name text,
  department_id uuid,
  department_name text,
  is_department_manager boolean,
  review_id uuid,
  review_status text,
  workflow_type text,
  cycle_id uuid,
  cycle_name text,
  cycle_start date,
  cycle_end date,
  self_score numeric,
  manager_score numeric,
  final_score numeric,
  rank text
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $function$
declare
  v_role text;
  v_step1 boolean;
  v_step2 boolean;
  v_is_manager boolean;
  v_is_leader boolean;
begin
  if p_from is null or p_to is null or p_from>p_to then
    raise exception 'invalid evaluation date range' using errcode='22023';
  end if;
  select r.code,coalesce(rp.can_evaluate_step1,false),
    coalesce(rp.can_evaluate_step2,false)
  into v_role,v_step1,v_step2
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  left join public.role_permissions rp on rp.role_id=r.id
  where u.id=p_actor and u.active=true;
  v_is_manager:=coalesce(v_step1,false) and exists(
    select 1 from public.departments d
    where d.active=true and d.manager_id=p_actor
  );
  v_is_leader:=v_role='tong_bien_tap' and coalesce(v_step2,false);
  if not coalesce(v_is_manager or v_is_leader,false) then
    raise exception 'personnel evaluation forbidden' using errcode='42501';
  end if;

  return query
  select u.id,u.full_name,u.department_id,coalesce(d.name,'—'),
    exists(
      select 1 from public.departments managed
      where managed.active=true and managed.manager_id=u.id
    ) as is_department_manager,
    review.id,review.status,review.workflow_type,
    review.cycle_id,review.cycle_name,review.cycle_start,review.cycle_end,
    review.self_score,review.reviewer_score,review.final_score,review.rank
  from public.staff_users u
  left join public.departments d on d.id=u.department_id
  left join lateral (
    select pr.id,pr.status,pr.workflow_type,pr.cycle_id,
      pc.name as cycle_name,pc.start_date as cycle_start,
      pc.end_date as cycle_end,pr.self_score,pr.reviewer_score,
      pr.final_score,pr.rank
    from public.performance_reviews pr
    join public.performance_cycles pc on pc.id=pr.cycle_id
    where pr.employee_id=u.id
      and pc.start_date<=p_to
      and pc.end_date>=p_from
    order by pc.end_date desc,pc.start_date desc,
      pr.revision_no desc,pr.created_at desc,pr.id
    limit 1
  ) review on true
  where u.active=true
    and u.id<>p_actor
    and (
      v_is_leader
      or (
        v_is_manager
        and exists(
          select 1 from public.departments direct_department
          where direct_department.id=u.department_id
            and direct_department.active=true
            and direct_department.manager_id=p_actor
        )
      )
    )
  order by is_department_manager desc,
    lower(u.full_name),u.id;
end
$function$;

create or replace function public.api_get_personnel_evaluation_detail(
  p_actor uuid,
  p_employee uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $function$
declare
  v_employee_name text;
  v_department_name text;
  v_review public.performance_reviews;
  v_cycle public.performance_cycles;
  v_factors jsonb:='[]'::jsonb;
  v_scores jsonb:='[]'::jsonb;
  v_tasks jsonb:='[]'::jsonb;
  v_allowed_action text;
  v_role text;
  v_step1 boolean;
  v_step2 boolean;
  v_is_direct_manager boolean;
  v_is_leader boolean;
begin
  if p_from is null or p_to is null or p_from>p_to or p_employee is null then
    raise exception 'invalid evaluation detail request' using errcode='22023';
  end if;
  if not public.phase9_can_view_personnel_evaluation(p_actor,p_employee) then
    raise exception 'personnel evaluation forbidden' using errcode='42501';
  end if;

  select u.full_name,coalesce(d.name,'—')
  into v_employee_name,v_department_name
  from public.staff_users u
  left join public.departments d on d.id=u.department_id
  where u.id=p_employee and u.active=true;
  if not found then
    raise exception 'personnel evaluation forbidden' using errcode='42501';
  end if;

  select r.code,coalesce(rp.can_evaluate_step1,false),
    coalesce(rp.can_evaluate_step2,false)
  into v_role,v_step1,v_step2
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  left join public.role_permissions rp on rp.role_id=r.id
  where u.id=p_actor and u.active=true;
  v_is_direct_manager:=coalesce(v_step1,false) and exists(
    select 1
    from public.staff_users employee
    join public.departments d on d.id=employee.department_id
    where employee.id=p_employee and employee.active=true
      and d.active=true and d.manager_id=p_actor
  );
  v_is_leader:=v_role='tong_bien_tap' and coalesce(v_step2,false);

  select pr.*
  into v_review
  from public.performance_reviews pr
  join public.performance_cycles pc on pc.id=pr.cycle_id
  where pr.employee_id=p_employee
    and pc.start_date<=p_to
    and pc.end_date>=p_from
  order by pc.end_date desc,pc.start_date desc,
    pr.revision_no desc,pr.created_at desc,pr.id
  limit 1;

  if v_review.id is not null then
    select pc.* into v_cycle
    from public.performance_cycles pc
    where pc.id=v_review.cycle_id;
    v_factors:=coalesce(v_review.rubric_snapshot->'factors','[]'::jsonb);
    select coalesce(jsonb_agg(jsonb_build_object(
      'stage',s.stage,'factor_code',s.factor_code,'score',s.score,
      'comment',s.comment
    ) order by case s.stage when 'self' then 1 when 'manager' then 2 else 3 end,
      s.factor_code),'[]'::jsonb)
    into v_scores
    from public.performance_review_scores s
    where s.review_id=v_review.id;
    v_allowed_action:=case
      when v_is_direct_manager and v_review.status='awaiting_manager'
        then 'manager'
      when v_is_leader and v_review.status='awaiting_tbt'
        then 'tbt'
      else null
    end;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'position',f.position,'factor_code',f.factor_code,'label',f.label,
      'description',f.description,'max_score',f.max_score,
      'band_definitions',f.band_definitions
    ) order by f.position),'[]'::jsonb)
    into v_factors
    from public.evaluation_rubric_versions rv
    join public.evaluation_rubric_factors f on f.rubric_version_id=rv.id
    where rv.status='published';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',task.id,
    'title',task.title,
    'description',task.description,
    'status',task.status,
    'difficulty',task.priority,
    'department_id',task.department_id,
    'department_name',(select d.name from public.departments d where d.id=task.department_id),
    'assignee_id',coalesce(task.assignee_id,task.owner_id,(
      select ta.user_id from public.task_assignees ta
      where ta.task_id=task.id and ta.assignment_role<>'watcher'
      order by case ta.assignment_role when 'assignee' then 1 else 2 end,ta.user_id limit 1
    )),
    'assignee_name',(select assignee.full_name from public.staff_users assignee
      where assignee.id=coalesce(task.assignee_id,task.owner_id,(
        select ta.user_id from public.task_assignees ta
        where ta.task_id=task.id and ta.assignment_role<>'watcher'
        order by case ta.assignment_role when 'assignee' then 1 else 2 end,ta.user_id limit 1
      ))),
    'reviewer_id',task.reviewer_id,
    'reviewer_name',(select reviewer.full_name from public.staff_users reviewer where reviewer.id=task.reviewer_id),
    'completion_status',case when task.status='done'
      then 'completed' else 'unfinished' end,
    'deadline_outcome',case
      when task.due_date is null then 'no_deadline'
      when task.status='done' and
        coalesce(task.completion_submitted_at,task.completed_at,task.updated_at)::date
          <=task.due_date then 'on_time'
      when task.status='done' then 'overdue'
      when task.due_date<current_date then 'overdue'
      else 'in_time'
    end,
    'due_date',task.due_date,
    'evaluation_criteria',task.evaluation_criteria,
    'task_type',task.task_type,'assignment_mode',task.assignment_mode,'plan_period',task.plan_period,
    'progress_percent',coalesce(task.progress_percent,0),'start_date',task.start_date,
    'created_at',task.created_at,'completion_submitted_at',task.completion_submitted_at,
    'completed_at',task.completed_at,'cancelled_at',task.cancelled_at,'cancel_reason',task.cancel_reason,
    'owner_id',task.owner_id,'owner_name',(select u.full_name from public.staff_users u where u.id=task.owner_id),
    'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'created_at',a.created_at,'uploaded_by',a.uploaded_by) order by a.created_at desc) from public.task_attachments a where a.task_id=task.id),'[]'::jsonb),
    'progress_reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'reported_by',r.reported_by,'reported_on',r.reported_on,'report_status',r.report_status,'progress_text',r.progress_text,'blockers',r.blockers,'created_at',r.created_at) order by r.reported_on desc,r.created_at desc) from public.task_progress_reports r where r.task_id=task.id),'[]'::jsonb),
    'progress_logs',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'old_progress',l.old_progress,'new_progress',l.new_progress,'note',l.note,'created_at',l.created_at,'user_id',l.user_id) order by l.created_at desc) from public.task_progress_logs l where l.task_id=task.id),'[]'::jsonb),
    'comments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'content',c.content,'created_at',c.created_at,'user_id',c.user_id,'author_name',(select u.full_name from public.staff_users u where u.id=c.user_id)) order by c.created_at desc) from public.task_comments c where c.task_id=task.id),'[]'::jsonb),
    'qualitative_evaluations',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'evaluation_text',q.evaluation_text,'evaluation_deadline',q.evaluation_deadline,'evaluation_source',q.evaluation_source,'created_at',q.created_at,'evaluator_name',(select u.full_name from public.staff_users u where u.id=q.evaluator_id)) order by q.created_at desc) from public.task_qualitative_evaluations q where q.task_id=task.id),'[]'::jsonb),
    'legacy_evaluations',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'employee_id',e.employee_id,'opinion',e.opinion,'checkpoint_date',e.checkpoint_date,'created_at',e.created_at) order by e.checkpoint_date desc,e.created_at desc) from public.task_evaluation_checkpoints e where e.task_id=task.id),'[]'::jsonb),
    'deadline_history',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'old_due_date',h.old_due_date,'new_due_date',h.new_due_date,'reason',h.reason,'changed_at',h.changed_at) order by h.changed_at desc) from public.task_deadline_history h where h.task_id=task.id),'[]'::jsonb),
    'status_events',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'from_status',s.from_status,'to_status',s.to_status,'reason',s.reason,'created_at',s.created_at) order by s.created_at desc) from public.task_status_events s where s.task_id=task.id),'[]'::jsonb)
  ) order by task.due_date nulls last,lower(task.title),task.id),'[]'::jsonb)
  into v_tasks
  from public.tasks task
  where (
      task.owner_id=p_employee
      or task.assignee_id=p_employee
      or exists(
        select 1 from public.task_assignees ta
        where ta.task_id=task.id and ta.user_id=p_employee
          and ta.assignment_role<>'watcher'
      )
    )
    and coalesce(task.start_date,task.created_at::date)<=p_to
    and coalesce(
      task.due_date,
      task.completion_submitted_at::date,
      task.completed_at::date,
      p_to
    )>=p_from;

  return jsonb_build_object(
    'employee_id',p_employee,
    'employee_name',v_employee_name,
    'department_name',v_department_name,
    'review_id',v_review.id,
    'review_status',v_review.status,
    'workflow_type',v_review.workflow_type,
    'cycle_name',v_cycle.name,
    'cycle_start',v_cycle.start_date,
    'cycle_end',v_cycle.end_date,
    'allowed_action',v_allowed_action,
    'factors',v_factors,
    'scores',v_scores,
    'tasks',v_tasks
  );
end
$function$;

-- Scope is derived from departments.manager_id = p_actor and never from
-- a client-supplied department or employee relationship.
revoke all on function public.phase9_can_view_personnel_evaluation(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.api_list_personnel_evaluation_subjects(uuid,date,date)
  from public,anon,authenticated;
revoke all on function public.api_get_personnel_evaluation_detail(uuid,uuid,date,date)
  from public,anon,authenticated;
grant execute on function public.phase9_can_view_personnel_evaluation(uuid,uuid)
  to service_role;
grant execute on function public.api_list_personnel_evaluation_subjects(uuid,date,date)
  to service_role;
grant execute on function public.api_get_personnel_evaluation_detail(uuid,uuid,date,date)
  to service_role;
alter function public.phase9_can_view_personnel_evaluation(uuid,uuid)
  owner to postgres;
alter function public.api_list_personnel_evaluation_subjects(uuid,date,date)
  owner to postgres;
alter function public.api_get_personnel_evaluation_detail(uuid,uuid,date,date)
  owner to postgres;
