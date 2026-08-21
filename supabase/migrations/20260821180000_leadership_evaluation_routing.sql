begin;

create or replace function public.api_ensure_evaluation_cycle(p_actor uuid,p_cycle_type text,p_start date,p_end date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_cycle uuid; v_rubric uuid; v_snapshot jsonb; v_employee record; v_workflow text; v_status text;
begin
  if not exists(select 1 from public.staff_users where id=p_actor and active=true) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_cycle_type not in ('weekly','monthly') or p_start is null or p_end is null or p_end<p_start then raise exception 'invalid cycle' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtext('evaluation-cycle-'||p_cycle_type||'-'||p_start::text));
  select id into v_rubric from public.evaluation_rubric_versions where status='published' order by effective_from desc nulls last,version_no desc limit 1;
  if v_rubric is null then return null; end if;
  select jsonb_build_object('rubric_version_id',v.id,'version_no',v.version_no,'effective_from',v.effective_from,'factors',jsonb_agg(jsonb_build_object('position',f.position,'factor_code',f.factor_code,'label',f.label,'description',f.description,'max_score',f.max_score,'band_definitions',f.band_definitions) order by f.position)) into v_snapshot
  from public.evaluation_rubric_versions v join public.evaluation_rubric_factors f on f.rubric_version_id=v.id where v.id=v_rubric group by v.id,v.version_no,v.effective_from;
  select id into v_cycle from public.performance_cycles where cycle_type=p_cycle_type and start_date=p_start order by case status when 'open' then 1 else 2 end,created_at desc limit 1;
  if v_cycle is null then
    insert into public.performance_cycles(code,name,cycle_type,start_date,end_date,status,created_by)
    values(case when p_cycle_type='weekly' then 'WEEK-'||to_char(p_start,'IYYY-IW') else to_char(p_start,'YYYY-MM') end,
      case when p_cycle_type='weekly' then 'Tuần '||(1+((extract(day from p_start)::int-1)/7))::int||' tháng '||to_char(p_start,'MM/YYYY') else 'Tháng '||to_char(p_start,'MM/YYYY') end,
      p_cycle_type,p_start,p_end,'open',p_actor) returning id into v_cycle;
  end if;
  for v_employee in
    select u.id,case
      when lower(coalesce(jt.code,''))='pho_tong_bien_tap'
        or exists(select 1 from public.departments d where d.active=true and d.manager_id=u.id)
      then 'manager' else 'employee' end as workflow
    from public.staff_users u
    left join public.job_titles jt on jt.id=u.job_title_id and jt.active=true
    where u.active=true and lower(coalesce(jt.code,''))<>'tong_bien_tap'
  loop
    v_workflow:=v_employee.workflow; v_status:=case when v_workflow='manager' then 'awaiting_tbt' else 'awaiting_manager' end;
    if not exists(select 1 from public.performance_reviews where cycle_id=v_cycle and employee_id=v_employee.id) then
      insert into public.performance_reviews(cycle_id,employee_id,reviewer_id,status,rubric_version_id,rubric_snapshot,workflow_type,revision_no)
      select v_cycle,v_employee.id,case when v_workflow='employee' then d.manager_id else null end,v_status,v_rubric,v_snapshot,v_workflow,1 from public.staff_users u left join public.departments d on d.id=u.department_id where u.id=v_employee.id on conflict (cycle_id,employee_id,revision_no) do nothing;
    else
      update public.performance_reviews review set status=v_status,
        reviewer_id=case when v_workflow='employee' then department.manager_id else null end,updated_at=now()
      from public.staff_users employee left join public.departments department on department.id=employee.department_id
      where review.cycle_id=v_cycle and review.employee_id=v_employee.id and employee.id=v_employee.id
        and review.status in ('self_draft','awaiting_manager','awaiting_tbt')
        and review.self_score is null and review.reviewer_score is null and review.final_score is null
        and not exists(select 1 from public.performance_review_scores score where score.review_id=review.id);
    end if;
  end loop;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','performance_cycles',v_cycle,'ensure_'||p_cycle_type,jsonb_build_object('start_date',p_start,'end_date',p_end));
  return v_cycle;
end $function$;

-- Tổng Biên Tập is the final evaluator and does not receive an evaluation file.
delete from public.performance_reviews review
using public.staff_users employee, public.job_titles title
where review.employee_id=employee.id and employee.job_title_id=title.id
  and lower(title.code)='tong_bien_tap'
  and review.self_score is null and review.reviewer_score is null and review.final_score is null
  and not exists(select 1 from public.performance_review_scores score where score.review_id=review.id);

-- Phó Tổng Biên Tập is evaluated directly by Tổng Biên Tập.
update public.performance_reviews review
set status='awaiting_tbt',reviewer_id=null,updated_at=now()
from public.performance_cycles cycle,public.staff_users employee,public.job_titles title
where review.cycle_id=cycle.id and review.employee_id=employee.id and employee.job_title_id=title.id
  and cycle.status='open' and employee.active=true and lower(title.code)='pho_tong_bien_tap'
  and review.status in ('self_draft','awaiting_manager','awaiting_tbt')
  and review.self_score is null and review.reviewer_score is null and review.final_score is null
  and not exists(select 1 from public.performance_review_scores score where score.review_id=review.id);

revoke all on function public.api_ensure_evaluation_cycle(uuid,text,date,date) from public,anon,authenticated;
grant execute on function public.api_ensure_evaluation_cycle(uuid,text,date,date) to service_role;

commit;
