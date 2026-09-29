begin;

create table if not exists public.task_assignment_batch_idempotency (
  actor_id uuid not null references public.staff_users(id),
  batch_id uuid not null,
  request_hash text not null,
  task_ids uuid[] not null default '{}'::uuid[],
  task_count integer not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (actor_id, batch_id),
  constraint task_assignment_batch_task_count_check
    check (task_count between 1 and 20),
  constraint task_assignment_batch_request_hash_check
    check (length(btrim(request_hash)) > 0),
  constraint task_assignment_batch_completion_check
    check (
      (completed_at is null and cardinality(task_ids) = 0)
      or
      (completed_at is not null and cardinality(task_ids) = task_count)
    )
);

create index if not exists task_assignment_batch_idempotency_created_at_idx
  on public.task_assignment_batch_idempotency(created_at);

create or replace function public.api_assign_task_batch_v1(
  p_actor_id uuid,
  p_batch_id uuid,
  p_department_id uuid,
  p_assignee_id uuid,
  p_tasks jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
begin
  raise exception 'feature_not_ready' using errcode='0A000';
end
$function$;

revoke all on function public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)
  to service_role;
alter function public.api_assign_task_batch_v1(uuid,uuid,uuid,uuid,jsonb)
  owner to postgres;

notify pgrst,'reload schema';
commit;
