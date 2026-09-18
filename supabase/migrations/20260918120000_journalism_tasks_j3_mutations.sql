begin;

insert into public.permissions(code,name,module,description) values
  ('journalism.metadata.update','Cập nhật metadata báo chí','journalism','Cập nhật metadata Journalism theo Task scope.'),
  ('journalism.publication.manage','Quản lý xuất bản báo chí','journalism','Quản lý trạng thái xuất bản Journalism theo Task scope.')
on conflict (code) do nothing;

with approved(role_code,permission_code,scope) as (values
  ('admin','journalism.metadata.update','all'),
  ('tong_bien_tap','journalism.metadata.update','all'),
  ('pho_tong_bien_tap','journalism.metadata.update','all'),
  ('truong_phong','journalism.metadata.update','department'),
  ('pho_truong_phong','journalism.metadata.update','department'),
  ('phong_vien','journalism.metadata.update','assigned'),
  ('nhan_vien','journalism.metadata.update','assigned'),
  ('admin','journalism.publication.manage','all'),
  ('tong_bien_tap','journalism.publication.manage','all'),
  ('pho_tong_bien_tap','journalism.publication.manage','all'),
  ('truong_phong','journalism.publication.manage','department'),
  ('pho_truong_phong','journalism.publication.manage','department')
)
insert into public.role_permission_grants(role_id,permission_id,scope)
select r.id,p.id,a.scope from approved a
join public.roles r on r.code=a.role_code and r.active=true
join public.permissions p on p.code=a.permission_code
on conflict (role_id,permission_id,scope) do nothing;

create or replace function public.api_assert_journalism_access(
  p_actor_id uuid, p_task_id uuid, p_permission text
) returns void
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_actor_id uuid;
  v_actor_role_id uuid;
  v_actor_department_id uuid;
  v_role text;
  v_task public.tasks;
  v_department uuid;
  v_allowed boolean := false;
begin
  select u.id,u.role_id,u.department_id into v_actor_id,v_actor_role_id,v_actor_department_id from public.staff_users u
    join public.roles r on r.id=u.role_id
    where u.id=p_actor_id and u.active=true and r.active=true;
  select r.code into v_role from public.roles r where r.id=v_actor_role_id and r.active=true;
  if v_actor_id is null then raise exception 'Invalid actor.' using errcode='42501'; end if;
  select * into v_task from public.tasks where id=p_task_id;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if not exists(select 1 from public.journalism_task_details where task_id=p_task_id) then
    raise exception 'Task not found.' using errcode='P0002';
  end if;
  if not exists(select 1 from public.role_permission_grants g join public.permissions p on p.id=g.permission_id
    where g.role_id=v_actor_role_id and p.code=p_permission) then
    raise exception 'Journalism permission required.' using errcode='42501';
  end if;
  v_allowed := v_role in ('admin','tong_bien_tap','tbt_read_only')
    or v_task.created_by=p_actor_id or v_task.owner_id=p_actor_id
    or v_task.assignee_id=p_actor_id or v_task.reviewer_id=p_actor_id
    or exists(select 1 from public.task_assignees ta where ta.task_id=p_task_id and ta.user_id=p_actor_id)
    or (coalesce((select rp.can_view_department_tasks from public.role_permissions rp where rp.role_id=v_actor_role_id),false)
      and v_actor_department_id=v_task.department_id);
  if not v_allowed then raise exception 'Task action forbidden.' using errcode='42501'; end if;
  select d.id into v_department from public.departments d where d.id=v_task.department_id;
  if not exists(select 1 from public.role_permission_grants g join public.permissions p on p.id=g.permission_id
    where g.role_id=v_actor_role_id and p.code=p_permission and (g.scope='all'
      or (g.scope='department' and v_actor_department_id=v_department)
      or (g.scope='self' and (v_task.created_by=p_actor_id or v_task.owner_id=p_actor_id))
      or (g.scope='assigned' and (v_task.owner_id=p_actor_id or v_task.assignee_id=p_actor_id or v_task.reviewer_id=p_actor_id
        or exists(select 1 from public.task_assignees ta where ta.task_id=p_task_id and ta.user_id=p_actor_id))))) then
    raise exception 'Journalism permission scope forbidden.' using errcode='42501';
  end if;
end
$function$;

create or replace function public.api_assign_journalism_task_v1(
  p_actor_id uuid,p_title text,p_description text,p_department_id uuid,
  p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,p_due_time time,
  p_evaluation_criteria text,p_priority text,p_collaborator_ids uuid[],p_watcher_ids uuid[],
  p_work_kind_id uuid,p_planned_publication_at timestamptz,p_location text,p_editorial_notes text
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_task public.tasks; v_kind public.journalism_work_kinds;
begin
  if p_planned_publication_at is not null and p_planned_publication_at < now() then raise exception 'Invalid planned publication time.' using errcode='22023'; end if;
  if p_location is not null and char_length(p_location)>500 then raise exception 'Invalid location.' using errcode='22023'; end if;
  if p_editorial_notes is not null and char_length(p_editorial_notes)>10000 then raise exception 'Invalid editorial notes.' using errcode='22023'; end if;
  select * into v_kind from public.journalism_work_kinds where id=p_work_kind_id and is_active=true;
  if not found then raise exception 'Inactive work kind.' using errcode='22023'; end if;
  if not exists(select 1 from public.role_permission_grants g join public.permissions p on p.id=g.permission_id
    join public.staff_users u on u.role_id=g.role_id where u.id=p_actor_id and u.active=true and p.code='task.create' and g.scope='all')
    or not exists(select 1 from public.role_permission_grants g join public.permissions p on p.id=g.permission_id
      join public.staff_users u on u.role_id=g.role_id where u.id=p_actor_id and u.active=true and p.code='task.assign'
      and (g.scope='all' or (g.scope='department' and (select department_id from public.staff_users where id=p_actor_id)=p_department_id))) then
    raise exception 'Task permission required.' using errcode='42501';
  end if;
  select * into v_task from public.api_assign_task_v2(p_actor_id,p_title,p_description,p_department_id,p_assignee_id,p_reviewer_id,p_due_date,p_due_time,p_evaluation_criteria,p_collaborator_ids,p_watcher_ids,null,null,p_priority);
  insert into public.journalism_task_details(task_id,work_kind_id,publication_status,planned_publication_at,location,editorial_notes)
    values(v_task.id,p_work_kind_id,'not_published',p_planned_publication_at,nullif(btrim(p_location),''),nullif(btrim(p_editorial_notes),''));
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor_id,'task','journalism_task_details',v_task.id,'create_journalism_detail',jsonb_build_object('work_kind_id',p_work_kind_id,'planned_publication_at',p_planned_publication_at,'location_length',coalesce(char_length(p_location),0),'editorial_notes_length',coalesce(char_length(p_editorial_notes),0)));
  return v_task;
end
$function$;

create or replace function public.api_update_journalism_metadata_v1(
  p_actor_id uuid,p_task_id uuid,p_work_kind_id uuid,p_planned_publication_at timestamptz,
  p_location text,p_editorial_notes text,p_expected_updated_at timestamptz
) returns public.journalism_task_details
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_row public.journalism_task_details; v_kind public.journalism_work_kinds; v_old jsonb; v_new jsonb;
begin
  perform public.api_assert_journalism_access(p_actor_id,p_task_id,'journalism.metadata.update');
  select * into v_row from public.journalism_task_details where task_id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if p_expected_updated_at is not null and v_row.updated_at<>p_expected_updated_at then raise exception 'Concurrent update.' using errcode='40001'; end if;
  if v_row.publication_status in ('published','withdrawn') and p_planned_publication_at is distinct from v_row.planned_publication_at then raise exception 'Planned publication is locked.' using errcode='22023'; end if;
  if v_row.publication_status='scheduled' and p_planned_publication_at is null then raise exception 'Planned publication is required.' using errcode='22023'; end if;
  select * into v_kind from public.journalism_work_kinds where id=p_work_kind_id and is_active=true;
  if not found then raise exception 'Inactive work kind.' using errcode='22023'; end if;
  if p_location is not null and char_length(p_location)>500 then raise exception 'Invalid location.' using errcode='22023'; end if;
  if p_editorial_notes is not null and char_length(p_editorial_notes)>10000 then raise exception 'Invalid editorial notes.' using errcode='22023'; end if;
  v_old=jsonb_build_object('work_kind_id',v_row.work_kind_id,'planned_publication_at',v_row.planned_publication_at,'location_length',coalesce(char_length(v_row.location),0),'editorial_notes_length',coalesce(char_length(v_row.editorial_notes),0));
  update public.journalism_task_details set work_kind_id=p_work_kind_id,planned_publication_at=p_planned_publication_at,location=nullif(btrim(p_location),''),editorial_notes=nullif(btrim(p_editorial_notes),'') where task_id=p_task_id returning * into v_row;
  v_new=jsonb_build_object('work_kind_id',v_row.work_kind_id,'planned_publication_at',v_row.planned_publication_at,'location_length',coalesce(char_length(v_row.location),0),'editorial_notes_length',coalesce(char_length(v_row.editorial_notes),0));
  if v_old<>v_new then insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','journalism_task_details',p_task_id,'update_journalism_metadata',v_old,v_new); end if;
  return v_row;
end
$function$;

create or replace function public.api_change_journalism_publication_v1(
  p_actor_id uuid,p_task_id uuid,p_status text,p_planned_publication_at timestamptz,p_article_url text,p_reason text
) returns public.journalism_task_details
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_row public.journalism_task_details; v_old jsonb; v_new jsonb; v_url text;
begin
  perform public.api_assert_journalism_access(p_actor_id,p_task_id,'journalism.publication.manage');
  select * into v_row from public.journalism_task_details where task_id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if p_status not in ('not_published','scheduled','published','withdrawn') then raise exception 'Invalid publication status.' using errcode='22023'; end if;
  if (v_row.publication_status='not_published' and p_status not in ('scheduled','published'))
    or (v_row.publication_status='scheduled' and p_status not in ('not_published','published'))
    or (v_row.publication_status='published' and p_status<>'withdrawn')
    or v_row.publication_status='withdrawn' then raise exception 'Publication state conflict.' using errcode='23505'; end if;
  if p_status=v_row.publication_status then raise exception 'Publication state conflict.' using errcode='23505'; end if;
  if p_status='scheduled' and (p_planned_publication_at is null or p_article_url is not null) then raise exception 'Invalid publication input.' using errcode='22023'; end if;
  if p_status in ('published') then
    v_url=btrim(coalesce(p_article_url,''));
    if v_url='' or char_length(v_url)>2048 or v_url !~* '^https?://[^/@[:space:]]+([/:?][^[:space:]]*)?$' then raise exception 'Invalid article URL.' using errcode='22023'; end if;
  end if;
  if p_status='withdrawn' and (p_reason is null or char_length(btrim(p_reason))=0 or char_length(btrim(p_reason))>2000) then raise exception 'Withdrawal reason required.' using errcode='22023'; end if;
  v_old=jsonb_build_object('publication_status',v_row.publication_status,'planned_publication_at',v_row.planned_publication_at,'published_at',v_row.published_at,'article_url',v_row.article_url);
  if p_status='scheduled' then update public.journalism_task_details set publication_status='scheduled',planned_publication_at=p_planned_publication_at where task_id=p_task_id returning * into v_row;
  elsif p_status='not_published' then update public.journalism_task_details set publication_status='not_published',planned_publication_at=null,published_at=null,article_url=null where task_id=p_task_id returning * into v_row;
  elsif p_status='published' then update public.journalism_task_details set publication_status='published',published_at=now(),article_url=v_url where task_id=p_task_id returning * into v_row;
  else update public.journalism_task_details set publication_status='withdrawn' where task_id=p_task_id returning * into v_row; end if;
  v_new=jsonb_build_object('publication_status',v_row.publication_status,'planned_publication_at',v_row.planned_publication_at,'published_at',v_row.published_at,'article_url',v_row.article_url); if p_status='withdrawn' then v_new=v_new||jsonb_build_object('withdrawal_reason',btrim(p_reason)); end if;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','journalism_task_details',p_task_id,'change_publication_status',v_old,v_new);
  return v_row;
end
$function$;

do $block$
declare f text; begin
  foreach f in array array['api_assert_journalism_access(uuid,uuid,text)','api_assign_journalism_task_v1(uuid,text,text,uuid,uuid,uuid,date,time,text,text,uuid[],uuid[],uuid,timestamptz,text,text)','api_update_journalism_metadata_v1(uuid,uuid,uuid,timestamptz,text,text,timestamptz)','api_change_journalism_publication_v1(uuid,uuid,text,timestamptz,text,text)'] loop execute format('revoke all on function public.%s from public,anon,authenticated',f); execute format('grant execute on function public.%s to service_role',f); execute format('alter function public.%s owner to postgres',f); end loop;
end $block$;
commit;
