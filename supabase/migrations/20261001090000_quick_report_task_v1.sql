begin;

-- Explicit workflow metadata. Existing rows keep STANDARD semantics.
alter table public.tasks
  add column if not exists workflow_type text not null default 'STANDARD',
  add column if not exists report_category text,
  add column if not exists report_work_date date,
  add column if not exists report_started_time time without time zone,
  add column if not exists report_completed_time time without time zone,
  add column if not exists report_notes text;

alter table public.tasks drop constraint if exists tasks_workflow_type_check;
alter table public.tasks add constraint tasks_workflow_type_check
  check (workflow_type in ('STANDARD', 'REPORT_ONLY'));

alter table public.tasks drop constraint if exists tasks_report_category_check;
alter table public.tasks add constraint tasks_report_category_check
  check (report_category is null or report_category in (
    'computer','network','printer_device','facilities',
    'official_document','administration','other'
  ));

alter table public.tasks drop constraint if exists tasks_report_status_check;
alter table public.tasks add constraint tasks_report_status_check
  check (
    workflow_type <> 'REPORT_ONLY'
    or (
      report_category is not null
      and report_work_date is not null
      and report_started_time is not null
      and status in ('in_progress','done','cancelled')
      and (status <> 'done' or report_completed_time is not null)
      and (report_completed_time is null or report_completed_time >= report_started_time)
    )
  );

create index if not exists tasks_workflow_type_idx on public.tasks(workflow_type);
create index if not exists tasks_report_work_date_idx on public.tasks(report_work_date);
create index if not exists tasks_report_category_idx on public.tasks(report_category);

create table if not exists public.task_quick_report_idempotency (
  actor_id uuid not null references public.staff_users(id),
  request_id uuid not null,
  request_hash text not null check (length(btrim(request_hash)) > 0),
  task_ids uuid[] not null default '{}'::uuid[],
  task_count integer not null check (task_count between 1 and 50),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (actor_id, request_id),
  constraint task_quick_report_idempotency_completion_check check (
    (completed_at is null and cardinality(task_ids) = 0)
    or (completed_at is not null and cardinality(task_ids) = task_count)
  )
);

insert into public.permissions(code,name,module,description)
values (
  'task.quick_report.create',
  'Báo cáo việc phát sinh',
  'task',
  'Tạo công việc REPORT_ONLY cho chính người báo cáo.'
)
on conflict (code) do update set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description,
  updated_at = now();

insert into public.role_permission_grants(role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.code = 'task.quick_report.create'
where r.code = 'admin'
on conflict (role_id, permission_id, scope) do nothing;

create or replace function public.api_create_quick_report_v1(
  p_actor_id uuid,
  p_request_id uuid,
  p_rows jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_actor public.staff_users;
  v_hash text;
  v_existing public.task_quick_report_idempotency;
  v_row record;
  v_task public.tasks;
  v_ids uuid[] := '{}'::uuid[];
  v_tasks jsonb := '[]'::jsonb;
  v_count integer;
  v_index integer := 0;
  v_replayed boolean := false;
  v_completed_at timestamptz;
  v_started timestamptz;
  v_completed timestamptz;
begin
  if p_actor_id is null or p_request_id is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 50 then
    raise exception 'Invalid quick report batch.' using errcode='22023';
  end if;

  select * into v_actor from public.staff_users where id=p_actor_id and active=true;
  if not found then raise exception 'Invalid quick report actor.' using errcode='42501'; end if;
  if not exists (
    select 1
    from public.staff_users u
    join public.roles r on r.id=u.role_id and r.active=true
    join public.role_permission_grants g on g.role_id=r.id and g.scope in ('self','all')
    join public.permissions p on p.id=g.permission_id and p.code='task.quick_report.create'
    where u.id=p_actor_id and u.active=true
  ) then
    raise exception 'Quick report permission denied.' using errcode='42501';
  end if;

  v_count := jsonb_array_length(p_rows);
  v_hash := md5(p_rows::text);
  select * into v_existing
  from public.task_quick_report_idempotency
  where actor_id=p_actor_id and request_id=p_request_id
  for update;
  if found then
    if v_existing.request_hash <> v_hash then
      raise exception 'Quick report request id reused with different payload.' using errcode='23505';
    end if;
    if v_existing.completed_at is not null then
      v_replayed := true;
      select coalesce(jsonb_agg(jsonb_build_object('ordinal',x.ordinal,'id',x.id,'title',t.title) order by x.ordinal),'[]'::jsonb)
      into v_tasks
      from unnest(v_existing.task_ids) with ordinality as x(id,ordinal)
      join public.tasks t on t.id=x.id;
      return jsonb_build_object('batchId',p_request_id,'tasks',v_tasks,'count',v_existing.task_count,'replayed',true);
    end if;
    raise exception 'Quick report request is already in progress.' using errcode='40001';
  end if;

  insert into public.task_quick_report_idempotency(actor_id,request_id,request_hash,task_count)
  values(p_actor_id,p_request_id,v_hash,v_count);

  for v_row in
    select * from jsonb_to_recordset(p_rows) as x(
      title text,
      category text,
      work_date date,
      started_time text,
      completed_time text,
      status text,
      notes text
    )
  loop
    v_index := v_index + 1;
    if nullif(btrim(v_row.title),'') is null or length(v_row.title) > 500
       or v_row.category not in ('computer','network','printer_device','facilities','official_document','administration','other')
       or v_row.work_date is null
       or v_row.started_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or v_row.status not in ('in_progress','done')
       or (v_row.completed_time is not null and v_row.completed_time <> '' and v_row.completed_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
       or (v_row.status='done' and nullif(v_row.completed_time,'') is null)
       or (nullif(v_row.completed_time,'') is not null and v_row.completed_time < v_row.started_time)
       or length(coalesce(v_row.notes,'')) > 10000 then
      raise exception 'Invalid quick report row %.', v_index using errcode='22023';
    end if;

    v_started := (v_row.work_date + v_row.started_time::time) at time zone 'Asia/Ho_Chi_Minh';
    v_completed := case when nullif(v_row.completed_time,'') is null then null else (v_row.work_date + v_row.completed_time::time) at time zone 'Asia/Ho_Chi_Minh' end;
    insert into public.tasks(
      title,description,status,progress_percent,assignee_id,owner_id,reviewer_id,
      assignment_mode,created_by,department_id,due_date,due_time,plan_period,self_claimable,
      task_type,start_date,approval_required,workflow_type,report_category,report_work_date,
      report_started_time,report_completed_time,report_notes,completed_at,completion_submitted_at
    ) values (
      btrim(v_row.title),nullif(btrim(v_row.notes),''),v_row.status,
      case when v_row.status='done' then 100 else 0 end,p_actor_id,p_actor_id,null,
      'individual',p_actor_id,v_actor.department_id,v_row.work_date,
      coalesce(nullif(v_row.completed_time,'')::time,v_row.started_time::time),'ad_hoc',false,
      'personal',v_row.work_date,false,'REPORT_ONLY',v_row.category,v_row.work_date,
      v_row.started_time::time,nullif(v_row.completed_time,'')::time,nullif(btrim(v_row.notes),''),
      v_completed,v_completed
    ) returning * into v_task;
    insert into public.task_assignees(task_id,user_id,assignment_role,status)
    values(v_task.id,p_actor_id,'owner',case when v_row.status='done' then 'done' else 'in_progress' end);
    insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
    values(v_task.id,null,v_row.status,'REPORT_ONLY',p_actor_id);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor_id,'task','tasks',v_task.id,'create_quick_report',jsonb_build_object(
      'workflow_type','REPORT_ONLY','report_category',v_row.category,'report_work_date',v_row.work_date,
      'report_started_time',v_row.started_time,'report_completed_time',nullif(v_row.completed_time,''),
      'status',v_row.status,'owner_id',p_actor_id,'assignee_id',p_actor_id));
    v_ids := array_append(v_ids,v_task.id);
    v_tasks := v_tasks || jsonb_build_array(jsonb_build_object('ordinal',v_index,'id',v_task.id,'title',v_task.title));
  end loop;

  v_completed_at := now();
  update public.task_quick_report_idempotency
  set task_ids=v_ids,completed_at=v_completed_at
  where actor_id=p_actor_id and request_id=p_request_id;
  return jsonb_build_object('batchId',p_request_id,'tasks',v_tasks,'count',v_count,'replayed',false);
end
$function$;

revoke all on function public.api_create_quick_report_v1(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.api_create_quick_report_v1(uuid,uuid,jsonb) to service_role;
alter function public.api_create_quick_report_v1(uuid,uuid,jsonb) owner to postgres;

notify pgrst,'reload schema';
commit;
