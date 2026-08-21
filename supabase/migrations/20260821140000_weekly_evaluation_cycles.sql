begin;

alter table public.performance_cycles
  add column if not exists cycle_type text not null default 'monthly';
update public.performance_cycles
set cycle_type = case when upper(code) like 'WEEK-%' then 'weekly' else 'monthly' end
where cycle_type is null or cycle_type not in ('weekly','monthly');
alter table public.performance_cycles drop constraint if exists performance_cycles_cycle_type_check;
alter table public.performance_cycles add constraint performance_cycles_cycle_type_check check (cycle_type in ('weekly','monthly'));
create index if not exists performance_cycles_type_start_idx on public.performance_cycles(cycle_type,start_date desc);

drop function if exists public.api_list_performance_cycle_history(uuid);
create function public.api_list_performance_cycle_history(p_actor uuid)
returns table(
  id uuid, code text, name text, cycle_type text, start_date date, end_date date, status text,
  rubric_versions text, total_reviews bigint, self_draft_count bigint,
  awaiting_manager_count bigint, awaiting_tbt_count bigint, published_count bigint, other_count bigint
)
language sql stable security definer set search_path=public,pg_temp as $function$
  select pc.id,pc.code,pc.name,pc.cycle_type,pc.start_date,pc.end_date,pc.status,
    coalesce(string_agg(distinct ('v' || rv.version_no::text),', ' order by ('v' || rv.version_no::text)),'—'),
    count(pr.id),count(pr.id) filter(where pr.status='self_draft'),
    count(pr.id) filter(where pr.status='awaiting_manager'),count(pr.id) filter(where pr.status='awaiting_tbt'),
    count(pr.id) filter(where pr.status='published'),count(pr.id) filter(where pr.status not in('self_draft','awaiting_manager','awaiting_tbt','published'))
  from public.performance_cycles pc
  left join public.performance_reviews pr on pr.cycle_id=pc.id
  left join public.evaluation_rubric_versions rv on rv.id=pr.rubric_version_id
  where public.phase7_is_admin(p_actor)
  group by pc.id order by pc.start_date desc,pc.created_at desc
$function$;

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
  for v_employee in select u.id,case when exists(select 1 from public.departments d where d.active=true and d.manager_id=u.id) then 'manager' else 'employee' end as workflow from public.staff_users u where u.active=true loop
    v_workflow:=v_employee.workflow; v_status:=case when v_workflow='manager' then 'awaiting_tbt' else 'awaiting_manager' end;
    if not exists(select 1 from public.performance_reviews where cycle_id=v_cycle and employee_id=v_employee.id) then
      insert into public.performance_reviews(cycle_id,employee_id,reviewer_id,status,rubric_version_id,rubric_snapshot,workflow_type,revision_no)
      select v_cycle,v_employee.id,case when v_workflow='employee' then d.manager_id else null end,v_status,v_rubric,v_snapshot,v_workflow,1 from public.staff_users u left join public.departments d on d.id=u.department_id where u.id=v_employee.id on conflict (cycle_id,employee_id,revision_no) do nothing;
    else update public.performance_reviews set status=v_status,updated_at=now() where cycle_id=v_cycle and employee_id=v_employee.id and status='self_draft' and self_score is null;
    end if;
  end loop;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','performance_cycles',v_cycle,'ensure_'||p_cycle_type,jsonb_build_object('start_date',p_start,'end_date',p_end));
  return v_cycle;
end $function$;

create or replace function public.api_ensure_current_performance_cycle(p_actor uuid)
returns uuid language sql security definer set search_path=public,pg_temp as $function$
  select public.api_ensure_evaluation_cycle(p_actor,'monthly',date_trunc('month',timezone('Asia/Ho_Chi_Minh',now()))::date,(date_trunc('month',timezone('Asia/Ho_Chi_Minh',now()))+interval '1 month - 1 day')::date)
$function$;

create or replace function public.api_ensure_current_weekly_performance_cycle(p_actor uuid)
returns uuid language sql security definer set search_path=public,pg_temp as $function$
  select public.api_ensure_evaluation_cycle(p_actor,'weekly',date_trunc('week',timezone('Asia/Ho_Chi_Minh',now()))::date,(date_trunc('week',timezone('Asia/Ho_Chi_Minh',now()))+interval '6 days')::date)
$function$;

revoke all on function public.api_list_performance_cycle_history(uuid),public.api_ensure_evaluation_cycle(uuid,text,date,date),public.api_ensure_current_performance_cycle(uuid),public.api_ensure_current_weekly_performance_cycle(uuid) from public,anon,authenticated;
grant execute on function public.api_list_performance_cycle_history(uuid),public.api_ensure_evaluation_cycle(uuid,text,date,date),public.api_ensure_current_performance_cycle(uuid),public.api_ensure_current_weekly_performance_cycle(uuid) to service_role;
commit;
