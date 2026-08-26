create or replace function public.claim_task_plan(p_actor_id uuid, p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path=public
as 
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
end; ;
create or replace function public.review_task_completion(p_actor_id uuid,p_task_id uuid,p_decision text,p_note text default null) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as  declare v_task public.tasks; begin
 select * into v_task from public.tasks where id=p_task_id for update; if not found then raise exception 'Không tìm thấy công việc.' using errcode='P0002'; end if;
 if p_decision not in ('approve','reject') then raise exception 'Quyết định duyệt không hợp lệ.' using errcode='22023'; end if;
 if v_task.status='waiting' then update public.tasks set status=case when p_decision='approve' then 'in_progress' else 'rejected' end,updated_at=now() where id=p_task_id returning * into v_task; insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,'waiting',v_task.status,p_note,p_actor_id); insert into public.task_comments(task_id,user_id,content) values(p_task_id,p_actor_id,case when p_decision='approve' then 'Đã duyệt nhận việc.' else 'Đã trả lại yêu cầu nhận việc. Lý do: '||coalesce(p_note,'') end); return v_task; end if;
 return public.review_task_completion(p_actor_id,p_task_id,p_decision,p_note);
end; ;
