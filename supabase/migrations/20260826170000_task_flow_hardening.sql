begin;

-- TBT is the highest task-assignment role below Admin.
update public.role_permissions rp
set can_assign_task=true, can_view_department_tasks=true, updated_at=now()
from public.roles r
where r.id=rp.role_id and lower(r.code)='tong_bien_tap';

create or replace function public.reject_system_admin_task_participant()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  if exists (
    select 1 from public.staff_users u
    join public.roles r on r.id=u.role_id
    where u.id=new.user_id and lower(r.code)='admin'
  ) then
    raise exception 'Admin cannot be an assignment participant.' using errcode='42501';
  end if;
  return new;
end
$function$;
drop trigger if exists reject_system_admin_task_participant on public.task_assignees;
create trigger reject_system_admin_task_participant
before insert or update of user_id on public.task_assignees
for each row execute function public.reject_system_admin_task_participant();

revoke all on function public.api_approve_task_claim(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.api_approve_task_claim(uuid,uuid,text,text) to service_role;
alter function public.api_approve_task_claim(uuid,uuid,text,text) owner to postgres;

create or replace function public.api_approve_task_claim(
  p_actor_id uuid,p_task_id uuid,p_decision text,p_reason text default null
) returns public.tasks language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v public.tasks; v_allowed boolean; v_status text;
begin
  select * into v from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Không tìm thấy công việc.' using errcode='P0002'; end if;
  select (p_actor_id=v.reviewer_id or exists(
    select 1 from public.staff_users u join public.roles r on r.id=u.role_id
    where u.id=p_actor_id and u.active=true and r.code='admin'
  )) into v_allowed;
  if not coalesce(v_allowed,false) then raise exception 'Không có quyền duyệt nhận việc.' using errcode='42501'; end if;
  if v.status<>'waiting' then raise exception 'Công việc không ở trạng thái chờ duyệt nhận việc.' using errcode='22023'; end if;
  if p_decision not in ('approve','reject') or (p_decision='reject' and nullif(btrim(p_reason),'') is null) then raise exception 'Quyết định hoặc lý do không hợp lệ.' using errcode='22023'; end if;
  v_status:=case when p_decision='approve' then 'in_progress' else 'rejected' end;
  update public.tasks set status=v_status,updated_at=now() where id=p_task_id returning * into v;
  insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id) values(p_task_id,'waiting',v_status,nullif(btrim(p_reason),''),p_actor_id);
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor_id,'task','tasks',p_task_id,case when p_decision='approve' then 'approve_claim' else 'reject_claim' end,
    jsonb_build_object('status','waiting'),jsonb_build_object('status',v_status,'reason',nullif(btrim(p_reason),'')));
  return v;
end
$function$;

commit;
