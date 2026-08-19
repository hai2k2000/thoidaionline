-- Separate provenance and leader authorization for qualitative task evaluations.
alter table public.task_qualitative_evaluations
  add column if not exists evaluation_source text not null default 'chatgpt';

alter table public.task_qualitative_evaluations
  drop constraint if exists task_qualitative_evaluations_source_check;
alter table public.task_qualitative_evaluations
  add constraint task_qualitative_evaluations_source_check
  check (evaluation_source in ('chatgpt','leader'));

create index if not exists task_qualitative_evaluations_task_source_created_idx
  on public.task_qualitative_evaluations(task_id,evaluation_source,created_at desc);

drop function if exists public.api_submit_task_qualitative_evaluation(uuid,uuid,text,date);
drop function if exists public.api_submit_task_qualitative_evaluation(uuid,uuid,text,date,text);

create or replace function public.api_submit_task_qualitative_evaluation(
  p_actor_id uuid,
  p_task_id uuid,
  p_evaluation_text text,
  p_evaluation_deadline date default null,
  p_evaluation_source text default 'chatgpt'
)
returns public.task_qualitative_evaluations
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_deadline date;
  v_source text := coalesce(nullif(btrim(p_evaluation_source),''),'chatgpt');
  v_allowed boolean := false;
  v_evaluation public.task_qualitative_evaluations;
begin
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then
    raise exception 'Task not found.' using errcode='P0002';
  end if;
  if v_source not in ('chatgpt','leader') then
    raise exception 'Invalid evaluation source.' using errcode='22023';
  end if;
  if v_source='chatgpt' then
    perform public.api_assert_task_action(p_actor_id,p_task_id,'legacy_evaluate');
  else
    select exists(
      select 1
      from public.staff_users u
      join public.roles r on r.id=u.role_id
      left join public.role_permissions rp on rp.role_id=r.id
      left join public.departments d on d.id=v_task.department_id
      where u.id=p_actor_id and u.active=true
        and (
          r.code='admin'
          or (r.code='tong_bien_tap' and coalesce(rp.can_evaluate_step2,false))
          or (coalesce(rp.can_evaluate_step1,false) and d.manager_id=p_actor_id)
        )
    ) into v_allowed;
    if not coalesce(v_allowed,false) then
      raise exception 'Leader evaluation forbidden.' using errcode='42501';
    end if;
  end if;
  if nullif(btrim(p_evaluation_text),'') is null
     or length(p_evaluation_text)>10000 then
    raise exception 'Invalid qualitative evaluation.' using errcode='22023';
  end if;
  v_deadline:=coalesce(p_evaluation_deadline,v_task.due_date,current_date);
  insert into public.task_qualitative_evaluations(
    task_id,evaluator_id,evaluation_text,evaluation_deadline,evaluation_source
  ) values (
    p_task_id,p_actor_id,btrim(p_evaluation_text),v_deadline,v_source
  ) returning * into v_evaluation;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values (
    p_actor_id,'task','task_qualitative_evaluations',v_evaluation.id,'submit',
    jsonb_build_object('task_id',p_task_id,'evaluation_deadline',v_deadline,
      'evaluation_source',v_source,'ai_generated',false)
  );
  return v_evaluation;
end
$function$;

revoke all on function public.api_submit_task_qualitative_evaluation(uuid,uuid,text,date,text)
  from public,anon,authenticated;
grant execute on function public.api_submit_task_qualitative_evaluation(uuid,uuid,text,date,text)
  to service_role;
alter function public.api_submit_task_qualitative_evaluation(uuid,uuid,text,date,text) owner to postgres;
alter function public.api_submit_task_qualitative_evaluation(uuid,uuid,text,date,text)
  set search_path=public,pg_temp;
