-- Additive link attachments; no storage objects or existing task fields are changed.
begin;
create table if not exists public.task_links (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id),
 url text not null check(length(url)<=2048 and url ~ '^https://[^[:space:]/@?#\\]+' and url !~ '[[:space:]\\]' and substring(url from '^https://([^/?#]+)') !~ '@'),
 title text not null check(length(btrim(title)) between 1 and 200),
 created_by uuid not null references public.staff_users(id),
 created_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists task_links_task_created_idx on public.task_links(task_id,created_at desc);
alter table public.task_links enable row level security;
revoke all on table public.task_links from public,anon,authenticated;
grant all on table public.task_links to service_role;
alter table public.project_library_items add column if not exists source_link_id uuid unique references public.task_links(id);
-- Replace only the legacy provenance check; preserve every other library check.
do $patch$ declare c record;
begin
 for c in select conname from pg_constraint where conrelid='public.project_library_items'::regclass and contype='c' and pg_get_constraintdef(oid) like '%source_attachment_id%' loop
  execute format('alter table public.project_library_items drop constraint %I',c.conname);
 end loop;
 alter table public.project_library_items add constraint project_library_items_source_reference_check check(
  (source='manual' and source_attachment_id is null and source_link_id is null and source_task_id is null)
  or (source<>'manual' and source_task_id is not null and
   ((source_attachment_id is not null and source_link_id is null)
    or (source='task_attachment' and kind='link' and source_attachment_id is null and source_link_id is not null))));
end $patch$;
create or replace function public.file_project_task_link() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare p uuid; f uuid;
begin
 if tg_op='UPDATE' then
  if new.deleted_at is not null and old.deleted_at is null then
   update public.project_library_items set deleted_at=new.deleted_at,updated_at=now() where source_link_id=new.id and deleted_at is null;
  end if;
  return new;
 end if;
 select project_id into p from public.tasks where id=new.task_id;
 if p is null or new.deleted_at is not null then return new; end if;
 f:=public.ensure_project_task_folder(p,new.created_by);
 insert into public.project_library_items(project_id,folder_id,kind,title,url,source,source_task_id,source_link_id,uploaded_by,created_at)
 values(p,f,'link',new.title,new.url,'task_attachment',new.task_id,new.id,new.created_by,new.created_at) on conflict(source_link_id) do nothing;
 return new;
end $$;
drop trigger if exists file_project_task_link on public.task_links;
create trigger file_project_task_link after insert or update of deleted_at on public.task_links for each row execute function public.file_project_task_link();
create or replace function public.api_add_task_link(p_actor_id uuid,p_task_id uuid,p_url text,p_title text default null)
returns public.task_links language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_task public.tasks; v_link public.task_links; v_allowed boolean; v_url text:=btrim(p_url); v_title text;
begin
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
  if v_task.status='cancelled' then raise exception 'Cancelled task upload forbidden.' using errcode='42501'; end if;
  select (
    r.code='admin' or v_task.created_by=p_actor_id or v_task.owner_id=p_actor_id
    or v_task.assignee_id=p_actor_id
    or exists(select 1 from public.task_assignees a where a.task_id=p_task_id and a.user_id=p_actor_id and a.assignment_role<>'watcher')
    or (coalesce(rp.can_assign_task,false) and u.department_id is not null and u.department_id=v_task.department_id)
  ) into v_allowed
  from public.staff_users u join public.roles r on r.id=u.role_id
  left join public.role_permissions rp on rp.role_id=r.id
  where u.id=p_actor_id and u.active=true;
  if not coalesce(v_allowed,false) then raise exception 'Attachment upload forbidden.' using errcode='42501'; end if;
  if v_url is null or length(v_url)>2048 or v_url !~ '^https://[^[:space:]/@?#\\]+' or v_url ~ '[[:space:]\\]' or substring(v_url from '^https://([^/?#]+)') ~ '@' then raise exception 'Invalid HTTPS link.' using errcode='22023'; end if;
  v_title:=left(coalesce(nullif(btrim(p_title),''),regexp_replace(substring(v_url from '^https://([^/?#]+)'),':[0-9]+$','')),200);
  insert into public.task_links(task_id,url,title,created_by) values(p_task_id,v_url,v_title,p_actor_id) returning * into v_link;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'task','task_links',v_link.id,'create',to_jsonb(v_link));
  return v_link;
end $function$;
create or replace function public.api_delete_task_link(p_actor_id uuid,p_task_id uuid,p_link_id uuid)
returns public.task_links language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.task_links; before_data jsonb;
begin
 perform 1 from public.tasks where id=p_task_id for update;
 if not found then raise exception 'Task not found.' using errcode='P0002'; end if;
 select * into v from public.task_links where id=p_link_id and task_id=p_task_id and deleted_at is null for update;
 if not found then raise exception 'Link not found.' using errcode='P0002'; end if;
 if not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active and (r.code='admin' or v.created_by=p_actor_id)) then raise exception 'Link deletion forbidden.' using errcode='42501'; end if;
 before_data:=to_jsonb(v);
 update public.task_links set deleted_at=now() where id=v.id returning * into v;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values(p_actor_id,'task','task_links',v.id,'delete',before_data,to_jsonb(v));
 return v;
end $$;
do $grants$ declare f regprocedure;
begin
 foreach f in array array['public.file_project_task_link()'::regprocedure,'public.api_add_task_link(uuid,uuid,text,text)'::regprocedure,'public.api_delete_task_link(uuid,uuid,uuid)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 execute format('alter function %s owner to postgres',f);
 end loop;
end $grants$;
-- Preserve the latest RPC authorization and lifecycle rules, failing closed if its
-- known insertion point has drifted. Replays do not insert duplicate fragments.
do $patch$ declare d text; marker text:=$m$'attachments',coalesce($m$;
begin
 select pg_get_functiondef('public.api_get_personnel_evaluation_detail(uuid,uuid,date,date)'::regprocedure) into d;
 if position($m$'links',coalesce($m$ in d)=0 then
  if position(marker in d)=0 then raise exception 'Task detail patch anchor missing'; end if;
  execute replace(d,marker,$m$'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'url',l.url,'title',l.title,'created_at',l.created_at,'created_by',l.created_by) order by l.created_at desc,l.id desc) from public.task_links l where l.task_id=task.id and l.deleted_at is null),'[]'::jsonb), 'attachments',coalesce($m$);
 end if;
 select pg_get_functiondef('public.api_delete_cancelled_project_tasks(uuid,uuid,uuid[])'::regprocedure) into d;
 if position('delete from public.task_links' in d)=0 then
  if position('  delete from public.task_attachments where task_id=any(p_task_ids);' in d)=0 then raise exception 'Task deletion patch anchor missing'; end if;
  execute replace(d,'  delete from public.task_attachments where task_id=any(p_task_ids);','  delete from public.project_library_items where source_link_id in (select id from public.task_links where task_id=any(p_task_ids)); delete from public.task_links where task_id=any(p_task_ids); delete from public.task_attachments where task_id=any(p_task_ids);');
 end if;
end $patch$;
notify pgrst,'reload schema';
commit;