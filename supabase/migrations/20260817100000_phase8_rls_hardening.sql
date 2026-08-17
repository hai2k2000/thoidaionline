begin;

do $hardening$
declare
  v_table text;
  v_policy record;
  v_sequence regclass;
  v_proc regprocedure;
begin
  foreach v_table in array array[
    'tasks','task_assignees','task_comments','task_progress_logs','task_progress_reports',
    'task_attachments','task_deadline_history','task_status_events','task_recurrence_rules',
    'task_recurrence_occurrences','task_evaluation_checkpoints','staff_users','departments',
    'roles','role_permissions','job_titles','evaluation_rubric_versions','evaluation_rubric_factors',
    'performance_cycles','performance_reviews','performance_review_scores','performance_criteria','audit_logs'
  ] loop
    if to_regclass(format('public.%I',v_table)) is null then continue; end if;
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all privileges on table public.%I from public,anon,authenticated',v_table);
    execute format('grant select,insert,update,delete on table public.%I to service_role',v_table);
    for v_policy in select policyname from pg_policies where schemaname='public' and tablename=v_table loop
      execute format('drop policy if exists %I on public.%I',v_policy.policyname,v_table);
    end loop;
  end loop;

  for v_sequence in
    select c.oid::regclass from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='S'
  loop
    execute format('revoke all privileges on sequence %s from public,anon,authenticated',v_sequence);
    execute format('grant usage,select,update on sequence %s to service_role',v_sequence);
  end loop;

  for v_proc in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
  loop
    execute format('revoke execute on function %s from public,anon,authenticated',v_proc);
    execute format('grant execute on function %s to service_role',v_proc);
  end loop;
end
$hardening$;

create or replace function public.api_save_task_evaluation_checkpoint(
  p_actor_id uuid,p_task_id uuid,p_employee_id uuid,p_rating integer,
  p_effort_weight integer,p_completion text,p_on_time boolean,
  p_opinion text,p_checkpoint_date date,p_is_final boolean
) returns public.task_evaluation_checkpoints
language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  -- feature_not_supported: legacy evidence is immutable after cutover.
  raise exception 'legacy 1-10 evaluation is read-only'
    using errcode='0A000';
end
$function$;

create or replace function public.api_report_task_progress(
  p_actor_id uuid,p_task_id uuid,p_progress integer,
  p_report text,p_blockers text default null
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  -- feature_not_supported: structured reports replace percent progress.
  raise exception 'legacy percent progress is read-only'
    using errcode='0A000';
end
$function$;

revoke execute on function public.api_save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean),public.api_report_task_progress(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.api_save_task_evaluation_checkpoint(uuid,uuid,uuid,integer,integer,text,boolean,text,date,boolean),public.api_report_task_progress(uuid,uuid,integer,text,text) to service_role;

commit;
