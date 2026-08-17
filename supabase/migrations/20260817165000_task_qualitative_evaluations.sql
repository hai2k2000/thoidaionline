-- Additive qualitative task evaluation. Legacy 1-10 checkpoints remain untouched.

-- Fail closed when nullable task relationships make an authorization expression NULL.
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
        or v_task.created_by=p_actor_id
        or (v_task.reviewer_id=p_actor_id and v_can_assign);
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
        or (v_can_step1 and (
          v_task.created_by=p_actor_id or v_task.reviewer_id=p_actor_id
        ));
    else
      raise exception 'Unknown task action.' using errcode='22023';
  end case;
  if not coalesce(v_allowed,false) then
    raise exception 'Task action forbidden.' using errcode='42501';
  end if;
end
$function$;

revoke all on function public.api_assert_task_action(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.api_assert_task_action(uuid,uuid,text)
  to service_role;
alter function public.api_assert_task_action(uuid,uuid,text) owner to postgres;
alter function public.api_assert_task_action(uuid,uuid,text)
  set search_path=public,pg_temp;

create table if not exists public.task_qualitative_evaluations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  evaluator_id uuid not null,
  evaluation_text text not null,
  evaluation_deadline date not null,
  created_at timestamptz not null default now(),
  constraint task_qualitative_evaluations_task_id_fkey
    foreign key(task_id) references public.tasks(id) on delete cascade,
  constraint task_qualitative_evaluations_evaluator_id_fkey
    foreign key(evaluator_id) references public.staff_users(id),
  constraint task_qualitative_evaluations_text_check
    check (length(btrim(evaluation_text)) between 1 and 10000)
);

create index if not exists task_qualitative_evaluations_task_created_idx
  on public.task_qualitative_evaluations(task_id,created_at desc);

alter table public.task_qualitative_evaluations enable row level security;
revoke all on table public.task_qualitative_evaluations from public,anon,authenticated;
grant select,insert on table public.task_qualitative_evaluations to service_role;

create or replace function public.api_submit_task_qualitative_evaluation(
  p_actor_id uuid,
  p_task_id uuid,
  p_evaluation_text text,
  p_evaluation_deadline date default null
)
returns public.task_qualitative_evaluations
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_deadline date;
  v_evaluation public.task_qualitative_evaluations;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'legacy_evaluate');
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then
    raise exception 'Task not found.' using errcode='P0002';
  end if;
  if nullif(btrim(p_evaluation_text),'') is null
     or length(p_evaluation_text)>10000 then
    raise exception 'Invalid qualitative evaluation.' using errcode='22023';
  end if;
  v_deadline:=coalesce(p_evaluation_deadline,v_task.due_date,current_date);
  insert into public.task_qualitative_evaluations(
    task_id,evaluator_id,evaluation_text,evaluation_deadline
  ) values (
    p_task_id,p_actor_id,btrim(p_evaluation_text),v_deadline
  ) returning * into v_evaluation;
  insert into public.audit_logs(
    actor_id,module,entity_type,entity_id,action,new_data
  ) values (
    p_actor_id,'task','task_qualitative_evaluations',v_evaluation.id,'submit',
    jsonb_build_object(
      'task_id',p_task_id,
      'evaluation_deadline',v_deadline,
      'ai_generated',false
    )
  );
  return v_evaluation;
end
$function$;

revoke all on function public.api_submit_task_qualitative_evaluation(uuid,uuid,text,date)
  from public,anon,authenticated;
grant execute on function public.api_submit_task_qualitative_evaluation(uuid,uuid,text,date)
  to service_role;
alter function public.api_submit_task_qualitative_evaluation(uuid,uuid,text,date)
  owner to postgres;
alter function public.api_submit_task_qualitative_evaluation(uuid,uuid,text,date)
  set search_path=public,pg_temp;

comment on table public.task_qualitative_evaluations is
  'Canonical qualitative task evaluations. Legacy numeric checkpoints remain read-only.';
