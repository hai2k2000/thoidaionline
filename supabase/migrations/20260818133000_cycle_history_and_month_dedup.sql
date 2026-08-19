begin;

create or replace function public.api_list_performance_cycle_history(p_actor uuid)
returns table(
  id uuid, code text, name text, start_date date, end_date date, status text,
  rubric_versions text, total_reviews bigint, self_draft_count bigint,
  awaiting_manager_count bigint, awaiting_tbt_count bigint,
  published_count bigint, other_count bigint
)
language sql stable security definer set search_path=public,pg_temp as $function$
  select pc.id,pc.code,pc.name,pc.start_date,pc.end_date,pc.status,
    coalesce(string_agg(distinct ('v' || rv.version_no::text),', ' order by ('v' || rv.version_no::text)),'—') as rubric_versions,
    count(pr.id),count(pr.id) filter(where pr.status='self_draft'),
    count(pr.id) filter(where pr.status='awaiting_manager'),
    count(pr.id) filter(where pr.status='awaiting_tbt'),
    count(pr.id) filter(where pr.status='published'),
    count(pr.id) filter(where pr.status not in('self_draft','awaiting_manager','awaiting_tbt','published'))
  from public.performance_cycles pc
  left join public.performance_reviews pr on pr.cycle_id=pc.id
  left join public.evaluation_rubric_versions rv on rv.id=pr.rubric_version_id
  where public.phase7_is_admin(p_actor)
  group by pc.id
  order by pc.start_date desc,pc.created_at desc
$function$;

create or replace function public.api_open_performance_cycle(p_actor uuid,p_code text,p_name text,p_start date,p_end date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_id uuid;
begin
  if not (public.phase7_is_admin(p_actor) or public.phase7_is_tbt(p_actor)) then raise exception 'forbidden' using errcode='42501'; end if;
  if nullif(btrim(p_code),'') is null or nullif(btrim(p_name),'') is null or p_start is null or p_end is null or p_end<p_start then raise exception 'invalid cycle' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtext('performance-cycle-date-range'));
  if exists(select 1 from public.performance_cycles pc where daterange(pc.start_date,pc.end_date,'[]') && daterange(p_start,p_end,'[]')) then
    raise exception 'performance cycle date range overlaps an existing cycle' using errcode='23505';
  end if;
  insert into public.performance_cycles(code,name,start_date,end_date,status,created_by)
  values(upper(btrim(p_code)),btrim(p_name),p_start,p_end,'open',p_actor) returning id into v_id;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor,'performance','performance_cycles',v_id,'open',jsonb_build_object('start_date',p_start,'end_date',p_end));
  return v_id;
end $function$;

create or replace function public.api_ensure_current_performance_cycle(p_actor uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_month_start date := date_trunc('month', timezone('Asia/Ho_Chi_Minh', now()))::date;
  v_month_end date := (date_trunc('month', timezone('Asia/Ho_Chi_Minh', now())) + interval '1 month - 1 day')::date;
  v_code text := to_char(v_month_start, 'YYYY-MM');
  v_cycle uuid; v_cycle_status text; v_rubric uuid; v_snapshot jsonb;
  v_employee record; v_workflow text; v_status text;
begin
  if not exists(select 1 from public.staff_users where id=p_actor and active=true) then raise exception 'forbidden' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext('performance-cycle-date-range'));
  select id,status into v_cycle,v_cycle_status from public.performance_cycles
  where start_date=v_month_start and end_date=v_month_end
  order by case status when 'open' then 1 else 2 end,created_at desc limit 1;
  if v_cycle is not null and v_cycle_status<>'open' then return v_cycle; end if;
  select id into v_rubric from public.evaluation_rubric_versions where status='published'
    order by effective_from desc nulls last,version_no desc limit 1;
  if v_rubric is null then return null; end if;
  select jsonb_build_object('rubric_version_id',v.id,'version_no',v.version_no,'effective_from',v.effective_from,
    'factors',jsonb_agg(jsonb_build_object('position',f.position,'factor_code',f.factor_code,'label',f.label,
    'description',f.description,'max_score',f.max_score,'band_definitions',f.band_definitions) order by f.position)) into v_snapshot
  from public.evaluation_rubric_versions v join public.evaluation_rubric_factors f on f.rubric_version_id=v.id
  where v.id=v_rubric group by v.id,v.version_no,v.effective_from;
  if v_cycle is null then
    insert into public.performance_cycles(code,name,start_date,end_date,status,created_by)
    values(v_code,'Đánh giá tháng '||to_char(v_month_start,'MM/YYYY'),v_month_start,v_month_end,'open',p_actor)
    returning id into v_cycle;
  end if;
  for v_employee in select u.id,case when exists(select 1 from public.departments d where d.active and d.manager_id=u.id) then 'manager' else 'employee' end workflow
    from public.staff_users u where u.active loop
    v_workflow:=v_employee.workflow; v_status:=case when v_workflow='manager' then 'awaiting_tbt' else 'awaiting_manager' end;
    if not exists(select 1 from public.performance_reviews where cycle_id=v_cycle and employee_id=v_employee.id) then
      insert into public.performance_reviews(cycle_id,employee_id,reviewer_id,status,rubric_version_id,rubric_snapshot,workflow_type,revision_no)
      select v_cycle,v_employee.id,case when v_workflow='employee' then d.manager_id else null end,v_status,v_rubric,v_snapshot,v_workflow,1
      from public.staff_users u left join public.departments d on d.id=u.department_id where u.id=v_employee.id
      on conflict (cycle_id,employee_id,revision_no) do nothing;
      insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
      select p_actor,'performance','performance_reviews',pr.id,'auto_create',jsonb_build_object('cycle_id',v_cycle,'employee_id',v_employee.id,'status',v_status)
      from public.performance_reviews pr where pr.cycle_id=v_cycle and pr.employee_id=v_employee.id;
    else
      update public.performance_reviews set status=v_status,updated_at=now()
      where cycle_id=v_cycle and employee_id=v_employee.id and status='self_draft' and self_score is null;
    end if;
  end loop;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor,'performance','performance_cycles',v_cycle,'ensure_monthly',jsonb_build_object('code',v_code,'rubric_version_id',v_rubric));
  return v_cycle;
end $function$;

-- Reconcile the known duplicate without deleting either cycle or review.
do $reconcile$
declare v_legacy uuid; v_actor uuid;
begin
  if exists(select 1 from public.performance_cycles where code='THÁNG 8' and status='open') then
    if not exists(select 1 from public.performance_cycles pc where pc.code='2026-08' and pc.status='open'
      and pc.start_date=date '2026-08-01' and pc.end_date=date '2026-08-31'
      and (select count(*) from public.performance_reviews pr where pr.cycle_id=pc.id)=26)
      or exists(select 1 from public.performance_reviews pr join public.performance_cycles pc on pc.id=pr.cycle_id
        where pc.code='THÁNG 8' and (pr.status<>'self_draft' or pr.self_score is not null or pr.reviewer_score is not null or pr.final_score is not null)) then
      raise exception 'August duplicate reconciliation precondition failed';
    end if;
    select id,created_by into v_legacy,v_actor from public.performance_cycles where code='THÁNG 8' for update;
    update public.performance_cycles set status='closed',updated_at=now() where id=v_legacy;
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(v_actor,'performance','performance_cycles',v_legacy,'close_duplicate_legacy',jsonb_build_object('canonical_code','2026-08','reviews_preserved',2));
  end if;
end $reconcile$;

revoke all on function public.api_list_performance_cycle_history(uuid) from public,anon,authenticated;
grant execute on function public.api_list_performance_cycle_history(uuid) to service_role;
revoke execute on function public.api_open_performance_cycle(uuid,text,text,date,date) from public,anon,authenticated;
grant execute on function public.api_open_performance_cycle(uuid,text,text,date,date) to service_role;
revoke all on function public.api_ensure_current_performance_cycle(uuid) from public,anon,authenticated;
grant execute on function public.api_ensure_current_performance_cycle(uuid) to service_role;

commit;
