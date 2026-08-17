alter table public.role_permissions
  add column if not exists can_assign_task boolean not null default false,
  add column if not exists can_view_department_tasks boolean not null default false,
  add column if not exists can_evaluate_step1 boolean not null default false,
  add column if not exists can_evaluate_step2 boolean not null default false,
  add column if not exists can_manage_rubrics boolean not null default false;

alter table public.departments
  add column if not exists manager_id uuid
    references public.staff_users(id) on delete set null;

create index if not exists idx_departments_manager_id
  on public.departments(manager_id)
  where manager_id is not null;

create or replace function public.validate_department_manager()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $function$
begin
  if new.manager_id is not null and not exists (
    select 1
    from public.staff_users u
    where u.id=new.manager_id
      and u.department_id=new.id
      and u.active=true
  ) then
    raise exception 'Primary manager must be active and belong to the department.'
      using errcode='23514';
  end if;
  return new;
end
$function$;

drop trigger if exists validate_department_manager on public.departments;
create trigger validate_department_manager
before insert or update of manager_id on public.departments
for each row execute function public.validate_department_manager();

insert into public.role_permissions(role_id)
select id from public.roles
on conflict (role_id) do nothing;

update public.role_permissions rp
set can_comment = case
      when r.code='tong_bien_tap' then true
      when r.code='tbt_read_only' then false
      else rp.can_comment
    end,
    can_assign_task = r.code in (
      'admin','pho_tong_bien_tap','phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien','phu_trach_phong_bien_tap'
    ),
    can_view_department_tasks = r.code in (
      'admin','pho_tong_bien_tap','phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien','phu_trach_phong_bien_tap'
    ),
    can_evaluate_step1 = r.code in (
      'admin','pho_tong_bien_tap','phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien','phu_trach_phong_bien_tap'
    ),
    can_evaluate_step2 = r.code='tong_bien_tap',
    can_manage_rubrics = r.code='admin',
    updated_at=now()
from public.roles r
where r.id=rp.role_id;

with eligible as (
  select d.id as department_id,
         (array_agg(u.id order by u.id))[1] as manager_id
  from public.departments d
  join public.staff_users u on u.department_id=d.id and u.active=true
  join public.roles r on r.id=u.role_id
  where d.active=true
    and r.code in (
      'phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien',
      'phu_trach_phong_bien_tap'
    )
  group by d.id
  having count(*)=1
)
update public.departments d
set manager_id=e.manager_id
from eligible e
where d.id=e.department_id
  and d.manager_id is null;

create or replace function public.api_assert_task_action(
  p_actor_id uuid,
  p_task_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_role_code text;
  v_department_id uuid;
  v_can_assign boolean;
  v_can_view_department boolean;
  v_can_step1 boolean;
  v_can_comment boolean;
  v_task public.tasks;
  v_allowed boolean := false;
begin
  select r.code,u.department_id,
         coalesce(rp.can_assign_task,false),
         coalesce(rp.can_view_department_tasks,false),
         coalesce(rp.can_evaluate_step1,false),
         coalesce(rp.can_comment,false)
  into v_role_code,v_department_id,v_can_assign,
       v_can_view_department,v_can_step1,v_can_comment
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  left join public.role_permissions rp on rp.role_id=r.id
  where u.id=p_actor_id and u.active=true;

  if v_role_code is null then
    raise exception 'Invalid actor.' using errcode='42501';
  end if;
  if v_role_code='tbt_read_only'
     or (v_role_code='tong_bien_tap' and p_action<>'comment') then
    raise exception 'Task operation is read-only for this role.'
      using errcode='42501';
  end if;
  if p_action in ('assign','bulk') then
    if not v_can_assign then
      raise exception 'Assignment permission required.' using errcode='42501';
    end if;
    return;
  end if;

  select * into v_task
  from public.tasks
  where id=p_task_id
  for update;
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
        or exists (
          select 1 from public.task_assignees ta
          where ta.task_id=p_task_id and ta.user_id=p_actor_id
            and ta.assignment_role<>'watcher'
        );
    when 'review' then
      v_allowed := v_role_code='admin'
        or v_task.created_by=p_actor_id
        or (v_task.reviewer_id=p_actor_id and v_can_assign);
    when 'comment' then
      v_allowed := v_can_comment and (
        v_role_code in ('admin','tong_bien_tap')
        or v_task.created_by=p_actor_id
        or v_task.owner_id=p_actor_id
        or v_task.assignee_id=p_actor_id
        or v_task.reviewer_id=p_actor_id
        or exists (
          select 1 from public.task_assignees ta
          where ta.task_id=p_task_id and ta.user_id=p_actor_id
        )
        or (v_can_view_department and v_task.department_id=v_department_id)
      );
    when 'legacy_evaluate' then
      v_allowed := v_role_code='admin'
        or (
          v_can_step1
          and (
            v_task.created_by=p_actor_id
            or v_task.reviewer_id=p_actor_id
          )
        );
    else
      raise exception 'Unknown task action.' using errcode='22023';
  end case;

  if not v_allowed then
    raise exception 'Task action forbidden.' using errcode='42501';
  end if;
end
$function$;

create or replace function public.api_create_task(
  p_actor_id uuid,
  p_title text,
  p_description text,
  p_department_id uuid,
  p_assignee_id uuid,
  p_reviewer_id uuid,
  p_assignment_mode text,
  p_due_date date,
  p_collaborator_ids uuid[] default '{}'::uuid[]
)
returns public.tasks
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_user_id uuid;
  v_role_code text;
  v_actor_department_id uuid;
begin
  perform public.api_assert_task_action(p_actor_id,null,'assign');
  select r.code,u.department_id
  into v_role_code,v_actor_department_id
  from public.staff_users u
  join public.roles r on r.id=u.role_id
  where u.id=p_actor_id and u.active=true;
  if v_role_code not in ('admin','pho_tong_bien_tap')
     and (
       p_department_id is null
       or v_actor_department_id is null
       or p_department_id<>v_actor_department_id
     ) then
    raise exception 'Assignment is outside actor scope.' using errcode='42501';
  end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>500
     or nullif(btrim(p_description),'') is null or length(p_description)>10000
     or p_due_date is null
     or p_assignment_mode not in ('individual','multi_user','department','mixed') then
    raise exception 'Invalid task input.' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.staff_users
    where id=p_assignee_id and active=true
  ) then raise exception 'Invalid assignee.' using errcode='22023'; end if;

  insert into public.tasks(
    title,description,department_id,assignee_id,owner_id,reviewer_id,
    created_by,assignment_mode,due_date,status,progress_percent,
    plan_period,self_claimable
  ) values (
    btrim(p_title),btrim(p_description),p_department_id,p_assignee_id,
    p_assignee_id,p_reviewer_id,p_actor_id,p_assignment_mode,p_due_date,
    'new',0,'ad_hoc',false
  )
  returning * into v_task;

  insert into public.task_assignees(task_id,user_id,assignment_role,status)
  values(v_task.id,p_assignee_id,'owner','todo')
  on conflict(task_id,user_id) do update
    set assignment_role='owner',status='todo';

  foreach v_user_id in array coalesce(p_collaborator_ids,'{}'::uuid[]) loop
    if v_user_id<>p_assignee_id and exists (
      select 1 from public.staff_users where id=v_user_id and active=true
    ) then
      insert into public.task_assignees(task_id,user_id,assignment_role,status)
      values(v_task.id,v_user_id,'assignee','todo')
      on conflict(task_id,user_id) do nothing;
    end if;
  end loop;

  insert into public.audit_logs(
    actor_id,module,entity_type,entity_id,action,new_data
  ) values (
    p_actor_id,'task','tasks',v_task.id,'create',
    jsonb_build_object('status',v_task.status,'assignment_mode',v_task.assignment_mode)
  );
  return v_task;
end
$function$;

create or replace function public.api_update_task(
  p_actor_id uuid,
  p_task_id uuid,
  p_status text default null,
  p_due_date date default null,
  p_update_due_date boolean default false
)
returns public.tasks
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_before public.tasks;
  v_after public.tasks;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'update');
  select * into v_before from public.tasks where id=p_task_id;
  if p_status is not null and p_status not in ('new','in_progress') then
    raise exception 'Use report/review for completion transitions.'
      using errcode='22023';
  end if;
  if p_status is null and not p_update_due_date then
    raise exception 'No update supplied.' using errcode='22023';
  end if;
  update public.tasks
  set status=coalesce(p_status,status),
      due_date=case when p_update_due_date then p_due_date else due_date end,
      updated_at=now()
  where id=p_task_id
  returning * into v_after;
  insert into public.audit_logs(
    actor_id,module,entity_type,entity_id,action,old_data,new_data
  ) values (
    p_actor_id,'task','tasks',p_task_id,'update',
    jsonb_build_object('status',v_before.status,'due_date',v_before.due_date),
    jsonb_build_object('status',v_after.status,'due_date',v_after.due_date)
  );
  return v_after;
end
$function$;

create or replace function public.api_add_task_comment(
  p_actor_id uuid,
  p_task_id uuid,
  p_content text
)
returns public.task_comments
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_comment public.task_comments;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'comment');
  if nullif(btrim(p_content),'') is null or length(p_content)>10000 then
    raise exception 'Invalid comment.' using errcode='22023';
  end if;
  insert into public.task_comments(task_id,user_id,content)
  values(p_task_id,p_actor_id,btrim(p_content))
  returning * into v_comment;
  insert into public.audit_logs(
    actor_id,module,entity_type,entity_id,action,new_data
  ) values (
    p_actor_id,'task','task_comments',v_comment.id,'create',
    jsonb_build_object('task_id',p_task_id)
  );
  return v_comment;
end
$function$;

create or replace function public.api_claim_task_plan(
  p_actor_id uuid,p_task_id uuid
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_task public.tasks;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'claim');
  v_task := public.claim_task_plan(p_actor_id,p_task_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'claim',
    jsonb_build_object('status',v_task.status));
  return v_task;
end
$function$;

create or replace function public.api_report_task_progress(
  p_actor_id uuid,p_task_id uuid,p_progress integer,
  p_report text,p_blockers text default null
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_task public.tasks;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'report');
  v_task := public.report_task_progress(
    p_actor_id,p_task_id,p_progress,p_report,p_blockers
  );
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',p_task_id,'submit',
    jsonb_build_object('progress_percent',v_task.progress_percent,'status',v_task.status));
  return v_task;
end
$function$;

create or replace function public.api_review_task_completion(
  p_actor_id uuid,p_task_id uuid,p_decision text,p_note text default null
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_task public.tasks;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'review');
  v_task := public.review_task_completion(
    p_actor_id,p_task_id,p_decision,p_note
  );
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','tasks',p_task_id,
    case when p_decision='approve' then 'approve' else 'update' end,
    jsonb_build_object('decision',p_decision,'status',v_task.status));
  return v_task;
end
$function$;

create or replace function public.api_save_task_evaluation_checkpoint(
  p_actor_id uuid,p_task_id uuid,p_employee_id uuid,p_rating integer,
  p_effort_weight integer,p_completion text,p_on_time boolean,
  p_opinion text,p_checkpoint_date date,p_is_final boolean
) returns public.task_evaluation_checkpoints
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_row public.task_evaluation_checkpoints;
begin
  perform public.api_assert_task_action(
    p_actor_id,p_task_id,'legacy_evaluate'
  );
  v_row := public.save_task_evaluation_checkpoint(
    p_actor_id,p_task_id,p_employee_id,p_rating,p_effort_weight,
    p_completion,p_on_time,p_opinion,p_checkpoint_date,p_is_final
  );
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','task_evaluation_checkpoints',v_row.id,'submit',
    jsonb_build_object('task_id',p_task_id,'is_final',p_is_final));
  return v_row;
end
$function$;

create or replace function public.api_create_bulk_task_plan(
  p_actor_id uuid,p_plan_period text,p_due_date date,p_reviewer_id uuid,
  p_description text,p_items jsonb,p_batch_id uuid
) returns setof public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  perform public.api_assert_task_action(p_actor_id,null,'bulk');
  if jsonb_typeof(p_items)<>'array' then
    raise exception 'Invalid bulk task items.' using errcode='22023';
  end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor_id,'task','task_plan_batch',p_batch_id,'create',
    jsonb_build_object('plan_period',p_plan_period,'item_count',jsonb_array_length(p_items)));
  return query select * from public.create_bulk_task_plan(
    p_actor_id,p_plan_period,p_due_date,p_reviewer_id,
    p_description,p_items,p_batch_id
  );
end
$function$;

revoke all on function public.api_assert_task_action(uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.api_create_task(uuid,text,text,uuid,uuid,uuid,text,date,uuid[])
  from public,anon,authenticated;
revoke all on function public.api_update_task(uuid,uuid,text,date,boolean)
  from public,anon,authenticated;
revoke all on function public.api_claim_task_plan(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.api_report_task_progress(uuid,uuid,integer,text,text)
  from public,anon,authenticated;
revoke all on function public.api_review_task_completion(uuid,uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.api_save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)
  from public,anon,authenticated;
revoke all on function public.api_add_task_comment(uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.api_create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid)
  from public,anon,authenticated;

grant execute on function public.api_create_task(uuid,text,text,uuid,uuid,uuid,text,date,uuid[])
  to service_role;
grant execute on function public.api_update_task(uuid,uuid,text,date,boolean)
  to service_role;
grant execute on function public.api_claim_task_plan(uuid,uuid)
  to service_role;
grant execute on function public.api_report_task_progress(uuid,uuid,integer,text,text)
  to service_role;
grant execute on function public.api_review_task_completion(uuid,uuid,text,text)
  to service_role;
grant execute on function public.api_save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean)
  to service_role;
grant execute on function public.api_add_task_comment(uuid,uuid,text)
  to service_role;
grant execute on function public.api_create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid)
  to service_role;

alter function public.api_assert_task_action(uuid,uuid,text) owner to postgres;
alter function public.api_create_task(uuid,text,text,uuid,uuid,uuid,text,date,uuid[]) owner to postgres;
alter function public.api_update_task(uuid,uuid,text,date,boolean) owner to postgres;
alter function public.api_claim_task_plan(uuid,uuid) owner to postgres;
alter function public.api_report_task_progress(uuid,uuid,integer,text,text) owner to postgres;
alter function public.api_review_task_completion(uuid,uuid,text,text) owner to postgres;
alter function public.api_save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean) owner to postgres;
alter function public.api_add_task_comment(uuid,uuid,text) owner to postgres;
alter function public.api_create_bulk_task_plan(uuid,text,date,uuid,text,jsonb,uuid) owner to postgres;
