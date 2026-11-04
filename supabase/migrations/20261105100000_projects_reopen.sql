-- Reopen a closed project without changing close or assignment semantics.
begin;
create or replace function public.api_reopen_project(p_actor_id uuid,p_project_id uuid) returns public.projects
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v public.projects;
begin
 select * into v from public.projects where id=p_project_id for update;
 if not found then raise exception 'Project not found.' using errcode='P0002'; end if;
 if not public.api_project_is_lead(p_actor_id,p_project_id) then raise exception 'Project reopen forbidden.' using errcode='42501'; end if;
 if v.status='active' then raise exception 'Project is already active.' using errcode='55000'; end if;
 update public.projects set status='active',closed_at=null,updated_at=now() where id=p_project_id returning * into v;
 insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor_id,'project','projects',p_project_id,'reopen',to_jsonb(v));
 return v;
end $function$;

do $$ declare f text; begin foreach f in array array['api_reopen_project(uuid,uuid)'] loop execute format('revoke all on function public.%s from public,anon,authenticated',f); execute format('grant execute on function public.%s to service_role',f); execute format('alter function public.%s owner to postgres',f); end loop; end $$;
notify pgrst,'reload schema';
commit;
