begin;

-- The monthly workflow has exactly one review row per employee/cycle.
create unique index if not exists performance_reviews_cycle_employee_unique_idx
  on public.performance_reviews(cycle_id, employee_id);

create or replace function public.api_ensure_current_performance_cycle(p_actor uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_month_start date := date_trunc('month', timezone('Asia/Ho_Chi_Minh', now()))::date;
  v_month_end date := (date_trunc('month', timezone('Asia/Ho_Chi_Minh', now())) + interval '1 month - 1 day')::date;
  v_code text := to_char(v_month_start, 'YYYY-MM');
  v_cycle uuid; v_rubric uuid; v_snapshot jsonb;
  v_employee record; v_workflow text; v_status text;
begin
  if not exists(select 1 from public.staff_users where id=p_actor and active=true) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('monthly-performance-cycle-' || v_code));
  select id into v_rubric from public.evaluation_rubric_versions where status='published'
    order by effective_from desc nulls last, version_no desc limit 1;
  if v_rubric is null then return null; end if;
  select jsonb_build_object('rubric_version_id',v.id,'version_no',v.version_no,
    'effective_from',v.effective_from,'factors',jsonb_agg(jsonb_build_object(
      'position',f.position,'factor_code',f.factor_code,'label',f.label,
      'description',f.description,'max_score',f.max_score,
      'band_definitions',f.band_definitions) order by f.position)) into v_snapshot
  from public.evaluation_rubric_versions v join public.evaluation_rubric_factors f on f.rubric_version_id=v.id
  where v.id=v_rubric group by v.id,v.version_no,v.effective_from;
  insert into public.performance_cycles(code,name,start_date,end_date,status,created_by)
  values(v_code,'Đánh giá tháng ' || to_char(v_month_start,'MM/YYYY'),v_month_start,v_month_end,'open',p_actor)
  on conflict (code) do update set updated_at=now() returning id into v_cycle;
  if v_cycle is null then select id into v_cycle from public.performance_cycles where code=v_code; end if;
  for v_employee in select u.id,
    case when exists(select 1 from public.departments d where d.active=true and d.manager_id=u.id)
      then 'manager' else 'employee' end as workflow
    from public.staff_users u where u.active=true loop
    v_workflow := v_employee.workflow;
    v_status := case when v_workflow='manager' then 'awaiting_tbt' else 'awaiting_manager' end;
    if not exists(select 1 from public.performance_reviews where cycle_id=v_cycle and employee_id=v_employee.id) then
      insert into public.performance_reviews(cycle_id,employee_id,reviewer_id,status,rubric_version_id,rubric_snapshot,workflow_type,revision_no)
      select v_cycle,v_employee.id,case when v_workflow='employee' then d.manager_id else null end,
        v_status,v_rubric,v_snapshot,v_workflow,1 from public.staff_users u
        left join public.departments d on d.id=u.department_id where u.id=v_employee.id
        on conflict (cycle_id,employee_id,revision_no) do nothing;
      insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
      select p_actor,'performance','performance_reviews',pr.id,'auto_create',
        jsonb_build_object('cycle_id',v_cycle,'employee_id',v_employee.id,'status',v_status)
      from public.performance_reviews pr where pr.cycle_id=v_cycle and pr.employee_id=v_employee.id;
    else
      update public.performance_reviews pr set status=v_status,updated_at=now()
      where pr.cycle_id=v_cycle and pr.employee_id=v_employee.id
        and pr.status='self_draft' and pr.self_score is null;
    end if;
  end loop;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor,'performance','performance_cycles',v_cycle,'ensure_monthly',jsonb_build_object('code',v_code,'rubric_version_id',v_rubric));
  return v_cycle;
end $function$;

create or replace function public.api_submit_self_evaluation(p_actor uuid,p_review uuid,p_scores jsonb)
returns text language plpgsql security definer set search_path=public,pg_temp as $function$
begin raise exception 'self evaluation is disabled' using errcode='42501'; end $function$;

revoke all on function public.api_ensure_current_performance_cycle(uuid),public.api_submit_self_evaluation(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.api_ensure_current_performance_cycle(uuid),public.api_submit_self_evaluation(uuid,uuid,jsonb) to service_role;
commit;
