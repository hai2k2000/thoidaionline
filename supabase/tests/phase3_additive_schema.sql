\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_columns integer;
  v_tables integer;
  v_factors integer;
  v_score integer;
  v_unmapped integer;
  v_bad_mapping integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tasks' and column_name='task_type'
  ) then raise exception 'missing tasks.task_type'; end if;

  select count(*) into v_columns
  from information_schema.columns
  where table_schema='public' and table_name='tasks'
    and column_name in (
      'task_type','start_date','completion_submitted_at','completed_at',
      'cancelled_at','cancelled_by','cancel_reason','evaluation_criteria',
      'recurrence_rule_id'
    );
  if v_columns <> 9 then raise exception 'phase3 task columns %', v_columns; end if;

  select count(*) into v_tables
  from information_schema.tables
  where table_schema='public' and table_name in (
    'task_deadline_history','task_progress_reports','task_status_events',
    'task_attachments','task_recurrence_rules','task_recurrence_occurrences',
    'evaluation_rubric_versions','evaluation_rubric_factors',
    'performance_review_scores'
  );
  if v_tables <> 9 then raise exception 'phase3 table count %', v_tables; end if;

  if not exists (
    select 1 from information_schema.views
    where table_schema='public' and table_name='task_compatibility_v1'
  ) then raise exception 'missing compatibility adapter'; end if;

  select count(*), coalesce(sum(f.max_score),0)
    into v_factors, v_score
  from public.evaluation_rubric_versions v
  join public.evaluation_rubric_factors f on f.rubric_version_id=v.id
  where v.version_no=1 and v.status='published';
  if v_factors <> 5 or v_score <> 100 then
    raise exception 'rubric seed invalid %/%', v_factors, v_score;
  end if;

  select count(*) into v_unmapped
  from public.tasks
  where task_type is null;
  if v_unmapped < 1 then
    raise exception 'legacy unclaimed rows must remain unmapped';
  end if;

  select count(*) into v_bad_mapping
  from public.tasks
  where task_type is not null and (start_date is null or due_date is null);
  if v_bad_mapping <> 0 then
    raise exception 'mapped row missing dates %', v_bad_mapping;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.tasks'::regclass
      and conname='tasks_status_check'
      and pg_get_constraintdef(oid) like '%cancelled%'
      and pg_get_constraintdef(oid) like '%blocked%'
      and pg_get_constraintdef(oid) like '%waiting%'
  ) then raise exception 'canonical task status constraint missing'; end if;

  if exists (
    select 1
    from (values
      ('task_deadline_history'),('task_progress_reports'),
      ('task_status_events'),('task_attachments'),
      ('task_recurrence_rules'),('task_recurrence_occurrences'),
      ('evaluation_rubric_versions'),('evaluation_rubric_factors'),
      ('performance_review_scores'),('task_compatibility_v1')
    ) as secured(table_name)
    where has_table_privilege('anon',format('public.%I',table_name),'SELECT')
       or has_table_privilege('authenticated',format('public.%I',table_name),'SELECT')
  ) then raise exception 'phase3 object exposed to browser roles'; end if;

  if exists (
    select 1
    from (values
      ('task_deadline_history'),('task_progress_reports'),
      ('task_status_events'),('task_attachments'),
      ('task_recurrence_rules'),('task_recurrence_occurrences'),
      ('evaluation_rubric_versions'),('evaluation_rubric_factors'),
      ('performance_review_scores'),('task_compatibility_v1')
    ) as secured(table_name)
    where not has_table_privilege('service_role',format('public.%I',table_name),'SELECT')
  ) then raise exception 'service role cannot read phase3 object'; end if;

  if not exists (
    select 1 from pg_class
    where oid='public.task_compatibility_v1'::regclass
      and reloptions @> array['security_invoker=true']
  ) then raise exception 'compatibility adapter must use invoker security'; end if;

  if exists (
    select 1 from (values
      ('guard_evaluation_rubric_version()'),
      ('guard_evaluation_rubric_factor()'),
      ('guard_published_performance_review()')
    ) as secured(function_name)
    where has_function_privilege('anon',format('public.%s',function_name),'EXECUTE')
       or has_function_privilege('authenticated',format('public.%s',function_name),'EXECUTE')
  ) then raise exception 'phase3 guard function exposed to browser roles'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='performance_reviews'
      and column_name='rubric_snapshot' and data_type='jsonb'
  ) then raise exception 'missing performance rubric snapshot'; end if;
end
$test$;

do $test$
declare
  v_id uuid;
begin
  select id into v_id
  from public.evaluation_rubric_versions
  where version_no=1 and status='published';

  begin
    update public.evaluation_rubric_factors
    set label=label || ' changed'
    where rubric_version_id=v_id;
    raise exception 'published rubric unexpectedly mutable';
  exception
    when raise_exception then
      if sqlerrm='published rubric unexpectedly mutable' then raise; end if;
  end;
end
$test$;

rollback;
