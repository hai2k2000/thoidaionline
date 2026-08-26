create or replace function public.claim_task_plan(p_actor_id uuid, p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path=public
as $function$
declare v_task public.tasks; v_reviewer uuid; v_role text;
begin
 select r.code into v_role from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active;
 if v_role is null or v_role='tbt_read_only' then raise exception 'Tài khoản không được tự nhận kế hoạch.' using errcode='42501'; end if;
 select * into v_task from public.tasks where id=p_task_id and self_claimable=true and plan_period in ('daily','weekly') and status='new' and assignee_id is null for update;
 if not found then raise exception 'Kế hoạch không còn khả dụng để tự nhận.' using errcode='40001'; end if;
 select case when d.code='leadership' then (select u.id from public.staff_users u join public.roles r on r.id=u.role_id where r.code='tong_bien_tap' and u.active limit 1) else d.manager_id end into v_reviewer from public.departments d where d.id=v_task.department_id;
 update public.tasks set assignee_id=p_actor_id,owner_id=p_actor_id,reviewer_id=v_reviewer,status='waiting',updated_at=now() where id=p_task_id returning * into v_task;
 insert into public.task_assignees(task_id,user_id,assignment_role,status) values(p_task_id,p_actor_id,'owner','todo') on conflict(task_id,user_id) do update set assignment_role='owner',status='todo';
 return v_task;
end;
$function$;