-- Disposable restored schema only; fixtures and assertions roll back.
begin;
create function pg_temp.expect_state(p_sql text,p_state text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlstate=p_state then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE %',p_state;
end $$;

do $$
declare
  suffix text:=replace(gen_random_uuid()::text,'-','');
  dept uuid; admin_id uuid; lead_id uuid; member_id uuid;
  project_id uuid; project_task_id uuid; normal_task_id uuid;
  current_status text; expected timestamptz; t public.tasks;
begin
  insert into public.departments(code,name)
  values('zz_admin_status_'||suffix,'Admin status fixture') returning id into dept;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Admin','zz_admin_status_admin_'||suffix,'test-only',(select id from public.roles where code='admin'),dept)
  returning id into admin_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Lead','zz_admin_status_lead_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept)
  returning id into lead_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Member','zz_admin_status_member_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept)
  returning id into member_id;
  update public.departments set manager_id=lead_id where id=dept;

  project_id := (public.api_create_project(admin_id,'ZZ-ADMIN-STATUS-'||suffix,'Admin status fixture',null,dept,array[lead_id])).id;
  perform public.api_set_project_member(admin_id,project_id,member_id,'member');
  project_task_id := (public.api_assign_project_task(lead_id,project_id,'Project status fixture','Original description',member_id,lead_id,current_date+1,'17:00','["original requirement"]')).id;

  -- Content, dates, priority and requirements edits succeed in every project state
  -- when the status select is unchanged.
  for current_status in select unnest(array['new','in_progress','pending_review','done','rejected']) loop
    update public.tasks
       set status=current_status,
           completion_submitted_at=case when current_status in ('pending_review','done') then coalesce(completion_submitted_at,now()) else completion_submitted_at end,
           updated_at=now()
     where id=project_task_id;
    select updated_at into expected from public.tasks where id=project_task_id;
    perform public.api_admin_edit_task(admin_id,project_task_id,'Project edit '||current_status,'Edited description',current_date,current_date+1,'17:00','high',current_status,'["edited requirement"]','status unchanged',expected,true);
    select * into t from public.tasks where id=project_task_id;
    if t.status<>current_status or t.title<>'Project edit '||current_status or t.priority<>'high' or t.evaluation_criteria<>'["edited requirement"]' then
      raise exception 'project edit failed in state %',current_status;
    end if;
  end loop;

  -- V1.2 project completion has no score row, but a submitted pending_review task
  -- can be approved by an admin.
  update public.tasks set status='pending_review',completion_submitted_at=now(),updated_at=now() where id=project_task_id;
  select updated_at into expected from public.tasks where id=project_task_id;
  perform public.api_admin_edit_task(admin_id,project_task_id,'Project complete','Edited description',current_date,null,null,'normal','done',null,'approve project',expected,false);
  if (select status from public.tasks where id=project_task_id)<>'done' then raise exception 'project completion failed'; end if;

  -- A normal assigned task still requires a score for done.
  insert into public.tasks(title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,task_type,status,start_date,due_date,priority)
  values('Normal score fixture','Content',dept,member_id,member_id,lead_id,admin_id,'assigned','pending_review',current_date,current_date+1,'normal')
  returning id into normal_task_id;
  update public.tasks set completion_submitted_at=now(),updated_at=now() where id=normal_task_id;
  select updated_at into expected from public.tasks where id=normal_task_id;
  perform pg_temp.expect_state(format('select public.api_admin_edit_task(%L,%L,%L,%L,current_date,%L,%L,%L,''done'',null,%L,%L,false)',admin_id,normal_task_id,'Normal score fixture','Content',current_date+1,'17:00','normal','score required',expected),'22023');
end $$;
rollback;
