begin;

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
  for v_employee in
    select u.id,case
      when exists(select 1 from public.departments d where d.active and d.manager_id=u.id)
        or lower(coalesce(jt.code,''))='pho_tong_bien_tap'
      then 'manager' else 'employee' end workflow
    from public.staff_users u
    left join public.job_titles jt on jt.id=u.job_title_id and jt.active=true
    where u.active
  loop
    v_workflow:=v_employee.workflow;
    v_status:=case when v_workflow='manager' then 'awaiting_tbt' else 'awaiting_manager' end;
    if not exists(select 1 from public.performance_reviews where cycle_id=v_cycle and employee_id=v_employee.id) then
      insert into public.performance_reviews(cycle_id,employee_id,reviewer_id,status,rubric_version_id,rubric_snapshot,workflow_type,revision_no)
      select v_cycle,v_employee.id,case when v_workflow='employee' then d.manager_id else null end,v_status,v_rubric,v_snapshot,v_workflow,1
      from public.staff_users u left join public.departments d on d.id=u.department_id where u.id=v_employee.id
      on conflict (cycle_id,employee_id,revision_no) do nothing;
      insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
      select p_actor,'performance','performance_reviews',pr.id,'auto_create',jsonb_build_object('cycle_id',v_cycle,'employee_id',v_employee.id,'status',v_status)
      from public.performance_reviews pr where pr.cycle_id=v_cycle and pr.employee_id=v_employee.id;
    else
      update public.performance_reviews review
      set status=v_status,
        reviewer_id=case when v_workflow='employee' then department.manager_id else null end,
        updated_at=now()
      from public.staff_users employee
      left join public.departments department on department.id=employee.department_id
      where review.cycle_id=v_cycle and review.employee_id=v_employee.id
        and employee.id=v_employee.id
        and review.status in ('self_draft','awaiting_manager','awaiting_tbt')
        and review.self_score is null and review.reviewer_score is null
        and review.final_score is null
        and not exists(select 1 from public.performance_review_scores score where score.review_id=review.id);
    end if;
  end loop;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor,'performance','performance_cycles',v_cycle,'ensure_monthly',jsonb_build_object('code',v_code,'rubric_version_id',v_rubric));
  return v_cycle;
end $function$;

revoke all on function public.api_ensure_current_performance_cycle(uuid) from public,anon,authenticated;
grant execute on function public.api_ensure_current_performance_cycle(uuid) to service_role;

-- Reconcile the open cycle immediately; scored records remain immutable.
update public.performance_reviews review
set status='awaiting_tbt',reviewer_id=null,updated_at=now()
from public.performance_cycles cycle,
  public.staff_users employee,
  public.job_titles title
where review.cycle_id=cycle.id and review.employee_id=employee.id
  and employee.job_title_id=title.id and employee.active=true and title.active=true
  and lower(title.code)='pho_tong_bien_tap' and cycle.status='open'
  and review.status in ('self_draft','awaiting_manager')
  and review.self_score is null and review.reviewer_score is null and review.final_score is null
  and not exists(select 1 from public.performance_review_scores score where score.review_id=review.id);

commit;
