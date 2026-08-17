\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_admin uuid;
  v_reviewer uuid;
  v_worker uuid;
  v_watcher uuid;
  v_task uuid;
  v_cancel_task uuid;
  v_attachment uuid;
begin
  select u.id into v_admin from public.staff_users u join public.roles r on r.id=u.role_id where u.active=true and r.code='admin' order by u.created_at,u.id limit 1;
  select u.id into v_reviewer from public.staff_users u join public.roles r on r.id=u.role_id where u.active=true and r.code='pho_tong_bien_tap' order by u.created_at,u.id limit 1;
  select u.id into v_worker from public.staff_users u join public.roles r on r.id=u.role_id where u.active=true and u.id<>v_admin and r.code<>'admin' order by u.created_at,u.id limit 1;
  select u.id into v_watcher from public.staff_users u where u.active=true and u.id not in (v_admin,v_worker) order by u.created_at,u.id limit 1;
  if v_admin is null or v_reviewer is null or v_worker is null or v_watcher is null then raise exception 'phase5 actors unavailable'; end if;

  insert into public.tasks(title,description,status,assignee_id,owner_id,reviewer_id,created_by,assignment_mode,department_id,due_date,plan_period,self_claimable,task_type,start_date)
  select 'Phase 5 workflow test','Nội dung kiểm thử','new',v_worker,v_worker,v_reviewer,v_admin,'individual',department_id,date '2026-08-25','ad_hoc',false,'assigned',date '2026-08-17'
  from public.staff_users where id=v_worker returning id into v_task;
  insert into public.task_assignees(task_id,user_id,assignment_role,status) values
    (v_task,v_worker,'owner','todo'),(v_task,v_watcher,'watcher','todo');

  perform public.api_submit_task_progress_report(v_worker,v_task,date '2026-08-18','blocked','Đã xử lý một phần','Đang chờ phối hợp');
  if not exists(select 1 from public.tasks where id=v_task and status='blocked')
     or not exists(select 1 from public.task_progress_reports where task_id=v_task and report_status='blocked' and blockers is not null)
     or not exists(select 1 from public.task_status_events where task_id=v_task and from_status='new' and to_status='blocked') then raise exception 'structured progress invariant'; end if;

  perform public.api_add_task_comment(v_watcher,v_task,'Watcher comment test');
  begin
    perform public.api_submit_task_progress_report(v_watcher,v_task,date '2026-08-18','in_progress','Không được phép',null);
    raise exception 'watcher unexpectedly reported';
  exception when insufficient_privilege then null; end;
  begin
    perform public.api_submit_assigned_task_completion(v_watcher,v_task);
    raise exception 'watcher unexpectedly completed';
  exception when insufficient_privilege then null; end;

  perform public.api_change_assigned_task_deadline(v_admin,v_task,date '2026-08-28','Điều chỉnh theo kế hoạch');
  if not exists(select 1 from public.task_deadline_history where task_id=v_task and old_due_date=date '2026-08-25' and new_due_date=date '2026-08-28' and reason='Điều chỉnh theo kế hoạch') then raise exception 'assigned deadline invariant'; end if;

  select id into v_attachment from public.api_add_task_attachment(v_worker,v_task,v_task::text || '/phase5-test.pdf','phase5-test.pdf','application/pdf',1024);
  if not exists(select 1 from public.task_attachments where id=v_attachment and task_id=v_task and storage_path like v_task::text || '/%') then raise exception 'attachment metadata invariant'; end if;

  perform public.api_submit_assigned_task_completion(v_worker,v_task);
  if not exists(select 1 from public.tasks where id=v_task and status='pending_review' and completion_submitted_at is not null) then raise exception 'assigned submit invariant'; end if;
  begin
    perform public.api_review_assigned_task_completion(v_admin,v_task,'return',null);
    raise exception 'return without reason unexpectedly accepted';
  exception when invalid_parameter_value then null; end;
  perform public.api_review_assigned_task_completion(v_admin,v_task,'return','Cần bổ sung bằng chứng');
  if not exists(select 1 from public.tasks where id=v_task and status='rejected') then raise exception 'return invariant'; end if;
  perform public.api_submit_assigned_task_completion(v_worker,v_task);
  perform public.api_review_assigned_task_completion(v_admin,v_task,'approve',null);
  if not exists(select 1 from public.tasks where id=v_task and status='done' and completed_at is not null) then raise exception 'approve invariant'; end if;

  insert into public.tasks(title,description,status,assignee_id,owner_id,reviewer_id,created_by,assignment_mode,department_id,due_date,plan_period,self_claimable,task_type,start_date)
  select 'Phase 5 cancel test','Nội dung kiểm thử','new',v_worker,v_worker,v_reviewer,v_admin,'individual',department_id,date '2026-08-25','ad_hoc',false,'assigned',date '2026-08-17'
  from public.staff_users where id=v_worker returning id into v_cancel_task;
  begin
    perform public.api_cancel_assigned_task(v_admin,v_cancel_task,'');
    raise exception 'cancel without reason unexpectedly accepted';
  exception when invalid_parameter_value then null; end;
  perform public.api_cancel_assigned_task(v_admin,v_cancel_task,'Không còn cần thực hiện');
  if not exists(select 1 from public.tasks where id=v_cancel_task and status='cancelled' and cancelled_by=v_admin and cancel_reason='Không còn cần thực hiện') then raise exception 'cancel invariant'; end if;

  if (select count(*) from public.audit_logs where entity_id in(v_task,v_cancel_task) and actor_id in(v_admin,v_worker)) < 6 then raise exception 'phase5 audit invariant'; end if;
  if not exists(select 1 from storage.buckets where id='task-private' and public=false) then raise exception 'private bucket invariant'; end if;
end
$test$;

do $test$
begin
  if has_function_privilege('anon','public.api_submit_task_progress_report(uuid,uuid,date,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.api_submit_assigned_task_completion(uuid,uuid)','EXECUTE')
     or has_function_privilege('anon','public.api_review_assigned_task_completion(uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('anon','public.api_cancel_assigned_task(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.api_change_assigned_task_deadline(uuid,uuid,date,text)','EXECUTE')
     or has_function_privilege('anon','public.api_add_task_attachment(uuid,uuid,text,text,text,bigint)','EXECUTE') then raise exception 'phase5 RPC exposed to browser roles'; end if;
  if not has_function_privilege('service_role','public.api_submit_task_progress_report(uuid,uuid,date,text,text,text)','EXECUTE') then raise exception 'service role missing phase5 RPC'; end if;
end
$test$;
rollback;