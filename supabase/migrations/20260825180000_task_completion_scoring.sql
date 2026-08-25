begin;

create table if not exists public.task_completion_scores (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  reviewer_id uuid not null references public.staff_users(id),
  requirement_results jsonb not null default '[]'::jsonb,
  requirement_score numeric(5,2) not null check (requirement_score between 0 and 60),
  collaboration_score numeric(5,2) not null check (collaboration_score between 0 and 20),
  initiative_score numeric(5,2) not null check (initiative_score between 0 and 20),
  total_score numeric(5,2) generated always as (requirement_score + collaboration_score + initiative_score) stored,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.api_score_task_completion(
  p_actor_id uuid,
  p_task_id uuid,
  p_requirement_results jsonb,
  p_collaboration_score numeric,
  p_initiative_score numeric,
  p_note text default null
) returns public.task_completion_scores
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_task public.tasks;
  v_row public.task_completion_scores;
  v_requirements jsonb := '[]'::jsonb;
  v_count integer;
  v_achieved integer;
begin
  perform public.api_assert_task_action(p_actor_id,p_task_id,'review');
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if v_task.status <> 'pending_review' then raise exception 'Task is not awaiting review.' using errcode='22023'; end if;
  if v_task.reviewer_id <> p_actor_id and not exists (
    select 1 from public.staff_users u join public.roles r on r.id=u.role_id
    where u.id=p_actor_id and r.code='admin'
  ) then raise exception 'Only the assigned reviewer can score this task.' using errcode='42501'; end if;
  if jsonb_typeof(coalesce(p_requirement_results,'[]'::jsonb)) <> 'array'
     or p_collaboration_score is null or p_initiative_score is null
     or p_collaboration_score < 0 or p_collaboration_score > 20
     or p_initiative_score < 0 or p_initiative_score > 20 then
    raise exception 'Invalid completion score.' using errcode='22023';
  end if;
  begin
    v_requirements := case when v_task.evaluation_criteria is null then '[]'::jsonb else v_task.evaluation_criteria::jsonb end;
  exception when others then
    v_requirements := '[]'::jsonb;
  end;
  if jsonb_typeof(v_requirements) <> 'array' then v_requirements := '[]'::jsonb; end if;
  v_count := jsonb_array_length(v_requirements);
  if jsonb_array_length(p_requirement_results) <> v_count then
    raise exception 'Requirement score count does not match task requirements.' using errcode='22023';
  end if;
  select count(*) into v_achieved
  from jsonb_array_elements(p_requirement_results) item
  where (item->>'achieved')::boolean is true;
  insert into public.task_completion_scores(
    task_id,reviewer_id,requirement_results,requirement_score,collaboration_score,initiative_score,note,updated_at
  ) values (
    p_task_id,p_actor_id,p_requirement_results,
    case when v_count=0 then 0 else round((60.0 * v_achieved / v_count)::numeric,2) end,
    p_collaboration_score,p_initiative_score,nullif(btrim(coalesce(p_note,'')),''),now()
  )
  on conflict (task_id) do update set
    reviewer_id=excluded.reviewer_id,
    requirement_results=excluded.requirement_results,
    requirement_score=excluded.requirement_score,
    collaboration_score=excluded.collaboration_score,
    initiative_score=excluded.initiative_score,
    note=excluded.note,
    updated_at=now()
  returning * into v_row;
  perform public.api_review_assigned_task_completion(p_actor_id,p_task_id,'approve',null);
  insert into public.task_comments(task_id,user_id,content)
  values (p_task_id,p_actor_id,'Đã chấm điểm công việc. Tổng điểm: ' || v_row.total_score || '/100.');
  return v_row;
end
$function$;

revoke all on function public.api_score_task_completion(uuid,uuid,jsonb,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.api_score_task_completion(uuid,uuid,jsonb,numeric,numeric,text) to service_role;
alter function public.api_score_task_completion(uuid,uuid,jsonb,numeric,numeric,text) owner to postgres;

commit;