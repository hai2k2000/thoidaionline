-- Projects V1: isolated project membership and project-scoped task assignment.
begin;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (btrim(code) <> '' and length(code) <= 100),
  name text not null check (btrim(name) <> '' and length(name) <= 250),
  description text,
  status text not null default 'active' check (status in ('active','closed')),
  host_department_id uuid not null references public.departments(id),
  created_by uuid not null references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.staff_users(id),
  role text not null default 'member' check (role in ('lead','member')),
  added_by uuid not null references public.staff_users(id),
  added_at timestamptz not null default now(),
  primary key (project_id,user_id)
);
alter table public.tasks add column if not exists project_id uuid references public.projects(id);
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_project_members_user on public.project_members(user_id,project_id);
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
drop policy if exists projects_no_direct_access on public.projects;
drop policy if exists project_members_no_direct_access on public.project_members;
revoke all on table public.projects,public.project_members from public,anon,authenticated;
grant all on table public.projects,public.project_members to service_role;
create policy projects_no_direct_access on public.projects for all to anon,authenticated using (false) with check (false);
create policy project_members_no_direct_access on public.project_members for all to anon,authenticated using (false) with check (false);

insert into public.permissions(code,name,module,description) values
 ('project.create','Táº¡o dá»± Ã¡n','projects','Táº¡o khÃ´ng gian dá»± Ã¡n') on conflict (code) do nothing;
insert into public.role_permission_grants(role_id,permission_id,scope)
select r.id,p.id,'all' from public.roles r cross join public.permissions p
where r.code in ('admin','tong_bien_tap') and p.code='project.create'
on conflict (role_id,permission_id,scope) do nothing;

create or replace function public.api_project_actor_can_create(p_actor uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.api_list_effective_permissions(p_actor) e where e.permission_code='project.create' and cardinality(e.effective_scopes)>0);
$$;
create or replace function public.api_project_is_lead(p_actor uuid,p_project uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project and m.user_id=p_actor and m.role='lead' and u.active);
$$;

create or replace function public.api_create_project(p_actor_id uuid,p_code text,p_name text,p_description text,p_host_department_id uuid,p_lead_ids uuid[] default '{}'::uuid[]) returns public.projects
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.projects; v_lead uuid;
begin
 if not public.api_project_actor_can_create(p_actor_id) then raise exception 'Project create forbidden.' using errcode='42501'; end if;
 if nullif(btrim(p_code),'') is null or nullif(btrim(p_name),'') is null or length(p_code)>100 or length(p_name)>250 or length(p_description)>10000 or not exists(select 1 from public.departments where id=p_host_department_id and active) or cardinality(coalesce(p_lead_ids,'{}'))=0 then raise exception 'Invalid project input.' using errcode='22023'; end if;
 if exists(select 1 from public.projects where code=btrim(p_code)) then raise exception 'Project code already exists.' using errcode='23505'; end if;
 if exists(select 1 from unnest(p_lead_ids) x where not exists(select 1 from public.staff_users u where u.id=x and u.active)) then raise exception 'Inactive project lead.' using errcode='22023'; end if;
 insert into public.projects(code,name,description,host_department_id,created_by) values(btrim(p_code),btrim(p_name),nullif(btrim(p_description),''),p_host_department_id,p_actor_id) returning * into v;
 foreach v_lead in array p_lead_ids loop insert into public.project_members(project_id,user_id,role,added_by) values(v.id,v_lead,'lead',p_actor_id) on conflict(project_id,user_id) do update set role='lead',added_by=excluded.added_by; end loop;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','projects',v.id,'create',jsonb_build_object('code',v.code,'lead_ids',p_lead_ids)); return v;
end $function$;

create or replace function public.api_update_project(p_actor_id uuid,p_project_id uuid,p_code text,p_name text,p_description text,p_host_department_id uuid) returns public.projects
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.projects;
begin
 perform 1 from public.projects where id=p_project_id for update;
 if not found then raise exception 'Project not found.' using errcode='P0002'; end if;
 if not public.api_project_is_lead(p_actor_id,p_project_id) then raise exception 'Project update forbidden.' using errcode='42501'; end if;
 if nullif(btrim(p_code),'') is null or nullif(btrim(p_name),'') is null or length(p_code)>100 or length(p_name)>250 or length(p_description)>10000 or not exists(select 1 from public.departments where id=p_host_department_id and active) then raise exception 'Invalid project input.' using errcode='22023'; end if;
 update public.projects set code=btrim(p_code),name=btrim(p_name),description=nullif(btrim(p_description),''),host_department_id=coalesce(p_host_department_id,host_department_id),updated_at=now() where id=p_project_id returning * into v;
 if not found then raise exception 'Project not found.' using errcode='P0002'; end if;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','projects',p_project_id,'update',to_jsonb(v)); return v;
end $function$;

create or replace function public.api_set_project_member(p_actor_id uuid,p_project_id uuid,p_user_id uuid,p_role text,p_remove boolean default false) returns public.project_members
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.project_members;
begin
 perform 1 from public.projects where id=p_project_id for update;
 if not found then raise exception 'Project not found.' using errcode='P0002'; end if;
 if not public.api_project_is_lead(p_actor_id,p_project_id) then raise exception 'Project membership forbidden.' using errcode='42501'; end if;
 if (p_remove or p_role is distinct from 'lead') then
   if exists(select 1 from public.project_members where project_id=p_project_id and user_id=p_user_id and role='lead') and (select count(*) from public.project_members where project_id=p_project_id and role='lead') <= 1 then raise exception 'Cannot remove the last project lead.' using errcode='23514'; end if;
 end if;
 if p_remove then
   delete from public.project_members where project_id=p_project_id and user_id=p_user_id;
   insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','project_members',p_project_id,'remove',jsonb_build_object('user_id',p_user_id)); return null;
 end if;
 if p_role is null or p_role not in ('lead','member') or not exists(select 1 from public.staff_users where id=p_user_id and active) then raise exception 'Invalid project member.' using errcode='22023'; end if;
 insert into public.project_members(project_id,user_id,role,added_by) values(p_project_id,p_user_id,p_role,p_actor_id) on conflict(project_id,user_id) do update set role=excluded.role,added_by=excluded.added_by returning * into v;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','project_members',p_project_id,'set_member',to_jsonb(v)); return v;
end $function$;

create or replace function public.api_close_project(p_actor_id uuid,p_project_id uuid) returns public.projects
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.projects;
begin
 perform 1 from public.projects where id=p_project_id for update;
 if not found then raise exception 'Project not found.' using errcode='P0002'; end if;
 if not public.api_project_is_lead(p_actor_id,p_project_id) then raise exception 'Project close forbidden.' using errcode='42501'; end if;
 update public.projects set status='closed',closed_at=coalesce(closed_at,now()),updated_at=now() where id=p_project_id returning * into v;
 if not found then raise exception 'Project not found.' using errcode='P0002'; end if;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','projects',p_project_id,'close',to_jsonb(v)); return v;
end $function$;


create or replace function public.enforce_assignee_manager_watcher()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_task_type text; v_task_category text; v_project_id uuid; v_department uuid; v_manager uuid;
begin
 select task_type,task_category,project_id into v_task_type,v_task_category,v_project_id from public.tasks where id=new.task_id;
 if v_project_id is not null or v_task_category='duty' or v_task_type is distinct from 'assigned' or new.assignment_role not in ('owner','assignee') then return new; end if;
 select department_id into v_department from public.staff_users where id=new.user_id and active=true;
 if v_department is null then raise exception 'Assigned participant requires an active department.' using errcode='22023'; end if;
 select d.manager_id into v_manager from public.departments d join public.staff_users manager on manager.id=d.manager_id and manager.active=true where d.id=v_department and d.active=true;
 if v_manager is null then raise exception 'Assignee department requires an active primary manager.' using errcode='22023'; end if;
 if v_manager<>new.user_id then insert into public.task_assignees(task_id,user_id,assignment_role,status) values(new.task_id,v_manager,'watcher','todo') on conflict(task_id,user_id) do nothing; end if;
 return new;
end $function$;
alter function public.enforce_assignee_manager_watcher() owner to postgres;

create or replace function public.api_assign_project_task(p_actor_id uuid,p_project_id uuid,p_title text,p_description text,p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,p_due_time time,p_evaluation_criteria text default null,p_collaborator_ids uuid[] default '{}'::uuid[],p_watcher_ids uuid[] default '{}'::uuid[],p_priority text default 'normal',p_attachment_url text default null) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.tasks; x uuid; v_host uuid; v_status text;
begin
 select status,host_department_id into v_status,v_host from public.projects where id=p_project_id for update;
 if not found or v_status<>'active' then raise exception 'Project is closed or missing.' using errcode='42501'; end if;
 if not public.api_project_is_lead(p_actor_id,p_project_id) then raise exception 'Only project leads may assign.' using errcode='42501'; end if;
 p_reviewer_id := coalesce(p_reviewer_id,p_actor_id);
 if nullif(btrim(p_title),'') is null or nullif(btrim(p_description),'') is null or length(p_title)>500 or length(p_description)>10000 or length(p_evaluation_criteria)>10000 or length(p_attachment_url)>2048 or p_due_date is null or p_due_time is null or p_priority is null or p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid assignment input.' using errcode='22023'; end if;
 if not exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project_id and m.user_id=p_assignee_id and u.active) then raise exception 'Assignee must be an active project member.' using errcode='22023'; end if;
 if not public.api_project_is_lead(p_reviewer_id,p_project_id) then raise exception 'Reviewer must be a project lead.' using errcode='22023'; end if;
 if exists(select 1 from unnest(coalesce(p_collaborator_ids,'{}') || coalesce(p_watcher_ids,'{}')) candidate(id) where not exists(select 1 from public.project_members m join public.staff_users u on u.id=m.user_id where m.project_id=p_project_id and m.user_id=candidate.id and u.active)) then raise exception 'All project participants must be active members.' using errcode='22023'; end if;
 insert into public.tasks(title,description,project_id,department_id,assignee_id,owner_id,reviewer_id,created_by,assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,task_type,priority,attachment_url,evaluation_criteria,start_date) values(btrim(p_title),btrim(p_description),p_project_id,v_host,p_assignee_id,p_assignee_id,p_reviewer_id,p_actor_id,case when cardinality(coalesce(p_collaborator_ids,'{}'))>0 then 'multi_user' else 'individual' end,p_due_date,p_due_time,'new',0,'ad_hoc',false,'assigned',p_priority,p_attachment_url,nullif(btrim(p_evaluation_criteria),''),timezone('Asia/Ho_Chi_Minh',now())::date) returning * into v;
 insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v.id,p_assignee_id,'owner','todo');
 foreach x in array coalesce(p_collaborator_ids,'{}') loop if x<>p_assignee_id then insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v.id,x,'assignee','todo') on conflict do nothing; end if; end loop;
 foreach x in array coalesce(p_watcher_ids,'{}') loop if x<>p_assignee_id and not (x=any(coalesce(p_collaborator_ids,'{}'))) then insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v.id,x,'watcher','todo') on conflict do nothing; end if; end loop;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','tasks',v.id,'assign',jsonb_build_object('project_id',p_project_id)); return v;
end $function$;


create or replace function public.review_task_completion(
  p_actor_id uuid,
  p_task_id uuid,
  p_decision text,
  p_note text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks;
  v_role_code text;
  v_allowed boolean;
begin
  select * into v_task from public.tasks where id=p_task_id for update;
  if v_task.project_id is not null then
    perform public.api_assert_task_action(p_actor_id,p_task_id,'review');
    if p_decision is null or p_decision not in ('approve','reject') then raise exception 'Invalid completion review.' using errcode='22023'; end if;
    return public.api_review_assigned_task_completion(p_actor_id,p_task_id,case when p_decision='reject' then 'return' else p_decision end,p_note);
  end if;
  select r.code into v_role_code from public.staff_users u join public.roles r on r.id = u.role_id where u.id = p_actor_id and u.active;
  if v_role_code is null or v_role_code in ('tong_bien_tap', 'tbt_read_only') then
    raise exception 'Tài khoản chỉ được xem, không được duyệt.' using errcode = '42501';
  end if;
  if p_decision not in ('approve','reject') then raise exception 'Quyết định duyệt không hợp lệ.' using errcode = '22023'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Không tìm thấy công việc.' using errcode = 'P0002'; end if;
  select v_role_code = 'admin' or v_task.created_by = p_actor_id or (
      v_task.reviewer_id = p_actor_id and v_role_code in ('pho_tong_bien_tap','phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap')
    ) into v_allowed;
  if not v_allowed then raise exception 'Chỉ người nhận báo cáo, người tạo hoặc admin mới được duyệt.' using errcode = '42501'; end if;
  if v_task.status <> 'pending_review' then raise exception 'Công việc chưa ở trạng thái chờ duyệt.' using errcode = '22023'; end if;
  update public.tasks set status = case when p_decision = 'approve' then 'done' else 'rejected' end,
      progress_percent = case when p_decision = 'approve' then 100 else progress_percent end,
      updated_at = now()
   where id = p_task_id returning * into v_task;
  insert into public.task_comments(task_id,user_id,content) values (
    p_task_id,p_actor_id,
    case when p_decision = 'approve' then '✅ Đã phê duyệt hoàn thành.' else '↩️ Đã trả lại để bổ sung.' end
      || case when nullif(btrim(coalesce(p_note, '')), '') is null then '' else E'\n' || btrim(p_note) end
  );
  return v_task;
end;
$$;

create or replace function public.api_assert_task_action(p_actor_id uuid, p_task_id uuid, p_action text)
returns void language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_role_code text; v_job_title_code text; v_department_id uuid;
  v_can_assign boolean; v_can_view_department boolean; v_can_step1 boolean;
  v_can_comment boolean; v_task public.tasks; v_allowed boolean := false;
begin
  select r.code,jt.code,u.department_id,coalesce(rp.can_assign_task,false),
    coalesce(rp.can_view_department_tasks,false),coalesce(rp.can_evaluate_step1,false),
    coalesce(rp.can_comment,false)
  into v_role_code,v_job_title_code,v_department_id,v_can_assign,
    v_can_view_department,v_can_step1,v_can_comment
  from public.staff_users u join public.roles r on r.id=u.role_id
  left join public.job_titles jt on jt.id=u.job_title_id
  left join public.role_permissions rp on rp.role_id=r.id
  where u.id=p_actor_id and u.active=true;
  if v_role_code is null then raise exception 'Invalid actor.' using errcode='42501'; end if;
  if v_role_code='tbt_read_only'
     or (v_role_code='tong_bien_tap' and p_action not in ('assign','comment','review')) then
    raise exception 'Task operation is read-only for this role.' using errcode='42501';
  end if;
  if p_action in ('assign','bulk') then
    if not v_can_assign then raise exception 'Assignment permission required.' using errcode='42501'; end if;
    return;
  end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if v_task.project_id is not null and p_action in ('review','comment') then
    if p_action='review' then
      v_allowed := public.api_project_is_lead(p_actor_id,v_task.project_id);
    else
      v_allowed := exists(select 1 from public.project_members where project_id=v_task.project_id and user_id=p_actor_id);
      if not v_allowed then
        -- Nonmembers retain their existing comment access.
        v_allowed := v_can_comment and (v_role_code in ('admin','tong_bien_tap')
          or v_task.created_by=p_actor_id or v_task.owner_id=p_actor_id
          or v_task.assignee_id=p_actor_id or v_task.reviewer_id=p_actor_id
          or exists(select 1 from public.task_assignees where task_id=p_task_id and user_id=p_actor_id)
          or (v_can_view_department and v_task.department_id=v_department_id));
      end if;
    end if;
    if not coalesce(v_allowed,false) then raise exception 'Task action forbidden.' using errcode='42501'; end if;
    return;
  end if;
  case p_action
    when 'update' then
      v_allowed := v_role_code='admin' or v_task.created_by=p_actor_id
        or (v_can_assign and v_task.department_id=v_department_id);
    when 'claim' then
      v_allowed := v_task.task_type='assigned' and v_task.self_claimable
        and v_task.status='new' and v_task.assignee_id is null;
    when 'complete_assigned' then
      v_allowed := v_task.task_type='assigned' and v_task.assignee_id=p_actor_id
        and v_task.status in ('in_progress','blocked','rejected');
    when 'report' then
      v_allowed := v_role_code='admin' or v_task.owner_id=p_actor_id
        or v_task.assignee_id=p_actor_id or exists(
          select 1 from public.task_assignees ta where ta.task_id=p_task_id
            and ta.user_id=p_actor_id and ta.assignment_role<>'watcher');
    when 'review' then
      v_allowed := v_role_code='admin' or (v_task.reviewer_id=p_actor_id and (
        v_role_code in ('tong_bien_tap','pho_tong_bien_tap','truong_phong','pho_truong_phong',
          'phu_trach_phong_bien_tap','phu_trach_phong_phong_vien','phu_trach_phong_tri_su')
        or v_job_title_code in ('tong_bien_tap','pho_tong_bien_tap','truong_phong','pho_truong_phong')
        or exists(select 1 from public.departments d where d.id=v_task.department_id and d.manager_id=p_actor_id)));
    when 'comment' then
      v_allowed := v_can_comment and (v_role_code in ('admin','tong_bien_tap')
        or v_task.created_by=p_actor_id or v_task.owner_id=p_actor_id
        or v_task.assignee_id=p_actor_id or v_task.reviewer_id=p_actor_id
        or exists(select 1 from public.task_assignees ta where ta.task_id=p_task_id and ta.user_id=p_actor_id)
        or (v_can_view_department and v_task.department_id=v_department_id));
    when 'legacy_evaluate' then
      v_allowed := v_role_code='admin' or (v_can_step1 and (v_task.created_by=p_actor_id or v_task.reviewer_id=p_actor_id));
    else raise exception 'Unknown task action.' using errcode='22023';
  end case;
  if not coalesce(v_allowed,false) then raise exception 'Task action forbidden.' using errcode='42501'; end if;
end
$function$;

do $$ declare f text; begin foreach f in array array['enforce_assignee_manager_watcher()','review_task_completion(uuid,uuid,text,text)','api_project_actor_can_create(uuid)','api_project_is_lead(uuid,uuid)','api_assert_task_action(uuid,uuid,text)','api_create_project(uuid,text,text,text,uuid,uuid[])','api_update_project(uuid,uuid,text,text,text,uuid)','api_set_project_member(uuid,uuid,uuid,text,boolean)','api_close_project(uuid,uuid)','api_assign_project_task(uuid,uuid,text,text,uuid,uuid,date,time,text,uuid[],uuid[],text,text)'] loop execute format('revoke all on function public.%s from public,anon,authenticated',f); execute format('grant execute on function public.%s to service_role',f); execute format('alter function public.%s owner to postgres',f); end loop; end $$;
notify pgrst,'reload schema';
commit;
