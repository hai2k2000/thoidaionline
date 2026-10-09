begin;

-- Make the complete business identity explicit at the database boundary.
create unique index if not exists department_plans_period_identity_uidx
  on public.department_plans(department_id, period_type, period_start, period_end);

-- Preserve the already-deployed implementation as an internal worker. The
-- public RPC below adds the duplicate guard without changing item semantics.
alter function public.api_create_department_plan_v2(uuid,uuid,text,date,date,jsonb)
  rename to api_create_department_plan_v2_legacy;
alter function public.api_department_plan_candidates_v2(uuid,uuid,text,date,date)
  rename to api_department_plan_candidates_v2_legacy;

create or replace function public.api_create_department_plan_v2_legacy(
  p_actor_id uuid,p_department_id uuid,p_period_type text,p_period_start date,p_period_end date,p_items jsonb default '[]'::jsonb
) returns public.department_plans language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_plan public.department_plans; v_role text; v_actor_department uuid; v_entry jsonb; v_task public.tasks; v_previous public.department_plan_items; v_relation text; v_due timestamptz; v_assignee uuid;
begin
  select r.code,u.department_id into v_role,v_actor_department from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active=true;
  if v_role is null or (v_role not in ('admin','tong_bien_tap','pho_tong_bien_tap') and not exists(select 1 from public.departments d where d.id=p_department_id and d.manager_id=p_actor_id and v_actor_department=p_department_id)) then raise exception 'Department plan is outside actor scope.' using errcode='42501'; end if;
  select * into v_plan from public.api_get_or_create_department_plan(p_department_id,p_period_type,p_period_start,p_period_end,p_actor_id);
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
    insert into public.department_plan_items(department_plan_id,department_id,title,description,due_at,assignee_id,assignment_state,work_status,linked_task_id,created_by,period_relation,work_source,period_goal,period_milestone_at,carry_over_reason,carried_from_item_id,progress_start,period_start_state)
    values(v_plan.id,p_department_id,v_task.title,v_task.description,v_due,v_assignee,case when v_assignee is null then 'unassigned' else 'assigned' end,case v_task.status when 'in_progress' then 'in_progress' when 'done' then 'completed' else 'planned' end,v_task.id,p_actor_id,v_relation,coalesce(v_task.assignment_source,'legacy_unknown'),nullif(btrim(v_entry->>'periodGoal'),''),case when nullif(v_entry->>'periodMilestoneAt','') is null then null else (v_entry->>'periodMilestoneAt')::timestamptz end,coalesce(nullif(btrim(v_entry->>'carryOverReason'),''),v_previous.carry_over_reason),v_previous.id,v_task.progress_percent,v_task.status)
    on conflict (department_plan_id,linked_task_id) where linked_task_id is not null do update set period_relation=excluded.period_relation,period_goal=coalesce(excluded.period_goal,public.department_plan_items.period_goal),period_milestone_at=coalesce(excluded.period_milestone_at,public.department_plan_items.period_milestone_at),carry_over_reason=coalesce(excluded.carry_over_reason,public.department_plan_items.carry_over_reason),carried_from_item_id=coalesce(excluded.carried_from_item_id,public.department_plan_items.carried_from_item_id),updated_at=now();
  end loop;
  return v_plan;
end;
$function$;

create or replace function public.api_create_department_plan_v2(
  p_actor_id uuid,p_department_id uuid,p_period_type text,p_period_start date,p_period_end date,p_items jsonb default '[]'::jsonb
) returns public.department_plans language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_plan public.department_plans;
  v_role text;
  v_actor_department uuid;
  v_lock_key bigint := hashtextextended(format('%s:%s:%s:%s',p_department_id,p_period_type,p_period_start,p_period_end),0);
begin
  select r.code,u.department_id into v_role,v_actor_department from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active=true;
  if v_role is null or (v_role not in ('admin','tong_bien_tap','pho_tong_bien_tap') and not exists(select 1 from public.departments d where d.id=p_department_id and d.manager_id=p_actor_id and v_actor_department=p_department_id)) then raise exception 'Department plan is outside actor scope.' using errcode='42501'; end if;
  -- Serialize only requests for the same department/period identity. This
  -- closes the check-then-insert race before the legacy item loop can run.
  perform pg_advisory_xact_lock(v_lock_key);
  select * into v_plan
  from public.department_plans
  where department_id=p_department_id
    and period_type=p_period_type
    and period_start=p_period_start
    and period_end=p_period_end;
  if found then return v_plan; end if;
  v_plan := public.api_create_department_plan_v2_legacy(p_actor_id,p_department_id,p_period_type,p_period_start,p_period_end,p_items);
  return v_plan;
end;
$function$;

create or replace function public.api_create_department_plan_v2_result(
  p_actor_id uuid,p_department_id uuid,p_period_type text,p_period_start date,p_period_end date,p_items jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_plan public.department_plans;
  v_role text;
  v_actor_department uuid;
  v_lock_key bigint := hashtextextended(format('%s:%s:%s:%s',p_department_id,p_period_type,p_period_start,p_period_end),0);
begin
  select r.code,u.department_id into v_role,v_actor_department from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active=true;
  if v_role is null or (v_role not in ('admin','tong_bien_tap','pho_tong_bien_tap') and not exists(select 1 from public.departments d where d.id=p_department_id and d.manager_id=p_actor_id and v_actor_department=p_department_id)) then raise exception 'Department plan is outside actor scope.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(v_lock_key);
  select * into v_plan from public.department_plans where department_id=p_department_id and period_type=p_period_type and period_start=p_period_start and period_end=p_period_end;
  if found then return jsonb_build_object('plan',to_jsonb(v_plan),'created',false); end if;
  v_plan := public.api_create_department_plan_v2_legacy(p_actor_id,p_department_id,p_period_type,p_period_start,p_period_end,p_items);
  return jsonb_build_object('plan',to_jsonb(v_plan),'created',true);
end;
$function$;

create or replace function public.api_department_plan_candidates_v2(
  p_actor_id uuid,p_department_id uuid,p_period_type text,p_period_start date,p_period_end date
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_existing uuid;
  v_role text;
  v_actor_department uuid;
begin
  select r.code,u.department_id into v_role,v_actor_department from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active=true;
  if v_role is null or (v_role not in ('admin','tong_bien_tap','pho_tong_bien_tap') and not exists(select 1 from public.departments d where d.id=p_department_id and d.manager_id=p_actor_id and v_actor_department=p_department_id)) then raise exception 'Department plan is outside actor scope.' using errcode='42501'; end if;
  select id into v_existing
  from public.department_plans
  where department_id=p_department_id
    and period_type=p_period_type
    and period_start=p_period_start
    and period_end=p_period_end;
  if v_existing is not null then return '[]'::jsonb; end if;
  return public.api_department_plan_candidates_v2_legacy(p_actor_id,p_department_id,p_period_type,p_period_start,p_period_end);
end;
$function$;

revoke all on function public.api_create_department_plan_v2_legacy(uuid,uuid,text,date,date,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.api_department_plan_candidates_v2_legacy(uuid,uuid,text,date,date) from public,anon,authenticated,service_role;
revoke all on function public.api_create_department_plan_v2(uuid,uuid,text,date,date,jsonb),public.api_create_department_plan_v2_result(uuid,uuid,text,date,date,jsonb),public.api_department_plan_candidates_v2(uuid,uuid,text,date,date) from public,anon,authenticated;
grant execute on function public.api_create_department_plan_v2(uuid,uuid,text,date,date,jsonb),public.api_create_department_plan_v2_result(uuid,uuid,text,date,date,jsonb),public.api_department_plan_candidates_v2(uuid,uuid,text,date,date) to service_role;
alter function public.api_create_department_plan_v2(uuid,uuid,text,date,date,jsonb) owner to postgres;
alter function public.api_create_department_plan_v2_result(uuid,uuid,text,date,date,jsonb) owner to postgres;
alter function public.api_department_plan_candidates_v2(uuid,uuid,text,date,date) owner to postgres;
notify pgrst,'reload schema';
commit;