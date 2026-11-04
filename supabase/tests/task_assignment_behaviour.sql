begin;
set local timezone = 'Asia/Ho_Chi_Minh';
set local statement_timeout = '120s';
create function pg_temp.expect_state(p_sql text,p_state text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then
    if sqlstate=p_state then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE %',p_state;
end $$;

do $$
declare
  admin_id uuid; tbt_id uuid; manager_id uuid; member_id uuid; department_id uuid;
  nonleader_id uuid; inactive_id uuid; project_id uuid; lead_id uuid; project_member_id uuid; outsider_id uuid;
  t public.tasks; undated public.tasks; result jsonb; replay jsonb; cards jsonb;
  batch_id uuid := gen_random_uuid(); behalf_batch_id uuid := gen_random_uuid();
  deadline date := current_date + 7;
begin
  select u.id into admin_id from public.staff_users u join public.roles r on r.id=u.role_id
    where u.active and r.active and r.code='admin' order by u.id limit 1;
  select u.id into tbt_id from public.staff_users u join public.roles r on r.id=u.role_id
    where u.active and r.active and r.code='tong_bien_tap' order by u.id limit 1;
  select d.id,m.id,u.id into department_id,manager_id,member_id
    from public.departments d
    join public.staff_users m on m.id=d.manager_id and m.active
    join public.roles mr on mr.id=m.role_id and mr.active and mr.code<>'admin'
    left join public.job_titles jt on jt.id=m.job_title_id and jt.active
    join public.staff_users u on u.department_id=d.id and u.active and u.id<>m.id
    join public.roles ur on ur.id=u.role_id and ur.active
    where d.active and m.department_id=d.id
      and (mr.code='truong_phong' or jt.code='truong_phong')
    order by d.id,m.id,u.id limit 1;
  select u.id into nonleader_id from public.staff_users u
    join public.roles r on r.id=u.role_id and r.active
    left join public.job_titles jt on jt.id=u.job_title_id and jt.active
    where u.active and r.code not in ('admin','tong_bien_tap','pho_tong_bien_tap','truong_phong','pho_truong_phong',
      'phu_trach_phong_bien_tap','phu_trach_phong_phong_vien','phu_trach_phong_tri_su')
      and coalesce(jt.code,'') not in ('truong_phong','pho_truong_phong')
      and not exists(select 1 from public.departments d where d.manager_id=u.id and d.active)
    order by u.id limit 1;
  if admin_id is null or tbt_id is null or manager_id is null or member_id is null or nonleader_id is null then
    raise exception 'Required restored fixtures missing: active admin, TBT, department truong_phong/member, non-leader';
  end if;

  -- Normal assignment and date normalization.
  undated := public.api_assign_task_v2(manager_id,'Dryrun undated','Requirements',department_id,member_id,manager_id,null,time '09:00');
  if undated.due_date is not null or undated.due_time is not null or undated.entered_by is not null then
    raise exception 'Undated assignment normalization failed';
  end if;
  t := public.api_assign_task_v2(manager_id,'Dryrun dated','Requirements',department_id,member_id,manager_id,deadline,null);
  if t.due_date is distinct from deadline or t.due_time is distinct from time '17:00' then
    raise exception 'Default due_time failed';
  end if;
  perform pg_temp.expect_state(format(
    'select public.api_assign_task_v2(%L,''Dryrun recurrence'',''Requirements'',%L,%L,%L,null,null,p_recurrence_frequency=>''daily'')',
    manager_id,department_id,member_id,manager_id),'22023');

  cards := jsonb_build_array(
    jsonb_build_object('title','Dryrun batch undated','description','Requirements','due_date',null),
    jsonb_build_object('title','Dryrun batch dated','description','Requirements','due_date',deadline));
  result := public.api_assign_task_batch_v1(manager_id,batch_id,department_id,member_id,cards);
  if result->>'count' is distinct from '2' or result->>'replayed' is distinct from 'false'
    or (select count(*) from public.tasks where id in (select value::uuid from jsonb_array_elements_text(result->'task_ids')))<>2
    or not exists(select 1 from public.tasks where id=(result->'task_ids'->>0)::uuid and due_date is null and due_time is null)
    or not exists(select 1 from public.tasks where id=(result->'task_ids'->>1)::uuid and due_date=deadline and due_time=time '17:00') then
    raise exception 'Mixed deadline batch failed';
  end if;
  replay := public.api_assign_task_batch_v1(manager_id,batch_id,department_id,member_id,cards);
  if replay->>'replayed' is distinct from 'true' or replay->'task_ids' is distinct from result->'task_ids' then
    raise exception 'Batch replay failed';
  end if;

  perform public.api_change_assigned_task_deadline(manager_id,undated.id,deadline,'Dryrun first deadline');
  select * into t from public.tasks where id=undated.id;
  if t.due_date is distinct from deadline or t.due_time is distinct from time '17:00'
    or not exists(select 1 from public.task_deadline_history where task_id=t.id and old_due_date is null and new_due_date=deadline and changed_by=manager_id)
    or not exists(select 1 from public.audit_logs where entity_id=t.id and actor_id=manager_id and action='deadline_change') then
    raise exception 'First deadline/history/audit failed';
  end if;

  t := public.api_assign_task_v2(admin_id,'Dryrun on behalf','Requirements',department_id,manager_id,admin_id,null,null,p_on_behalf_of=>tbt_id);
  if t.created_by is distinct from tbt_id or t.reviewer_id is distinct from tbt_id or t.entered_by is distinct from admin_id
    or not exists(select 1 from public.audit_logs where entity_id=t.id and actor_id=admin_id and action='create' and new_data->>'entered_by'=admin_id::text) then
    raise exception 'On-behalf attribution/audit failed';
  end if;
  perform pg_temp.expect_state(format(
    'select public.api_assign_task_v2(%L,''Forbidden'',''Requirements'',%L,%L,%L,null,null,p_on_behalf_of=>%L)',
    manager_id,department_id,member_id,manager_id,tbt_id),'42501');
  perform pg_temp.expect_state(format(
    'select public.api_assign_task_v2(%L,''Forbidden'',''Requirements'',%L,%L,%L,null,null,p_on_behalf_of=>%L)',
    admin_id,department_id,member_id,manager_id,nonleader_id),'42501');
  -- Make the real leader temporarily inactive in a subtransaction, then undo it.
  inactive_id := tbt_id;
  begin
    update public.staff_users set active=false where id=inactive_id;
    perform pg_temp.expect_state(format(
      'select public.api_assign_task_v2(%L,''Forbidden'',''Requirements'',%L,%L,%L,null,null,p_on_behalf_of=>%L)',
      admin_id,department_id,member_id,manager_id,inactive_id),'42501');
    raise exception using errcode='Z0001', message='rollback inactive fixture';
  exception when sqlstate 'Z0001' then null;
  end;
  result := public.api_assign_task_batch_v1(admin_id,behalf_batch_id,department_id,manager_id,cards,tbt_id);
  if result->>'count' is distinct from '2'
    or (select count(*) from public.tasks where id in (select value::uuid from jsonb_array_elements_text(result->'task_ids'))
      and entered_by=admin_id and created_by=tbt_id and reviewer_id=tbt_id)<>2 then
    raise exception 'On-behalf batch attribution failed';
  end if;

  select p.id,l.user_id,m.user_id into project_id,lead_id,project_member_id
    from public.projects p
    join public.project_members l on l.project_id=p.id and l.role='lead'
    join public.staff_users lu on lu.id=l.user_id and lu.active
    join public.roles lr on lr.id=lu.role_id and lr.active and lr.code<>'admin'
    join public.project_members m on m.project_id=p.id and m.role='member' and m.user_id<>l.user_id
    join public.staff_users mu on mu.id=m.user_id and mu.active
    join public.roles mr on mr.id=mu.role_id and mr.active and mr.code<>'admin'
    where p.status='active' order by p.id,l.user_id,m.user_id limit 1;
  if project_id is null then
    raise notice 'SKIP project deadline scenario: no active project with non-admin lead and member';
  else
    outsider_id := project_member_id;
    t := public.api_assign_project_task(lead_id,project_id,'Dryrun project undated','Requirements',project_member_id,lead_id,null,null);
    if t.project_id is distinct from project_id or t.due_date is not null or t.due_time is not null then
      raise exception 'Undated project assignment failed';
    end if;
    perform pg_temp.expect_state(format('select public.api_change_assigned_task_deadline(%L,%L,%L,''Forbidden'')',outsider_id,t.id,deadline),'42501');
    perform public.api_change_assigned_task_deadline(lead_id,t.id,deadline,'Dryrun lead first deadline');
    select * into t from public.tasks where id=t.id;
    if t.due_date is distinct from deadline or t.due_time is distinct from time '17:00' then
      raise exception 'Project lead first deadline failed';
    end if;
  end if;
end $$;
rollback;
