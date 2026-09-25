begin;

create or replace function public.api_register_journalism_task_v1(
  p_actor_id uuid,
  p_title text,
  p_description text,
  p_department_id uuid,
  p_due_date date,
  p_due_time time,
  p_evaluation_criteria text,
  p_work_kind_id uuid,
  p_planned_publication_at timestamptz,
  p_location text,
  p_editorial_notes text
) returns public.tasks
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_actor_role text;
  v_actor_department uuid;
  v_manager uuid;
  v_kind public.journalism_work_kinds;
begin
  select r.code, u.department_id into v_actor_role, v_actor_department
  from public.staff_users u
  join public.roles r on r.id=u.role_id and r.active=true
  join public.departments d on d.id=u.department_id and d.active=true
  where u.id=p_actor_id and u.active=true;
  if v_actor_role is null or v_actor_department is null then
    raise exception 'Invalid actor.' using errcode='42501';
  end if;
  if v_actor_department <> p_department_id then
    raise exception 'Journalism target must be Content department.' using errcode='42501';
  end if;
  if not exists(select 1 from public.departments where id=p_department_id and code='editorial' and active=true) then
    raise exception 'Journalism target must be Content department.' using errcode='42501';
  end if;
  if v_actor_role not in ('phong_vien','nhan_vien','bien_tap_vien') then
    raise exception 'Self-registration is limited to editorial employees.' using errcode='42501';
  end if;
  select manager_id into v_manager from public.departments where id=p_department_id and active=true;
  if v_manager is null then
    raise exception 'Department requires a primary manager.' using errcode='22023';
  end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500
     or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or p_due_date is null or p_due_time is null
     or (p_evaluation_criteria is not null and length(p_evaluation_criteria)>10000)
     or (p_location is not null and length(p_location)>500)
     or (p_editorial_notes is not null and length(p_editorial_notes)>10000)
     or (p_planned_publication_at is not null and p_planned_publication_at < now()) then
    raise exception 'Invalid journalism task input.' using errcode='22023';
  end if;
  select * into v_kind from public.journalism_work_kinds where id=p_work_kind_id and is_active=true;
  if not found then raise exception 'Inactive work kind.' using errcode='22023'; end if;

  insert into public.tasks(
    title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,
    assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,
    task_type,start_date,evaluation_criteria,priority,approval_required
  ) values(
    btrim(p_title),btrim(p_description),p_department_id,p_actor_id,p_actor_id,v_manager,p_actor_id,
    'individual',p_due_date,p_due_time,'waiting',0,'ad_hoc',false,'assigned',
    timezone('Asia/Ho_Chi_Minh',now())::date,nullif(btrim(p_evaluation_criteria),''),'normal',true
  ) returning * into v_task;
  insert into public.task_assignees(task_id,user_id,assignment_role,status)
  values(v_task.id,p_actor_id,'owner','todo');
  insert into public.journalism_task_details(
    task_id,work_kind_id,publication_status,planned_publication_at,location,editorial_notes
  ) values(
    v_task.id,p_work_kind_id,'not_published',p_planned_publication_at,
    nullif(btrim(p_location),''),nullif(btrim(p_editorial_notes),'')
  );
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
  values(v_task.id,null,'waiting','Chờ duyệt giao việc',p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',v_task.id,'create',jsonb_build_object(
    'task_type','assigned','status','waiting','approval_required',true,'assignment_source','self_registered'
  ));
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',v_task.id,'submit_assignment_approval',jsonb_build_object(
    'status','waiting','approval_required',true,'reviewer_id',v_manager
  ));
  return v_task;
end
$function$;

revoke all on function public.api_register_journalism_task_v1(uuid,text,text,uuid,date,time,text,uuid,timestamptz,text,text)
  from public,anon,authenticated;
grant execute on function public.api_register_journalism_task_v1(uuid,text,text,uuid,date,time,text,uuid,timestamptz,text,text)
  to service_role;
alter function public.api_register_journalism_task_v1(uuid,text,text,uuid,date,time,text,uuid,timestamptz,text,text)
  owner to postgres;

notify pgrst,'reload schema';
commit;
