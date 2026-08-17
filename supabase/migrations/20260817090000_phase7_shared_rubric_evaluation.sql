begin;

create unique index if not exists evaluation_rubric_one_published_idx
  on public.evaluation_rubric_versions ((status)) where status='published';

create or replace function public.guard_published_performance_review()
returns trigger language plpgsql set search_path=public,pg_temp as $function$
begin
  if old.status='published' then
    raise exception 'published performance reviews are immutable';
  end if;
  if tg_op='UPDATE' and (
    new.rubric_version_id is distinct from old.rubric_version_id
    or new.rubric_snapshot is distinct from old.rubric_snapshot
    or new.employee_id is distinct from old.employee_id
    or new.cycle_id is distinct from old.cycle_id
    or new.workflow_type is distinct from old.workflow_type
  ) then
    raise exception 'evaluation identity and snapshot are immutable';
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$function$;

create or replace function public.guard_published_performance_review_score()
returns trigger language plpgsql set search_path=public,pg_temp as $function$
declare v_review uuid; v_status text;
begin
  v_review:=case when tg_op='DELETE' then old.review_id else new.review_id end;
  select status into v_status from public.performance_reviews where id=v_review;
  if v_status='published' then raise exception 'published performance review scores are immutable'; end if;
  return case when tg_op='DELETE' then old else new end;
end
$function$;

drop trigger if exists guard_published_performance_review_score on public.performance_review_scores;
create trigger guard_published_performance_review_score before insert or update or delete
on public.performance_review_scores for each row execute function public.guard_published_performance_review_score();

create or replace function public.phase7_is_admin(p_actor uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $function$
  select coalesce(bool_or(r.code='admin' and p.can_manage_rubrics),false)
  from public.staff_users u join public.roles r on r.id=u.role_id
  join public.role_permissions p on p.role_id=r.id
  where u.id=p_actor and u.active
$function$;

create or replace function public.phase7_is_tbt(p_actor uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $function$
  select coalesce(bool_or(r.code='tong_bien_tap' and p.can_evaluate_step2),false)
  from public.staff_users u join public.roles r on r.id=u.role_id
  join public.role_permissions p on p.role_id=r.id
  where u.id=p_actor and u.active
$function$;

create or replace function public.api_clone_evaluation_rubric(p_actor uuid,p_source uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_id uuid; v_version integer;
begin
  if not public.phase7_is_admin(p_actor) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.evaluation_rubric_versions where id=p_source and status in('published','retired')) then raise exception 'rubric not found' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtext('shared-evaluation-rubric'));
  select coalesce(max(version_no),0)+1 into v_version from public.evaluation_rubric_versions;
  insert into public.evaluation_rubric_versions(version_no,status,effective_from,created_by)
  values(v_version,'draft',null,p_actor) returning id into v_id;
  insert into public.evaluation_rubric_factors(rubric_version_id,position,factor_code,label,description,max_score,band_definitions)
  select v_id,position,factor_code,label,description,max_score,band_definitions
  from public.evaluation_rubric_factors where rubric_version_id=p_source order by position;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor,'performance','evaluation_rubric_versions',v_id,'clone',jsonb_build_object('source_id',p_source,'version_no',v_version));
  return v_id;
end
$function$;

create or replace function public.api_update_evaluation_rubric(p_actor uuid,p_rubric uuid,p_factors jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_count integer; v_total numeric;
begin
  if not public.phase7_is_admin(p_actor) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.evaluation_rubric_versions where id=p_rubric and status='draft') then raise exception 'draft rubric not found' using errcode='P0002'; end if;
  if jsonb_typeof(p_factors)<>'array' then raise exception 'factors must be an array' using errcode='22023'; end if;
  select count(*),coalesce(sum((x->>'max_score')::numeric),0) into v_count,v_total from jsonb_array_elements(p_factors) x;
  if v_count<>5 or v_total<>100 or (select count(distinct x->>'factor_code') from jsonb_array_elements(p_factors) x)<>5 then raise exception 'rubric requires five unique factors totaling 100' using errcode='22023'; end if;
  delete from public.evaluation_rubric_factors where rubric_version_id=p_rubric;
  insert into public.evaluation_rubric_factors(rubric_version_id,position,factor_code,label,description,max_score,band_definitions)
  select p_rubric,(x->>'position')::smallint,btrim(x->>'factor_code'),btrim(x->>'label'),btrim(x->>'description'),(x->>'max_score')::integer,coalesce(x->'band_definitions','[]'::jsonb)
  from jsonb_array_elements(p_factors) x;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','evaluation_rubric_versions',p_rubric,'update',jsonb_build_object('factor_count',v_count));
  return p_rubric;
end
$function$;

create or replace function public.api_publish_evaluation_rubric(p_actor uuid,p_rubric uuid,p_effective_from date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
begin
  if not public.phase7_is_admin(p_actor) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_effective_from is null then raise exception 'effective date required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtext('shared-evaluation-rubric'));
  if not exists(select 1 from public.evaluation_rubric_versions where id=p_rubric and status='draft') then raise exception 'draft rubric not found' using errcode='P0002'; end if;
  update public.evaluation_rubric_versions set status='retired' where status='published';
  update public.evaluation_rubric_versions set status='published',effective_from=p_effective_from,published_by=p_actor,published_at=now() where id=p_rubric;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','evaluation_rubric_versions',p_rubric,'publish',jsonb_build_object('effective_from',p_effective_from));
  return p_rubric;
end
$function$;

create or replace function public.api_retire_evaluation_rubric(p_actor uuid,p_rubric uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
begin
  if not public.phase7_is_admin(p_actor) then raise exception 'forbidden' using errcode='42501'; end if;
  update public.evaluation_rubric_versions set status='retired' where id=p_rubric and status='published';
  if not found then raise exception 'published rubric not found' using errcode='P0002'; end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action) values(p_actor,'performance','evaluation_rubric_versions',p_rubric,'retire');
  return p_rubric;
end
$function$;

create or replace function public.api_open_performance_cycle(p_actor uuid,p_code text,p_name text,p_start date,p_end date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_id uuid;
begin
  if not (public.phase7_is_admin(p_actor) or public.phase7_is_tbt(p_actor)) then raise exception 'forbidden' using errcode='42501'; end if;
  if nullif(btrim(p_code),'') is null or nullif(btrim(p_name),'') is null or p_start is null or p_end is null or p_end<p_start then raise exception 'invalid cycle' using errcode='22023'; end if;
  insert into public.performance_cycles(code,name,start_date,end_date,status,created_by) values(upper(btrim(p_code)),btrim(p_name),p_start,p_end,'open',p_actor) returning id into v_id;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','performance_cycles',v_id,'open',jsonb_build_object('start_date',p_start,'end_date',p_end));
  return v_id;
end
$function$;

create or replace function public.api_create_performance_review(p_actor uuid,p_cycle uuid,p_employee uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_id uuid; v_rubric uuid; v_snapshot jsonb; v_manager uuid; v_workflow text;
begin
  if p_actor<>p_employee and not (public.phase7_is_admin(p_actor) or public.phase7_is_tbt(p_actor)) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.staff_users where id=p_employee and active) or not exists(select 1 from public.performance_cycles where id=p_cycle and status='open') then raise exception 'employee or cycle not found' using errcode='P0002'; end if;
  select id into v_rubric from public.evaluation_rubric_versions where status='published' order by effective_from desc nulls last,version_no desc limit 1;
  if v_rubric is null then raise exception 'published rubric required' using errcode='22023'; end if;
  select jsonb_build_object('rubric_version_id',v.id,'version_no',v.version_no,'effective_from',v.effective_from,'factors',jsonb_agg(jsonb_build_object('position',f.position,'factor_code',f.factor_code,'label',f.label,'description',f.description,'max_score',f.max_score,'band_definitions',f.band_definitions) order by f.position)) into v_snapshot
  from public.evaluation_rubric_versions v join public.evaluation_rubric_factors f on f.rubric_version_id=v.id where v.id=v_rubric group by v.id,v.version_no,v.effective_from;
  select d.manager_id into v_manager from public.staff_users u join public.departments d on d.id=u.department_id where u.id=p_employee;
  v_workflow:=case when v_manager=p_employee then 'manager' else 'employee' end;
  select id into v_id from public.performance_reviews where cycle_id=p_cycle and employee_id=p_employee order by revision_no desc limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.performance_reviews(cycle_id,employee_id,reviewer_id,status,rubric_version_id,rubric_snapshot,workflow_type,revision_no)
  values(p_cycle,p_employee,case when v_workflow='employee' then v_manager else null end,'self_draft',v_rubric,v_snapshot,v_workflow,1) returning id into v_id;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','performance_reviews',v_id,'create',jsonb_build_object('cycle_id',p_cycle,'employee_id',p_employee,'workflow_type',v_workflow));
  return v_id;
end
$function$;

create or replace function public.phase7_store_scores(p_actor uuid,p_review uuid,p_stage text,p_scores jsonb)
returns numeric language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_snapshot jsonb; v_count integer; v_total numeric;
begin
  select rubric_snapshot into v_snapshot from public.performance_reviews where id=p_review for update;
  if v_snapshot is null or jsonb_typeof(p_scores)<>'array' then raise exception 'invalid score payload' using errcode='22023'; end if;
  select count(*),coalesce(sum((x->>'score')::numeric),0) into v_count,v_total from jsonb_array_elements(p_scores) x;
  if v_count<>5 or (select count(distinct x->>'factor_code') from jsonb_array_elements(p_scores) x)<>5 then raise exception 'five unique scores required' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_scores) x left join jsonb_array_elements(v_snapshot->'factors') f on f->>'factor_code'=x->>'factor_code' where f is null or (x->>'score')::numeric<0 or (x->>'score')::numeric>(f->>'max_score')::numeric) then raise exception 'score outside factor bounds' using errcode='22023'; end if;
  delete from public.performance_review_scores where review_id=p_review and stage=p_stage;
  insert into public.performance_review_scores(review_id,stage,factor_code,score,comment,actor_id)
  select p_review,p_stage,x->>'factor_code',(x->>'score')::numeric,nullif(btrim(coalesce(x->>'comment','')),''),p_actor from jsonb_array_elements(p_scores) x;
  return v_total;
end
$function$;

create or replace function public.api_submit_self_evaluation(p_actor uuid,p_review uuid,p_scores jsonb)
returns text language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_employee uuid; v_status text; v_workflow text; v_total numeric; v_next text;
begin
  select employee_id,status,workflow_type into v_employee,v_status,v_workflow from public.performance_reviews where id=p_review for update;
  if not found then raise exception 'review not found' using errcode='P0002'; end if;
  if p_actor<>v_employee then raise exception 'forbidden' using errcode='42501'; end if;
  if v_status<>'self_draft' then raise exception 'invalid review state' using errcode='22023'; end if;
  v_total:=public.phase7_store_scores(p_actor,p_review,'self',p_scores);
  v_next:=case when v_workflow='manager' then 'awaiting_tbt' else 'awaiting_manager' end;
  update public.performance_reviews set self_score=v_total,status=v_next,submitted_at=now(),updated_at=now() where id=p_review;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','performance_reviews',p_review,'submit_self',jsonb_build_object('status',v_next,'score',v_total));
  return v_next;
end
$function$;

create or replace function public.api_submit_manager_evaluation(p_actor uuid,p_review uuid,p_scores jsonb)
returns text language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_employee uuid; v_status text; v_manager uuid; v_allowed boolean; v_total numeric;
begin
  select r.employee_id,r.status,d.manager_id,coalesce(p.can_evaluate_step1,false) into v_employee,v_status,v_manager,v_allowed
  from public.performance_reviews r join public.staff_users u on u.id=r.employee_id join public.departments d on d.id=u.department_id
  left join public.staff_users a on a.id=p_actor left join public.role_permissions p on p.role_id=a.role_id where r.id=p_review for update of r;
  if not found then raise exception 'review not found' using errcode='P0002'; end if;
  if p_actor=v_employee or p_actor is distinct from v_manager or not v_allowed then raise exception 'forbidden' using errcode='42501'; end if;
  if v_status<>'awaiting_manager' then raise exception 'invalid review state' using errcode='22023'; end if;
  v_total:=public.phase7_store_scores(p_actor,p_review,'manager',p_scores);
  update public.performance_reviews set reviewer_id=p_actor,reviewer_score=v_total,status='awaiting_tbt',reviewed_at=now(),updated_at=now() where id=p_review;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','performance_reviews',p_review,'submit_manager',jsonb_build_object('status','awaiting_tbt','score',v_total));
  return 'awaiting_tbt';
end
$function$;

create or replace function public.api_publish_tbt_evaluation(p_actor uuid,p_review uuid,p_scores jsonb)
returns text language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_status text; v_total numeric; v_rank text;
begin
  if not public.phase7_is_tbt(p_actor) then raise exception 'forbidden' using errcode='42501'; end if;
  select status into v_status from public.performance_reviews where id=p_review for update;
  if not found then raise exception 'review not found' using errcode='P0002'; end if;
  if v_status<>'awaiting_tbt' then raise exception 'invalid review state' using errcode='22023'; end if;
  v_total:=public.phase7_store_scores(p_actor,p_review,'tbt',p_scores);
  v_rank:=case when v_total>=90 then 'Hoàn thành xuất sắc nhiệm vụ' when v_total>=80 then 'Hoàn thành tốt nhiệm vụ' when v_total>=65 then 'Hoàn thành nhiệm vụ' when v_total>=50 then 'Hoàn thành một phần nhiệm vụ' else 'Không hoàn thành nhiệm vụ' end;
  update public.performance_reviews set final_score=v_total,rank=v_rank,status='published',published_at=now(),published_by=p_actor,approved_at=now(),updated_at=now() where id=p_review;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','performance_reviews',p_review,'publish',jsonb_build_object('status','published','score',v_total,'rank',v_rank));
  return 'published';
end
$function$;

revoke execute on function public.phase7_is_admin(uuid),public.phase7_is_tbt(uuid),public.phase7_store_scores(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke execute on function public.api_clone_evaluation_rubric(uuid,uuid),public.api_update_evaluation_rubric(uuid,uuid,jsonb),public.api_publish_evaluation_rubric(uuid,uuid,date),public.api_retire_evaluation_rubric(uuid,uuid),public.api_open_performance_cycle(uuid,text,text,date,date),public.api_create_performance_review(uuid,uuid,uuid),public.api_submit_self_evaluation(uuid,uuid,jsonb),public.api_submit_manager_evaluation(uuid,uuid,jsonb),public.api_publish_tbt_evaluation(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.api_clone_evaluation_rubric(uuid,uuid),public.api_update_evaluation_rubric(uuid,uuid,jsonb),public.api_publish_evaluation_rubric(uuid,uuid,date),public.api_retire_evaluation_rubric(uuid,uuid),public.api_open_performance_cycle(uuid,text,text,date,date),public.api_create_performance_review(uuid,uuid,uuid),public.api_submit_self_evaluation(uuid,uuid,jsonb),public.api_submit_manager_evaluation(uuid,uuid,jsonb),public.api_publish_tbt_evaluation(uuid,uuid,jsonb) to service_role;

commit;
