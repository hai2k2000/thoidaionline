begin;

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
  v_ids uuid[] := '{}';
  v_tasks jsonb := '[]'::jsonb;
  v_count integer;
  v_index integer := 0;
  v_completed_at timestamptz;
  v_completed_date date;
begin
  if p_actor_id is null or p_request_id is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 50 then
    raise exception 'Invalid quick report batch.' using errcode='22023';
  end if;
  select * into v_actor from public.staff_users where id=p_actor_id and active=true;
  if not found then raise exception 'Invalid quick report actor.' using errcode='42501'; end if;
  if not exists (
    select 1 from public.staff_users u join public.roles r on r.id=u.role_id and r.active=true
    join public.role_permission_grants g on g.role_id=r.id and g.scope in ('self','all')
    join public.permissions p on p.id=g.permission_id and p.code='task.quick_report.create'
    where u.id=p_actor_id and u.active=true
    union all
    select 1 from public.staff_users u join public.user_permission_grants g on g.user_id=u.id and g.scope in ('self','all')
    join public.permissions p on p.id=g.permission_id and p.code='task.quick_report.create'
    where u.id=p_actor_id and u.active=true
  ) then raise exception 'Quick report permission denied.' using errcode='42501'; end if;
  v_count := jsonb_array_length(p_rows);
  v_hash := md5(p_rows::text);
  select * into v_existing from public.task_quick_report_idempotency where actor_id=p_actor_id and request_id=p_request_id for update;
  if found then
    if v_existing.request_hash <> v_hash then raise exception 'Quick report request id reused with different payload.' using errcode='23505'; end if;
    if v_existing.completed_at is not null then
      select coalesce(jsonb_agg(jsonb_build_object('ordinal',x.ordinal,'id',x.id,'title',t.title) order by x.ordinal),'[]'::jsonb)
      into v_tasks from unnest(v_existing.task_ids) with ordinality as x(id,ordinal) join public.tasks t on t.id=x.id;
      return jsonb_build_object('batchId',p_request_id,'tasks',v_tasks,'count',v_existing.task_count,'replayed',true);
    end if;
    raise exception 'Quick report request is already in progress.' using errcode='40001';
  end if;
  insert into public.task_quick_report_idempotency(actor_id,request_id,request_hash,task_count) values(p_actor_id,p_request_id,v_hash,v_count);
  for v_row in select * from jsonb_to_recordset(p_rows) as x(title text,category text,start_date date,completion_date date,status text,notes text) loop
    v_index := v_index + 1;
    if nullif(btrim(v_row.title),'') is null or length(v_row.title) > 500
       or v_row.category not in ('computer','network','printer_device','facilities','official_document','administration','other')
       or v_row.start_date is null or (v_row.completion_date is not null and v_row.completion_date < v_row.start_date)
       or v_row.status not in ('in_progress','done') or (v_row.status='done' and v_row.completion_date is null)
       or length(coalesce(v_row.notes,'')) > 10000 then
      raise exception 'Invalid quick report row %.', v_index using errcode='22023';
    end if;
    v_completed_date := v_row.completion_date;
    insert into public.tasks(title,description,status,progress_percent,assignee_id,owner_id,reviewer_id,assignment_mode,created_by,department_id,due_date,due_time,plan_period,self_claimable,task_type,start_date,approval_required,workflow_type,report_category,report_work_date,report_started_time,report_completed_time,report_notes,completed_at,completion_submitted_at)
    values (btrim(v_row.title),nullif(btrim(v_row.notes),''),v_row.status,case when v_row.status='done' then 100 else 0 end,p_actor_id,p_actor_id,null,'individual',p_actor_id,v_actor.department_id,v_row.start_date,'00:00','ad_hoc',false,'personal',v_row.start_date,false,'REPORT_ONLY',v_row.category,v_row.start_date,'00:00',case when v_row.completion_date is null then null else '00:00'::time end,nullif(btrim(v_row.notes),''),case when v_completed_date is null then null else (v_completed_date + time '00:00') at time zone 'Asia/Ho_Chi_Minh' end,case when v_completed_date is null then null else (v_completed_date + time '00:00') at time zone 'Asia/Ho_Chi_Minh' end) returning * into v_task;
    insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v_task.id,p_actor_id,'owner',case when v_row.status='done' then 'done' else 'in_progress' end);
    insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(v_task.id,null,v_row.status,'REPORT_ONLY',p_actor_id);
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'task','tasks',v_task.id,'create_quick_report',jsonb_build_object('workflow_type','REPORT_ONLY','report_category',v_row.category,'report_work_date',v_row.start_date,'report_completed_date',v_row.completion_date,'status',v_row.status,'owner_id',p_actor_id,'assignee_id',p_actor_id));
    v_ids := array_append(v_ids,v_task.id);
    v_tasks := v_tasks || jsonb_build_array(jsonb_build_object('ordinal',v_index,'id',v_task.id,'title',v_task.title));
  end loop;
  v_completed_at := now();
  update public.task_quick_report_idempotency set task_ids=v_ids,completed_at=v_completed_at where actor_id=p_actor_id and request_id=p_request_id;
  return jsonb_build_object('batchId',p_request_id,'tasks',v_tasks,'count',v_count,'replayed',false);
end
$function$;

revoke all on function public.api_create_quick_report_v1(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.api_create_quick_report_v1(uuid,uuid,jsonb) to service_role;
alter function public.api_create_quick_report_v1(uuid,uuid,jsonb) owner to postgres;
notify pgrst,'reload schema';
commit;
