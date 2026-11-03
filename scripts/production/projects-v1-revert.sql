-- Manual rollback only after restoring the pre-P1 application and taking a verified backup.
-- Populated installations must restore their pre-P1 database backup to preserve relationships.
begin;
lock table public.projects,public.project_members,public.tasks in access exclusive mode;
-- RLS has no client-role policies; dropping the tables removes the default-deny objects.
do $$ begin
 if exists(select 1 from public.projects) or exists(select 1 from public.tasks where project_id is not null) then
   raise exception 'Projects contain data; restore the verified pre-P1 database backup instead.';
 end if;
end $$;
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
create or replace function public.review_task_completion(
  p_actor_id uuid,
  p_task_id uuid,
  p_decision text,
  p_note text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks;
  v_role_code text;
  v_allowed boolean;
begin
  select r.code into v_role_code from public.staff_users u join public.roles r on r.id = u.role_id where u.id = p_actor_id and u.active;
  if v_role_code is null or v_role_code in ('tong_bien_tap', 'tbt_read_only') then
    raise exception 'Tài khoản chỉ được xem, không được duyệt.' using errcode = '42501';
  end if;
  if p_decision not in ('approve','reject') then raise exception 'Quyết định duyệt không hợp lệ.' using errcode = '22023'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Không tìm thấy công việc.' using errcode = 'P0002'; end if;
  select v_role_code = 'admin' or v_task.created_by = p_actor_id or (
      v_task.reviewer_id = p_actor_id and v_role_code in ('pho_tong_bien_tap','phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap')
    ) into v_allowed;
  if not v_allowed then raise exception 'Chỉ người nhận báo cáo, người tạo hoặc admin mới được duyệt.' using errcode = '42501'; end if;
  if v_task.status <> 'pending_review' then raise exception 'Công việc chưa ở trạng thái chờ duyệt.' using errcode = '22023'; end if;
  update public.tasks set status = case when p_decision = 'approve' then 'done' else 'rejected' end,
      progress_percent = case when p_decision = 'approve' then 100 else progress_percent end,
      updated_at = now()
   where id = p_task_id returning * into v_task;
  insert into public.task_comments(task_id,user_id,content) values (
    p_task_id,p_actor_id,
    case when p_decision = 'approve' then '✅ Đã phê duyệt hoàn thành.' else '↩️ Đã trả lại để bổ sung.' end
      || case when nullif(btrim(coalesce(p_note, '')), '') is null then '' else E'\n' || btrim(p_note) end
  );
  return v_task;
end;
$$;

create or replace function public.enforce_assignee_manager_watcher()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_task_type text;
  v_task_category text;
  v_department uuid;
  v_manager uuid;
begin
  select task_type,task_category into v_task_type,v_task_category
  from public.tasks where id=new.task_id;

  if v_task_category='duty' or v_task_type is distinct from 'assigned'
     or new.assignment_role not in ('owner','assignee') then
    return new;
  end if;

  select u.department_id into v_department
  from public.staff_users u where u.id=new.user_id and u.active=true;
  if v_department is null then
    raise exception 'Assigned participant requires an active department.' using errcode='22023';
  end if;

  select d.manager_id into v_manager
  from public.departments d
  join public.staff_users manager on manager.id=d.manager_id and manager.active=true
  where d.id=v_department and d.active=true;
  if v_manager is null then
    raise exception 'Assignee department requires an active primary manager.' using errcode='22023';
  end if;

  if v_manager<>new.user_id then
    insert into public.task_assignees(task_id,user_id,assignment_role,status)
    values(new.task_id,v_manager,'watcher','todo') on conflict(task_id,user_id) do nothing;
  end if;
  return new;
end
$function$;

alter function public.enforce_assignee_manager_watcher() owner to postgres;

drop function if exists public.api_create_project(uuid,text,text,text,uuid,uuid[]);
drop function if exists public.api_update_project(uuid,uuid,text,text,text,uuid);
drop function if exists public.api_set_project_member(uuid,uuid,uuid,text,boolean);
drop function if exists public.api_close_project(uuid,uuid);
drop function if exists public.api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text);
drop function if exists public.api_project_actor_can_create(uuid);
drop function if exists public.api_project_is_lead(uuid,uuid);
delete from public.user_permission_grants where permission_id in (select id from public.permissions where code='project.create');
delete from public.role_permission_grants where permission_id in (select id from public.permissions where code='project.create');
delete from public.permissions where code='project.create';
alter table public.tasks drop column project_id;
drop table public.project_members;
drop table public.projects;
notify pgrst,'reload schema';
commit;
