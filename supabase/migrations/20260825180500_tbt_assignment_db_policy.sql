begin;
create or replace function public.api_assert_task_action(
  p_actor_id uuid,p_task_id uuid,p_action text
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_role_code text;
  v_job_title_code text;
  v_department_id uuid;
  v_can_assign boolean;
  v_can_view_department boolean;
  v_can_step1 boolean;
  v_can_comment boolean;
  v_task public.tasks;
  v_allowed boolean := false;
begin
  select r.code,jt.code,u.department_id,
         coalesce(rp.can_assign_task,false),
         coalesce(rp.can_view_department_tasks,false),
         coalesce(rp.can_evaluate_step1,false),
         coalesce(rp.can_comment,false)
  into v_role_code,v_job_title_code,v_department_id,v_can_assign,
       v_can_view_department,v_can_step1,v_can_comment
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  left join public.job_titles jt on jt.id=u.job_title_id
  left join public.role_permissions rp on rp.role_id=r.id
  where u.id=p_actor_id and u.active=true;
  if v_role_code is null then
    raise exception 'Invalid actor.' using errcode='42501';
  end if;
  if v_role_code='tbt_read_only'
     or (v_role_code='tong_bien_tap' and p_action not in ('assign','comment','review')) then
    raise exception 'Task operation is read-only for this role.' using errcode='42501';
  end if;
  if p_action in ('assign','bulk') then
    if not v_can_assign then
      raise exception 'Assignment permission required.' using errcode='42501';
    end if;
    return;
  end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then
    raise exception 'Task not found.' using errcode='P0002';
  end if;
  case p_action
    when 'update' then
      v_allowed := v_role_code='admin'
        or v_task.created_by=p_actor_id
        or (v_can_assign and v_task.department_id=v_department_id);
    when 'claim' then
      v_allowed := v_task.self_claimable
        and v_task.status='new'
        and v_task.assignee_id is null;
    when 'report' then
      v_allowed := v_role_code='admin'
        or v_task.owner_id=p_actor_id
        or v_task.assignee_id=p_actor_id
        or exists(
          select 1 from public.task_assignees ta
          where ta.task_id=p_task_id and ta.user_id=p_actor_id
            and ta.assignment_role<>'watcher'
        );
    when 'review' then
      v_allowed := v_role_code='admin'
        or (
          v_task.reviewer_id=p_actor_id
          and (
            v_role_code in ('tong_bien_tap','pho_tong_bien_tap','truong_phong','pho_truong_phong','phu_trach_phong_bien_tap','phu_trach_phong_phong_vien','phu_trach_phong_tri_su')
            or v_job_title_code in ('tong_bien_tap','pho_tong_bien_tap','truong_phong','pho_truong_phong')
            or exists(select 1 from public.departments d where d.id=v_task.department_id and d.manager_id=p_actor_id)
          )
        );
    when 'comment' then
      v_allowed := v_can_comment and (
        v_role_code in ('admin','tong_bien_tap')
        or v_task.created_by=p_actor_id
        or v_task.owner_id=p_actor_id
        or v_task.assignee_id=p_actor_id
        or v_task.reviewer_id=p_actor_id
        or exists(
          select 1 from public.task_assignees ta
          where ta.task_id=p_task_id and ta.user_id=p_actor_id
        )
        or (v_can_view_department and v_task.department_id=v_department_id)
      );
    when 'legacy_evaluate' then
      v_allowed := v_role_code='admin'
        or (v_can_step1 and (v_task.created_by=p_actor_id or v_task.reviewer_id=p_actor_id));
    else
      raise exception 'Unknown task action.' using errcode='22023';
  end case;
  if not coalesce(v_allowed,false) then
    raise exception 'Task action forbidden.' using errcode='42501';
  end if;
end
$function$;


revoke all on function public.api_assert_task_action(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.api_assert_task_action(uuid,uuid,text) to service_role;
alter function public.api_assert_task_action(uuid,uuid,text) owner to postgres;
commit;
