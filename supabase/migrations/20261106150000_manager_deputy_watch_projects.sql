begin;

create or replace function public.department_watch_leaders(p_department uuid)
returns setof uuid language sql stable security definer set search_path=public,pg_temp as $function$
 select distinct u.id
 from public.departments d
 join public.staff_users u on u.active=true and (u.id=d.manager_id or u.department_id=d.id)
 left join public.roles r on r.id=u.role_id and r.active=true
 left join public.job_titles j on j.id=u.job_title_id and j.active=true
 where d.id=p_department and d.active=true
   and (u.id=d.manager_id or (u.department_id=d.id and
     (lower(r.code)='pho_truong_phong' or lower(j.code)='pho_truong_phong')));
$function$;
alter function public.department_watch_leaders(uuid) owner to postgres;
revoke all on function public.department_watch_leaders(uuid) from public,anon,authenticated;
grant execute on function public.department_watch_leaders(uuid) to service_role;

create or replace function public.enforce_assignee_manager_watcher()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_task_type text; v_task_category text; v_project_id uuid; v_department uuid; v_manager uuid;
begin
 select task_type,task_category,project_id into v_task_type,v_task_category,v_project_id from public.tasks where id=new.task_id;
 if v_task_category='duty' or v_task_type is distinct from 'assigned' or new.assignment_role not in ('owner','assignee') then return new; end if;
 select department_id into v_department from public.staff_users where id=new.user_id and active=true;
 if v_department is null then
   if v_project_id is not null or new.assignment_role='assignee' then return new; end if;
   raise exception 'Assigned participant requires an active department.' using errcode='22023';
 end if;
 select d.manager_id into v_manager from public.departments d join public.staff_users manager on manager.id=d.manager_id and manager.active=true where d.id=v_department and d.active=true;
 if v_manager is null and v_project_id is null and new.assignment_role='owner' then
   raise exception 'Assignee department requires an active primary manager.' using errcode='22023';
 end if;
 insert into public.task_assignees(task_id,user_id,assignment_role,status)
 select new.task_id,leader,'watcher','todo' from public.department_watch_leaders(v_department) leader
 where leader<>new.user_id on conflict(task_id,user_id) do nothing;
 return new;
end $function$;
alter function public.enforce_assignee_manager_watcher() owner to postgres;
revoke all on function public.enforce_assignee_manager_watcher() from public,anon,authenticated;
grant execute on function public.enforce_assignee_manager_watcher() to service_role;
notify pgrst,'reload schema';
commit;
