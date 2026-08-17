\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_admin uuid; v_tbt uuid; v_manager uuid; v_worker uuid; v_other uuid;
  v_department uuid; v_cycle uuid; v_worker_review uuid; v_manager_review uuid;
  v_rubric uuid; v_draft uuid;
  v_scores jsonb := '[{"factor_code":"work_effectiveness","score":36,"comment":"A"},{"factor_code":"responsibility","score":22,"comment":"B"},{"factor_code":"compliance","score":14,"comment":"C"},{"factor_code":"learning_challenge","score":9,"comment":"D"},{"factor_code":"innovation_technology","score":9,"comment":"E"}]'::jsonb;
begin
  select u.id into v_admin from public.staff_users u join public.roles r on r.id=u.role_id where u.active and r.code='admin' order by u.created_at,u.id limit 1;
  select u.id into v_tbt from public.staff_users u join public.roles r on r.id=u.role_id join public.role_permissions p on p.role_id=r.id where u.active and r.code='tong_bien_tap' and p.can_evaluate_step2 order by u.created_at,u.id limit 1;
  select d.id,d.manager_id,u.id into v_department,v_manager,v_worker from public.departments d join public.staff_users u on u.department_id=d.id and u.active and u.id<>d.manager_id where d.active and d.manager_id is not null order by d.code,u.created_at,u.id limit 1;
  select u.id into v_other from public.staff_users u where u.active and u.id not in(v_admin,v_tbt,v_manager,v_worker) order by u.created_at,u.id limit 1;
  if v_admin is null or v_tbt is null or v_manager is null or v_worker is null or v_other is null then raise exception 'phase7 actors unavailable'; end if;

  select id into v_rubric from public.evaluation_rubric_versions where status='published' order by version_no desc limit 1;
  select public.api_clone_evaluation_rubric(v_admin,v_rubric) into v_draft;
  perform public.api_publish_evaluation_rubric(v_admin,v_draft,current_date);
  begin update public.evaluation_rubric_factors set max_score=max_score+1 where rubric_version_id=v_draft and position=1; raise exception 'published factor unexpectedly mutable'; exception when raise_exception then null; end;

  select public.api_open_performance_cycle(v_admin,'P7-' || floor(extract(epoch from clock_timestamp()))::bigint,'Phase 7',current_date-7,current_date+7) into v_cycle;
  select public.api_create_performance_review(v_worker,v_cycle,v_worker) into v_worker_review;
  if public.api_submit_self_evaluation(v_worker,v_worker_review,v_scores)<>'awaiting_manager' then raise exception 'employee route invariant'; end if;
  begin perform public.api_submit_manager_evaluation(v_other,v_worker_review,v_scores); raise exception 'unrelated manager accepted'; exception when insufficient_privilege then null; end;
  if public.api_submit_manager_evaluation(v_manager,v_worker_review,v_scores)<>'awaiting_tbt' then raise exception 'manager route invariant'; end if;
  if public.api_publish_tbt_evaluation(v_tbt,v_worker_review,v_scores)<>'published' then raise exception 'tbt publish invariant'; end if;
  if not exists(select 1 from public.performance_reviews where id=v_worker_review and final_score=90 and rank='Hoàn thành xuất sắc nhiệm vụ') then raise exception 'sum/rank invariant'; end if;
  begin perform public.api_submit_self_evaluation(v_worker,v_worker_review,v_scores); raise exception 'published review unexpectedly mutable'; exception when invalid_parameter_value then null; end;

  select public.api_create_performance_review(v_manager,v_cycle,v_manager) into v_manager_review;
  if public.api_submit_self_evaluation(v_manager,v_manager_review,v_scores)<>'awaiting_tbt' then raise exception 'manager self must bypass step1'; end if;
  begin perform public.api_publish_tbt_evaluation(v_tbt,v_manager_review,jsonb_set(v_scores,'{0,score}','41'::jsonb)); raise exception 'factor bound unexpectedly accepted'; exception when invalid_parameter_value then null; end;
  if not exists(select 1 from public.audit_logs where entity_id=v_worker_review and action in ('submit_self','submit_manager','publish')) then raise exception 'evaluation audit missing'; end if;
end
$test$;

do $test$
begin
  if has_function_privilege('anon','public.api_submit_self_evaluation(uuid,uuid,jsonb)','execute') or has_function_privilege('authenticated','public.api_publish_tbt_evaluation(uuid,uuid,jsonb)','execute') then raise exception 'phase7 RPC exposed'; end if;
  if not has_function_privilege('service_role','public.api_submit_manager_evaluation(uuid,uuid,jsonb)','execute') then raise exception 'service role missing phase7 RPC'; end if;
end
$test$;
rollback;
