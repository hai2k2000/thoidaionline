begin;

alter table public.department_plans
  add column if not exists status text not null default 'active',
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.staff_users(id),
  add column if not exists close_note text;

alter table public.department_plans drop constraint if exists department_plans_status_check;
alter table public.department_plans add constraint department_plans_status_check
  check (status in ('active','closed'));

alter table public.department_plan_items
  add column if not exists period_relation text not null default 'NEW',
  add column if not exists work_source text,
  add column if not exists period_goal text,
  add column if not exists period_start_state text,
  add column if not exists period_end_state text,
  add column if not exists result_this_period text,
  add column if not exists period_milestone_at timestamptz,
  add column if not exists carry_over_reason text,
  add column if not exists progress_start integer,
  add column if not exists progress_end integer,
  add column if not exists carried_from_item_id uuid,
  add column if not exists close_classification text,
  add column if not exists task_status_at_close text,
  add column if not exists completed_in_period boolean,
  add column if not exists carry_forward boolean;

alter table public.department_plan_items drop constraint if exists department_plan_items_period_relation_check;
alter table public.department_plan_items add constraint department_plan_items_period_relation_check
  check (period_relation in ('NEW','LONG_RUNNING','CARRY_OVER','RECURRING','AUTO_ADDED_DURING_PERIOD','IMPORTED'));

alter table public.department_plan_items drop constraint if exists department_plan_items_close_classification_check;
alter table public.department_plan_items add constraint department_plan_items_close_classification_check
  check (close_classification is null or close_classification in ('COMPLETED','LONG_RUNNING','CARRY_OVER','RECURRING','CANCELLED','NOT_CONTINUING'));

alter table public.department_plan_items drop constraint if exists department_plan_items_progress_check;
alter table public.department_plan_items add constraint department_plan_items_progress_check
  check ((progress_start is null or progress_start between 0 and 100) and (progress_end is null or progress_end between 0 and 100));

alter table public.department_plan_items drop constraint if exists department_plan_items_carried_from_fk;
alter table public.department_plan_items add constraint department_plan_items_carried_from_fk
  foreign key (carried_from_item_id) references public.department_plan_items(id) on delete set null;

alter table public.department_plan_items drop constraint if exists department_plan_items_linked_task_id_key;
create unique index if not exists department_plan_items_task_period_uidx
  on public.department_plan_items(department_plan_id, linked_task_id) where linked_task_id is not null;
create index if not exists department_plan_items_relation_idx on public.department_plan_items(department_plan_id, period_relation);
create index if not exists department_plan_items_carried_from_idx on public.department_plan_items(carried_from_item_id);
create index if not exists department_plans_active_period_idx on public.department_plans(department_id, status, period_start, period_end);

create or replace function public.api_department_plan_candidates_v2(
  p_actor_id uuid, p_department_id uuid, p_period_type text, p_period_start date, p_period_end date
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_role text; v_actor_department uuid; v_candidates jsonb;
begin
  select r.code,u.department_id into v_role,v_actor_department from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active=true;
  if v_role is null then raise exception 'Invalid actor.' using errcode='42501'; end if;
  if v_role not in ('admin','tong_bien_tap','pho_tong_bien_tap') and not exists(select 1 from public.departments d where d.id=p_department_id and d.manager_id=p_actor_id and v_actor_department=p_department_id) then raise exception 'Department plan is outside actor scope.' using errcode='42501'; end if;
  if p_period_type not in ('weekly','monthly') or p_period_start is null or p_period_end is null then raise exception 'Invalid department plan period.' using errcode='22023'; end if;
  with previous_items as (
    select distinct on (i.linked_task_id) i.linked_task_id,i.id previous_item_id,i.result_this_period,i.carry_over_reason
    from public.department_plan_items i join public.department_plans p on p.id=i.department_plan_id
    where p.department_id=p_department_id and p.period_end<p_period_start and i.linked_task_id is not null and coalesce(i.close_classification,'') in ('CARRY_OVER','LONG_RUNNING')
    order by i.linked_task_id,p.period_end desc
  ), candidates as (
    select distinct on (t.id) t.id task_id,t.title,t.description,t.assignee_id,t.due_date,t.due_time,t.status,t.progress_percent,t.assignment_source,t.workflow_type,t.recurrence_rule_id,
      case when pi.previous_item_id is not null then 'CARRY_OVER' when t.recurrence_rule_id is not null then 'RECURRING' when coalesce(t.start_date,p_period_start)<p_period_start or coalesce(t.due_date,t.start_date)>p_period_end then 'LONG_RUNNING' else 'NEW' end period_relation,
      pi.previous_item_id,pi.result_this_period previous_result,pi.carry_over_reason previous_carry_over_reason
    from public.tasks t left join previous_items pi on pi.linked_task_id=t.id
    where t.department_id=p_department_id and t.status in ('new','in_progress','blocked','waiting','pending_review')
      and (((t.start_date is not null and t.start_date<=p_period_end and coalesce(t.due_date,t.start_date)>=p_period_start) or t.due_date between p_period_start and p_period_end)
        or exists(select 1 from public.task_recurrence_occurrences ro where ro.task_id=t.id and ro.scheduled_for between p_period_start and p_period_end) or pi.previous_item_id is not null)
      and not exists(select 1 from public.department_plan_items i join public.department_plans p on p.id=i.department_plan_id and p.period_type=p_period_type and p.period_start=p_period_start where i.linked_task_id=t.id)
    order by t.id,(pi.previous_item_id is not null) desc
  )
  select coalesce(jsonb_agg(jsonb_build_object('taskId',task_id,'title',title,'description',description,'assigneeId',assignee_id,'dueDate',due_date,'dueTime',due_time,'status',status,'progressPercent',progress_percent,'assignmentSource',assignment_source,'workflowType',workflow_type,'periodRelation',period_relation,'previousItemId',previous_item_id,'previousResult',previous_result,'carryOverReason',previous_carry_over_reason) order by due_date nulls last,title),'[]'::jsonb) into v_candidates from candidates;
  return v_candidates;
end;
$function$;

create or replace function public.api_create_department_plan_v2(
  p_actor_id uuid,p_department_id uuid,p_period_type text,p_period_start date,p_period_end date,p_items jsonb default '[]'::jsonb
) returns public.department_plans language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_plan public.department_plans; v_role text; v_actor_department uuid; v_entry jsonb; v_task public.tasks; v_previous public.department_plan_items; v_relation text; v_due timestamptz; v_assignee uuid;
begin
  select r.code,u.department_id into v_role,v_actor_department from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active=true;
  if v_role is null or (v_role not in ('admin','tong_bien_tap','pho_tong_bien_tap') and not exists(select 1 from public.departments d where d.id=p_department_id and d.manager_id=p_actor_id and v_actor_department=p_department_id)) then raise exception 'Department plan is outside actor scope.' using errcode='42501'; end if;
  select public.api_get_or_create_department_plan(p_department_id,p_period_type,p_period_start,p_period_end,p_actor_id) into v_plan;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Invalid plan items.' using errcode='22023'; end if;
  for v_entry in select value from jsonb_array_elements(p_items) loop
    if nullif(v_entry->>'taskId','') is null then
      if nullif(btrim(v_entry->>'title'),'') is null then raise exception 'Plan item title is required.' using errcode='22023'; end if;
      insert into public.department_plan_items(department_plan_id,department_id,title,description,requirements,due_at,assignment_state,work_status,created_by,period_relation,work_source,period_goal,period_milestone_at,carry_over_reason)
      values(v_plan.id,p_department_id,btrim(v_entry->>'title'),nullif(btrim(v_entry->>'description'),''),nullif(btrim(v_entry->>'requirements'),''),case when nullif(v_entry->>'dueAt','') is null then null else (v_entry->>'dueAt')::timestamptz end,'unassigned',coalesce(nullif(v_entry->>'workStatus',''),'planned'),p_actor_id,coalesce(nullif(v_entry->>'periodRelation',''),'NEW'),nullif(btrim(v_entry->>'workSource'),''),nullif(btrim(v_entry->>'periodGoal'),''),case when nullif(v_entry->>'periodMilestoneAt','') is null then null else (v_entry->>'periodMilestoneAt')::timestamptz end,nullif(btrim(v_entry->>'carryOverReason'),''));
      continue;
    end if;
    select * into v_task from public.tasks where id=(v_entry->>'taskId')::uuid and department_id=p_department_id and status<>'cancelled';
    if not found then raise exception 'Task is outside department scope.' using errcode='42501'; end if;
    v_relation:=coalesce(nullif(v_entry->>'periodRelation',''),'NEW'); v_assignee:=v_task.assignee_id;
    v_due:=case when nullif(v_entry->>'periodMilestoneAt','') is not null then (v_entry->>'periodMilestoneAt')::timestamptz when v_task.due_date is not null then ((v_task.due_date+coalesce(v_task.due_time,time '17:00')) at time zone 'Asia/Ho_Chi_Minh') else null end;
    select i.* into v_previous from public.department_plan_items i join public.department_plans p on p.id=i.department_plan_id where i.linked_task_id=v_task.id and p.period_end<p_period_start and p.department_id=p_department_id and p.period_type=p_period_type order by p.period_end desc limit 1;
    insert into public.department_plan_items(department_plan_id,department_id,title,description,due_at,assignee_id,assignment_state,work_status,linked_task_id,created_by,period_relation,work_source,period_goal,period_milestone_at,carry_over_reason,carried_from_item_id,progress_start)
    values(v_plan.id,p_department_id,v_task.title,v_task.description,v_due,v_assignee,case when v_assignee is null then 'unassigned' else 'assigned' end,case v_task.status when 'in_progress' then 'in_progress' when 'done' then 'completed' else 'planned' end,v_task.id,p_actor_id,v_relation,coalesce(v_task.assignment_source,'legacy_unknown'),nullif(btrim(v_entry->>'periodGoal'),''),case when nullif(v_entry->>'periodMilestoneAt','') is null then null else (v_entry->>'periodMilestoneAt')::timestamptz end,coalesce(nullif(btrim(v_entry->>'carryOverReason'),''),v_previous.carry_over_reason),v_previous.id,v_task.progress_percent)
    on conflict (department_plan_id,linked_task_id) where linked_task_id is not null do update set period_relation=excluded.period_relation,period_goal=coalesce(excluded.period_goal,public.department_plan_items.period_goal),period_milestone_at=coalesce(excluded.period_milestone_at,public.department_plan_items.period_milestone_at),carry_over_reason=coalesce(excluded.carry_over_reason,public.department_plan_items.carry_over_reason),carried_from_item_id=coalesce(excluded.carried_from_item_id,public.department_plan_items.carried_from_item_id),updated_at=now();
  end loop;
  return v_plan;
end;
$function$;

create or replace function public.api_close_department_plan_v2(p_actor_id uuid,p_plan_id uuid,p_decisions jsonb default '[]'::jsonb,p_close_note text default null)
returns public.department_plans language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_plan public.department_plans; v_item public.department_plan_items; v_task public.tasks; v_decision jsonb; v_classification text; v_result text; v_carry boolean;
begin
  select * into v_plan from public.department_plans where id=p_plan_id for update; if not found then raise exception 'Department plan not found.' using errcode='P0002'; end if; if v_plan.status='closed' then return v_plan; end if;
  if not exists(select 1 from public.staff_users x join public.roles r on r.id=x.role_id where x.id=p_actor_id and x.active=true and (r.code in ('admin','tong_bien_tap','pho_tong_bien_tap') or exists(select 1 from public.departments d where d.id=v_plan.department_id and d.manager_id=p_actor_id and x.department_id=v_plan.department_id))) then raise exception 'Department plan is outside actor scope.' using errcode='42501'; end if;
  for v_item in select * from public.department_plan_items where department_plan_id=p_plan_id for update loop
    select * into v_task from public.tasks where id=v_item.linked_task_id;
    select value into v_decision from jsonb_array_elements(coalesce(p_decisions,'[]'::jsonb)) where value->>'itemId'=v_item.id::text limit 1;
    v_classification:=coalesce(nullif(v_decision->>'classification',''),case when v_task.status='done' then 'COMPLETED' when v_task.recurrence_rule_id is not null then 'RECURRING' when v_task.status='cancelled' then 'CANCELLED' when v_task.status in ('in_progress','blocked','waiting','pending_review') then 'LONG_RUNNING' else 'NOT_CONTINUING' end);
    v_result:=coalesce(nullif(v_decision->>'result',''),v_item.result_this_period); v_carry:=coalesce((v_decision->>'carryForward')::boolean,v_classification in ('LONG_RUNNING','CARRY_OVER','RECURRING'));
    update public.department_plan_items set close_classification=v_classification,task_status_at_close=v_task.status,result_this_period=v_result,progress_end=coalesce(v_task.progress_percent,progress_end),completed_in_period=(v_classification='COMPLETED'),carry_forward=v_carry,updated_at=now() where id=v_item.id;
  end loop;
  update public.department_plans set status='closed',closed_at=now(),closed_by=p_actor_id,close_note=nullif(btrim(p_close_note),'') where id=p_plan_id returning * into v_plan; return v_plan;
end;
$function$;

create or replace function public.auto_link_task_to_department_plans()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_plan public.department_plans; v_existing uuid; v_due date:=coalesce(new.due_date,new.start_date,timezone('Asia/Ho_Chi_Minh',now())::date); v_relation text:=case when new.recurrence_rule_id is not null then 'RECURRING' else 'AUTO_ADDED_DURING_PERIOD' end;
begin
  if new.department_id is null or new.status in ('cancelled','rejected') or coalesce(new.workflow_type,'STANDARD')='REPORT_ONLY' or new.task_type='duty' or (coalesce(new.approval_required,false) and new.assignment_approved_at is null) or coalesce(new.assignment_source,'legacy_unknown') not in ('leadership_assigned','self_registered') then return new; end if;
  for v_plan in select * from public.department_plans where department_id=new.department_id and status='active' and v_due between period_start and period_end loop
    if exists(select 1 from public.department_plan_items where department_plan_id=v_plan.id and linked_task_id=new.id) then continue; end if;
    select i.id into v_existing from public.department_plan_items i where i.department_plan_id=v_plan.id and i.linked_task_id is null and lower(i.title)=lower(new.title) limit 1;
    if v_existing is not null then continue;
    else insert into public.department_plan_items(department_plan_id,department_id,title,description,due_at,assignee_id,assignment_state,work_status,linked_task_id,created_by,period_relation,work_source,progress_start) values(v_plan.id,new.department_id,new.title,new.description,case when new.due_date is null then null else ((new.due_date+coalesce(new.due_time,time '17:00')) at time zone 'Asia/Ho_Chi_Minh') end,new.assignee_id,case when new.assignee_id is null then 'unassigned' else 'assigned' end,case when new.status='in_progress' then 'in_progress' else 'planned' end,new.id,coalesce(new.created_by,v_plan.created_by),v_relation,case when coalesce(new.self_claimable,false) then 'self_registered' else new.assignment_source end,new.progress_percent) on conflict do nothing; end if;
  end loop; return new;
end;
$function$;

drop trigger if exists tasks_auto_link_department_plans on public.tasks;
create trigger tasks_auto_link_department_plans after insert or update of status,assignment_approved_at on public.tasks for each row execute function public.auto_link_task_to_department_plans();

revoke all on function public.api_department_plan_candidates_v2(uuid,uuid,text,date,date),public.api_create_department_plan_v2(uuid,uuid,text,date,date,jsonb),public.api_close_department_plan_v2(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.api_department_plan_candidates_v2(uuid,uuid,text,date,date),public.api_create_department_plan_v2(uuid,uuid,text,date,date,jsonb),public.api_close_department_plan_v2(uuid,uuid,jsonb,text) to service_role;
alter function public.api_department_plan_candidates_v2(uuid,uuid,text,date,date) owner to postgres;
alter function public.api_create_department_plan_v2(uuid,uuid,text,date,date,jsonb) owner to postgres;
alter function public.api_close_department_plan_v2(uuid,uuid,jsonb,text) owner to postgres;
notify pgrst,'reload schema';
commit;