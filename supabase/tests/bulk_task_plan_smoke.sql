\set ON_ERROR_STOP on

begin;

do $$
declare
  v_creator uuid;
  v_reviewer uuid;
  v_employee uuid;
  v_tbt uuid;
  v_batch uuid := gen_random_uuid();
  v_bad_batch uuid := gen_random_uuid();
  v_role_batch uuid := gen_random_uuid();
  v_task uuid;
  v_count integer;
  v_task_row public.tasks;
begin
  select u.id into v_creator from public.staff_users u join public.roles r on r.id=u.role_id
   where u.active and r.code in ('admin','pho_tong_bien_tap','phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap') order by r.code='admin' desc,u.created_at limit 1;
  select u.id into v_reviewer from public.staff_users u join public.roles r on r.id=u.role_id
   where u.active and r.code in ('pho_tong_bien_tap','phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap') order by u.created_at limit 1;
  select u.id into v_employee from public.staff_users u join public.roles r on r.id=u.role_id
   where u.active and r.code in ('phong_vien','bien_tap_vien','tri_su') order by u.created_at limit 1;
  select u.id into v_tbt from public.staff_users u join public.roles r on r.id=u.role_id
   where u.active and r.code in ('tong_bien_tap','tbt_read_only') order by u.created_at limit 1;
  if v_creator is null or v_reviewer is null or v_employee is null then raise exception 'Fixture roles incomplete'; end if;

  select count(*) into v_count from public.create_bulk_task_plan(v_creator,'daily',current_date + 1,v_reviewer,'__bulk_shared_description__',
    '[{"title":"__bulk_one__"},{"title":"__bulk_two__"},{"title":"__bulk_three__"}]'::jsonb,v_batch);
  if v_count <> 3 then raise exception 'Bulk create returned %, expected 3',v_count; end if;
  select count(*) into v_count from public.tasks where plan_batch_id=v_batch and description='__bulk_shared_description__' and priority='normal';
  if v_count <> 3 then raise exception 'Bulk persistence/shared description/neutral priority failed'; end if;

  select count(*) into v_count from public.create_bulk_task_plan(v_creator,'daily',current_date + 1,v_reviewer,'__bulk_shared_description__',
    '[{"title":"__bulk_one__"},{"title":"__bulk_two__"},{"title":"__bulk_three__"}]'::jsonb,v_batch);
  if v_count <> 3 or (select count(*) from public.tasks where plan_batch_id=v_batch) <> 3 then raise exception 'Idempotent retry duplicated rows'; end if;

  begin
    perform * from public.create_bulk_task_plan(v_creator,'weekly',current_date + 7,v_reviewer,'__bulk_bad__',
      '[{"title":"__created_then_rollback__"},{"title":""}]'::jsonb,v_bad_batch);
    raise exception 'Invalid bulk row was accepted';
  exception when invalid_parameter_value then null;
  end;
  if exists(select 1 from public.tasks where plan_batch_id=v_bad_batch) then raise exception 'Invalid row did not rollback entire batch'; end if;

  begin
    perform * from public.create_bulk_task_plan(v_employee,'daily',current_date + 1,v_reviewer,'__role_guard__','[{"title":"no"}]'::jsonb,v_role_batch);
    raise exception 'Employee unexpectedly created a plan';
  exception when insufficient_privilege then null;
  end;
  if exists(select 1 from public.tasks where plan_batch_id=v_role_batch) then raise exception 'Role-guard failure created data'; end if;

  select id into v_task from public.tasks where plan_batch_id=v_batch order by created_at,id limit 1;
  v_task_row := public.claim_task_plan(v_employee,v_task);
  if v_task_row.assignee_id<>v_employee or v_task_row.status<>'in_progress' then raise exception 'Claim failed'; end if;
  v_task_row := public.report_task_progress(v_employee,v_task,50,'__progress_report__','__blocker__');
  if v_task_row.status<>'in_progress' or v_task_row.progress_percent<>50 then raise exception 'Progress report failed'; end if;
  v_task_row := public.report_task_progress(v_employee,v_task,100,'__completion_report__',null);
  if v_task_row.status<>'pending_review' or v_task_row.progress_percent<>100 then raise exception 'Completion report failed'; end if;
  if (select count(*) from public.task_progress_logs where task_id=v_task) <> 2 then raise exception 'Progress logs are not atomic/complete'; end if;
  v_task_row := public.review_task_completion(v_reviewer,v_task,'approve','__approved__');
  if v_task_row.status<>'done' then raise exception 'Review approval failed'; end if;
  perform public.save_task_evaluation_checkpoint(v_reviewer,v_task,v_employee,8,2,'done',true,'__score__',current_date,true);
  if not exists(select 1 from public.task_evaluation_checkpoints where task_id=v_task and employee_id=v_employee and total_score=16) then raise exception 'Evaluation failed'; end if;

  if v_tbt is not null then
    begin
      perform public.report_task_progress(v_tbt,v_task,10,'forbidden',null);
      raise exception 'TBT unexpectedly reported';
    exception when insufficient_privilege then null;
    end;
  end if;

  if has_function_privilege('anon','public.create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid)'::regprocedure,'EXECUTE')
     or has_function_privilege('authenticated','public.report_task_progress(uuid,uuid,integer,text,text)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon','public.review_task_completion(uuid,uuid,text,text)'::regprocedure,'EXECUTE') then
    raise exception 'Client roles can execute protected RPCs';
  end if;
end;
$$;

rollback;
