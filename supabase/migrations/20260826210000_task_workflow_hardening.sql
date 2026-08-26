begin;

-- Direct assignments start immediately; record that transition after the task exists.
create or replace function public.audit_direct_assignment_start()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
begin
  if new.task_type='assigned'
     and coalesce(new.self_claimable,false)=false
     and coalesce(new.task_category,'')<>'duty'
     and new.status='in_progress' then
    insert into public.task_status_events(task_id,from_status,to_status,actor_id)
    values(new.id,'new','in_progress',new.created_by);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
    values(new.created_by,'task','tasks',new.id,'start',
      jsonb_build_object('status','new'),
      jsonb_build_object('status','in_progress','reason','direct assignment default'));
  end if;
  return new;
end
$function$;

drop trigger if exists audit_direct_assignment_start on public.tasks;
create trigger audit_direct_assignment_start
after insert on public.tasks
for each row execute function public.audit_direct_assignment_start();

create or replace function public.api_submit_assigned_task_completion(p_actor_id uuid,p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.tasks; v_from_status text; v_now timestamptz:=now();
begin
 select * into v from public.tasks where id=p_task_id for update;
 if not found or v.assignee_id<>p_actor_id or v.task_type<>'assigned'
    or v.status not in ('in_progress','blocked','rejected') then
   raise exception 'Task action forbidden.' using errcode='42501';
 end if;
 v_from_status:=v.status;
 update public.tasks set status='pending_review',completion_submitted_at=v_now,updated_at=v_now
 where id=p_task_id returning * into v;
 insert into public.task_status_events(task_id,from_status,to_status,actor_id)
 values(p_task_id,v_from_status,'pending_review',p_actor_id);
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
 values(p_actor_id,'task','tasks',p_task_id,'submit',
   jsonb_build_object('status',v_from_status),
   jsonb_build_object('status','pending_review','completion_submitted_at',v_now));
 return v;
end $function$;

create or replace function public.api_approve_task_claim(
  p_actor_id uuid,p_task_id uuid,p_decision text,p_reason text default null
) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v public.tasks; v_allowed boolean; v_status text;
begin
  select * into v from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Không tìm thấy công việc.' using errcode='P0002'; end if;
  if v.task_type<>'assigned' or coalesce(v.self_claimable,false) is not true then
    raise exception 'Chỉ công việc tự nhận mới cần duyệt nhận việc.' using errcode='22023';
  end if;
  select (p_actor_id=v.reviewer_id or exists(
    select 1 from public.staff_users u join public.roles r on r.id=u.role_id
    where u.id=p_actor_id and u.active=true and r.code='admin'
  )) into v_allowed;
  if not coalesce(v_allowed,false) then raise exception 'Không có quyền duyệt nhận việc.' using errcode='42501'; end if;
  if v.status<>'waiting' then raise exception 'Công việc không ở trạng thái chờ duyệt nhận việc.' using errcode='22023'; end if;
  if p_decision not in ('approve','reject')
     or (p_decision='reject' and nullif(btrim(p_reason),'') is null) then
    raise exception 'Quyết định hoặc lý do không hợp lệ.' using errcode='22023';
  end if;
  v_status:=case when p_decision='approve' then 'in_progress' else 'rejected' end;
  update public.tasks set status=v_status,updated_at=now() where id=p_task_id returning * into v;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
  values(p_task_id,'waiting',v_status,nullif(btrim(p_reason),''),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,
    case when p_decision='approve' then 'approve_claim' else 'reject_claim' end,
    jsonb_build_object('status','waiting'),
    jsonb_build_object('status',v_status,'reason',nullif(btrim(p_reason),'')));
  return v;
end
$function$;

-- Keep the SQL action guard aligned with the completion RPC.
create or replace function public.api_assert_task_action(p_actor_id uuid, p_task_id uuid, p_action text)
returns void language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_role_code text; v_job_title_code text; v_department_id uuid;
  v_can_assign boolean; v_can_view_department boolean; v_can_step1 boolean;
  v_can_comment boolean; v_task public.tasks; v_allowed boolean := false;
begin
  select r.code,jt.code,u.department_id,coalesce(rp.can_assign_task,false),
    coalesce(rp.can_view_department_tasks,false),coalesce(rp.can_evaluate_step1,false),
    coalesce(rp.can_comment,false)
  into v_role_code,v_job_title_code,v_department_id,v_can_assign,
    v_can_view_department,v_can_step1,v_can_comment
  from public.staff_users u join public.roles r on r.id=u.role_id
  left join public.job_titles jt on jt.id=u.job_title_id
  left join public.role_permissions rp on rp.role_id=r.id
  where u.id=p_actor_id and u.active=true;
  if v_role_code is null then raise exception 'Invalid actor.' using errcode='42501'; end if;
  if v_role_code='tbt_read_only'
     or (v_role_code='tong_bien_tap' and p_action not in ('assign','comment','review')) then
    raise exception 'Task operation is read-only for this role.' using errcode='42501';
  end if;
  if p_action in ('assign','bulk') then
    if not v_can_assign then raise exception 'Assignment permission required.' using errcode='42501'; end if;
    return;
  end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  case p_action
    when 'update' then
      v_allowed := v_role_code='admin' or v_task.created_by=p_actor_id
        or (v_can_assign and v_task.department_id=v_department_id);
    when 'claim' then
      v_allowed := v_task.task_type='assigned' and v_task.self_claimable
        and v_task.status='new' and v_task.assignee_id is null;
    when 'complete_assigned' then
      v_allowed := v_task.task_type='assigned' and v_task.assignee_id=p_actor_id
        and v_task.status in ('in_progress','blocked','rejected');
    when 'report' then
      v_allowed := v_role_code='admin' or v_task.owner_id=p_actor_id
        or v_task.assignee_id=p_actor_id or exists(
          select 1 from public.task_assignees ta where ta.task_id=p_task_id
            and ta.user_id=p_actor_id and ta.assignment_role<>'watcher');
    when 'review' then
      v_allowed := v_role_code='admin' or (v_task.reviewer_id=p_actor_id and (
        v_role_code in ('tong_bien_tap','pho_tong_bien_tap','truong_phong','pho_truong_phong',
          'phu_trach_phong_bien_tap','phu_trach_phong_phong_vien','phu_trach_phong_tri_su')
        or v_job_title_code in ('tong_bien_tap','pho_tong_bien_tap','truong_phong','pho_truong_phong')
        or exists(select 1 from public.departments d where d.id=v_task.department_id and d.manager_id=p_actor_id)));
    when 'comment' then
      v_allowed := v_can_comment and (v_role_code in ('admin','tong_bien_tap')
        or v_task.created_by=p_actor_id or v_task.owner_id=p_actor_id
        or v_task.assignee_id=p_actor_id or v_task.reviewer_id=p_actor_id
        or exists(select 1 from public.task_assignees ta where ta.task_id=p_task_id and ta.user_id=p_actor_id)
        or (v_can_view_department and v_task.department_id=v_department_id));
    when 'legacy_evaluate' then
      v_allowed := v_role_code='admin' or (v_can_step1 and (v_task.created_by=p_actor_id or v_task.reviewer_id=p_actor_id));
    else raise exception 'Unknown task action.' using errcode='22023';
  end case;
  if not coalesce(v_allowed,false) then raise exception 'Task action forbidden.' using errcode='42501'; end if;
end
$function$;

-- The workflow no longer has a separate acceptance action.
drop function if exists public.api_accept_assigned_task(uuid,uuid);

commit;
