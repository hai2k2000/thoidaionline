\set ON_ERROR_STOP on
-- Disposable restored database only. The runner owns and removes this database.
create temp table progress_function_before as select oid,proacl,proowner,prosecdef,proconfig,pg_get_functiondef(oid) definition from pg_proc where oid='public.api_submit_task_progress_report(uuid,uuid,date,text,text,text)'::regprocedure;
\ir ../migrations/20261113100000_progress_report_after_done.sql
\ir ../../scripts/production/progress-after-done-post.sql
create temp table progress_function_applied as select oid,proacl,proowner,prosecdef,proconfig,pg_get_functiondef(oid) definition from pg_proc where oid='public.api_submit_task_progress_report(uuid,uuid,date,text,text,text)'::regprocedure;
\ir ../migrations/20261113100000_progress_report_after_done.sql
do $$ begin
  if exists(select * from progress_function_applied except select oid,proacl,proowner,prosecdef,proconfig,pg_get_functiondef(oid) definition from pg_proc where oid='public.api_submit_task_progress_report(uuid,uuid,date,text,text,text)'::regprocedure)
    or exists(select oid,proacl,proowner,prosecdef,proconfig,pg_get_functiondef(oid) definition from pg_proc where oid='public.api_submit_task_progress_report(uuid,uuid,date,text,text,text)'::regprocedure except select * from progress_function_applied) then
    raise exception 'Reapply was not idempotent';
  end if;
end $$;
\ir ../../scripts/production/progress-after-done-revert.sql
do $$ begin
  if exists(select * from progress_function_before except select oid,proacl,proowner,prosecdef,proconfig,pg_get_functiondef(oid) definition from pg_proc where oid='public.api_submit_task_progress_report(uuid,uuid,date,text,text,text)'::regprocedure)
    or exists(select oid,proacl,proowner,prosecdef,proconfig,pg_get_functiondef(oid) definition from pg_proc where oid='public.api_submit_task_progress_report(uuid,uuid,date,text,text,text)'::regprocedure except select * from progress_function_before) then
    raise exception 'Revert did not restore the original function and ACL';
  end if;
end $$;
\ir ../migrations/20261113100000_progress_report_after_done.sql
\ir ../../scripts/production/progress-after-done-post.sql
begin;
create function pg_temp.expect_state(p_sql text,p_state text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then if sqlstate=p_state then return; end if; raise; end;
  raise exception 'Expected SQLSTATE %',p_state;
end $$;
do $$
declare
  suffix text:=replace(gen_random_uuid()::text,'-','');
  dept uuid; fixture_manager_id uuid; owner_id uuid; collaborator_id uuid; watcher_id uuid; project_id uuid; target_project uuid;
  t public.tasks; before_task jsonb; after_task jsonb; report public.task_progress_reports;
  task_status text; fixture_report_status text; report_actor uuid; events_before bigint; reports_before bigint; expected_status text;
begin
  insert into public.departments(code,name,active) values('zz_progress_'||suffix,'Progress fixture',true) returning id into dept;
  insert into public.staff_users(full_name,username,password,role_id,department_id,job_title_id,active)
    values('Progress manager','zz_progress_manager_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept,(select id from public.job_titles where code='truong_phong' and active),true) returning id into fixture_manager_id;
  if not exists(select 1 from public.departments d where d.id=dept and d.manager_id=fixture_manager_id) then raise exception 'Fixture manager prerequisite missing'; end if;
  insert into public.staff_users(full_name,username,password,role_id,department_id,active)
    values('Progress owner','zz_progress_owner_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept,true) returning id into owner_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id,active)
    values('Progress collaborator','zz_progress_collab_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept,true) returning id into collaborator_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id,active)
    values('Progress watcher','zz_progress_watcher_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept,true) returning id into watcher_id;
  insert into public.projects(code,name,host_department_id,created_by) values('ZZ-PROGRESS-'||suffix,'Progress fixture',dept,fixture_manager_id) returning id into project_id;
  insert into public.project_members(project_id,user_id,role,added_by) values(project_id,fixture_manager_id,'lead',fixture_manager_id);
  foreach target_project in array array[null::uuid,project_id] loop
    foreach task_status in array array['done','pending_review','cancelled','in_progress'] loop
      insert into public.tasks(title,task_type,task_category,plan_period,department_id,project_id,owner_id,assignee_id,reviewer_id,created_by,status,completed_at,completion_submitted_at,progress_percent)
        values('Progress fixture','assigned','regular','ad_hoc',dept,target_project,owner_id,owner_id,fixture_manager_id,fixture_manager_id,task_status,
          case when task_status='done' then timestamptz '2026-11-10 08:00:00+07' else null end,
          case when task_status in ('done','pending_review') then timestamptz '2026-11-09 08:00:00+07' else null end,
          case when task_status='done' then 100 else 50 end) returning * into t;
      insert into public.task_assignees(task_id,user_id,assignment_role,status)
        values(t.id,owner_id,'owner','todo'),(t.id,collaborator_id,'assignee','todo'),(t.id,watcher_id,'watcher','todo') on conflict(task_id,user_id) do nothing;
      set constraints all immediate;
      select to_jsonb(x)-'updated_at' into before_task from public.tasks x where id=t.id;
      select count(*) into events_before from public.task_status_events where task_id=t.id;
      select count(*) into reports_before from public.task_progress_reports where task_id=t.id;
      perform pg_temp.expect_state(format('select public.api_submit_task_progress_report(%L,%L,current_date,%L,%L,null)',watcher_id,t.id,'in_progress','Watcher denied'),'42501');
      foreach report_actor in array array[owner_id,collaborator_id] loop
        if task_status='cancelled' then
          perform pg_temp.expect_state(format('select public.api_submit_task_progress_report(%L,%L,current_date,%L,%L,null)',report_actor,t.id,'in_progress','Cancelled denied'),'22023');
        else
          foreach fixture_report_status in array array['in_progress','blocked','waiting','nearly_done'] loop
            report:=public.api_submit_task_progress_report(report_actor,t.id,current_date,fixture_report_status,'Result fixture','Blocker fixture');
            if not exists(select 1 from public.task_progress_reports r where r.id=report.id and r.task_id=t.id and r.reported_by=report_actor and r.progress_text='Result fixture' and r.report_status=fixture_report_status) then raise exception 'Report row missing'; end if;
            if not exists(select 1 from public.audit_logs where entity_id=report.id and actor_id=report_actor and action='submit') then raise exception 'Report audit missing'; end if;
            if task_status in ('done','pending_review') then
              select to_jsonb(x)-'updated_at' into after_task from public.tasks x where id=t.id;
              if before_task is distinct from after_task then raise exception 'Task status or completion data changed'; end if;
              if (select count(*) from public.task_status_events where task_id=t.id)<>events_before then raise exception 'Terminal report created a status event'; end if;
            else
              expected_status:=case when fixture_report_status in ('blocked','waiting') then fixture_report_status else 'in_progress' end;
              if (select status from public.tasks where id=t.id)<>expected_status then raise exception 'Active progress transition changed'; end if;
            end if;
          end loop;
        end if;
      end loop;
      if (select count(*) from public.task_progress_reports where task_id=t.id)<>(reports_before+(case when task_status='cancelled' then 0 else 8 end)) then raise exception 'Unexpected report count'; end if;
      if task_status='cancelled' and before_task is distinct from (select to_jsonb(x)-'updated_at' from public.tasks x where id=t.id) then raise exception 'Cancelled task changed'; end if;
    end loop;
  end loop;
end $$;
rollback;
select 'PROGRESS_AFTER_DONE_BEHAVIOUR=PASS';
